// cli.js
// CLI manager to check status, approve media, and process publishing queue.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');
const fetch = require('node-fetch');
const db = require('./db');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_USER_ID = process.env.IG_USER_ID;
const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

let DEFAULT_CAPTION = process.env.DEFAULT_CAPTION || 'Default caption #reels';
const captionFilePath = path.join(__dirname, 'caption.txt');
if (fs.existsSync(captionFilePath)) {
  DEFAULT_CAPTION = fs.readFileSync(captionFilePath, 'utf8').trim();
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Helpers from prototype
async function uploadToCloudinary(localFilePath) {
  const absolutePath = path.resolve(__dirname, localFilePath);
  const result = await cloudinary.uploader.upload(absolutePath, {
    resource_type: 'video', // works for gifs too
    folder: 'reelbot',
  });
  return result.secure_url;
}

async function createReelContainer(videoUrl, caption, coverUrl) {
  const url = `${GRAPH_BASE}/${IG_USER_ID}/media`;
  const params = new URLSearchParams({
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption,
    access_token: IG_ACCESS_TOKEN,
  });
  if (coverUrl) {
    params.append('cover_url', coverUrl);
  }

  const res = await fetch(url, { method: 'POST', body: params });
  const data = await res.json();
  if (data.error) {
    throw new Error(`Container creation failed: ${JSON.stringify(data.error)}`);
  }
  return data.id;
}

async function waitForContainerReady(containerId, { intervalMs = 5000, maxAttempts = 24 } = {}) {
  const url = `${GRAPH_BASE}/${containerId}?fields=status_code,status&access_token=${IG_ACCESS_TOKEN}`;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      throw new Error(`Status check failed: ${JSON.stringify(data.error)}`);
    }
    if (data.status_code === 'FINISHED') return true;
    if (data.status_code === 'ERROR') {
      throw new Error(`Container processing failed: ${JSON.stringify(data)}`);
    }
    await sleep(intervalMs);
  }
  throw new Error('Timed out waiting for container to finish processing.');
}

async function publishContainer(containerId) {
  const url = `${GRAPH_BASE}/${IG_USER_ID}/media_publish`;
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: IG_ACCESS_TOKEN,
  });
  const res = await fetch(url, { method: 'POST', body: params });
  const data = await res.json();
  if (data.error) {
    throw new Error(`Publish failed: ${JSON.stringify(data.error)}`);
  }
  return data.id;
}

// CLI Actions
function handleList() {
  const allMedia = db.getAll();
  if (allMedia.length === 0) {
    console.log('No media in the queue database yet.');
    return;
  }

  console.log('\n--- Current Media Queue ---');
  allMedia.forEach(m => {
    console.log(`ID: ${m.id}`);
    console.log(`  Filename:   ${m.filename}`);
    console.log(`  Type:       ${m.mediaType}`);
    console.log(`  Status:     ${m.status.toUpperCase()}`);
    if (m.cloudinaryUrl) console.log(`  Cloudinary: ${m.cloudinaryUrl}`);
    if (m.instagramMediaId) console.log(`  IG Media:   ${m.instagramMediaId}`);
    if (m.error) console.log(`  Error:      ${m.error}`);
    console.log(`  Added At:   ${m.timestamp}`);
    console.log('---------------------------');
  });
}

function handleApprove(id) {
  const item = db.getById(id);
  if (!item) {
    console.log(`Error: Media item with ID "${id}" not found.`);
    return;
  }
  db.update(id, { status: 'approved' });
  console.log(`Media item "${item.filename}" (ID: ${id}) approved for upload!`);
}

async function handlePost({ id, count }) {
  let itemsToPost = [];

  if (id) {
    const specificItem = db.getById(id);
    if (!specificItem) {
      console.log(`Error: Media item with ID "${id}" not found.`);
      return;
    }
    itemsToPost = [specificItem];
    console.log(`Starting post flow for 1 specific item (ID: ${id})...`);
  } else {
    const limit = parseInt(count, 10) || 1;
    const approvedItems = db.getApproved();

    if (approvedItems.length === 0) {
      console.log('No approved media items found. Run "node cli.js approve <id>" first.');
      return;
    }

    itemsToPost = approvedItems.slice(0, limit);
    console.log(`Starting post flow for ${itemsToPost.length} approved item(s)...`);
  }

  for (const item of itemsToPost) {
    console.log(`\nProcessing Item ID: ${item.id} ("${item.filename}")...`);
    try {
      // 1. Upload to Cloudinary
      console.log('- Uploading to Cloudinary...');
      const cloudinaryUrl = await uploadToCloudinary(item.localPath);
      db.update(item.id, { cloudinaryUrl });
      console.log(`- Uploaded: ${cloudinaryUrl}`);

      // Determine coverUrl: item-level first, then preset_cover.txt
      let coverUrl = item.coverUrl || null;
      if (!coverUrl) {
        const presetCoverPath = path.join(__dirname, 'preset_cover.txt');
        if (fs.existsSync(presetCoverPath)) {
          coverUrl = fs.readFileSync(presetCoverPath, 'utf8').trim() || null;
        }
      }

      // 2. Create IG Container
      console.log('- Creating Instagram Reel Container...');
      const containerId = await createReelContainer(cloudinaryUrl, DEFAULT_CAPTION, coverUrl);

      // 3. Poll container status
      console.log('- Waiting for Instagram processing...');
      await waitForContainerReady(containerId);

      // 4. Publish
      console.log('- Publishing Reel...');
      const mediaId = await publishContainer(containerId);

      // 5. Update DB status
      db.update(item.id, {
        status: 'published',
        instagramMediaId: mediaId,
        publishedAt: new Date().toISOString(),
        error: null
      });

      console.log(`✅ Success! Published Reel ID: ${mediaId}`);
    } catch (err) {
      console.error(`❌ Failed processing Item ID ${item.id}:`, err.message);
      db.update(item.id, {
        status: 'failed',
        error: err.message
      });
    }
  }
}

// CLI entry point parse
const [, , command, arg1, arg2] = process.argv;

async function run() {
  switch (command) {
    case 'list':
      handleList();
      break;
    case 'approve':
      if (!arg1) {
        console.log('Usage: node cli.js approve <id>');
        process.exit(1);
      }
      handleApprove(arg1);
      break;
    case 'post':
      if (arg1 === '--id' || arg1 === '-i') {
        if (!arg2) {
          console.log('Usage: node cli.js post --id <Queue ID>');
          process.exit(1);
        }
        await handlePost({ id: arg2 });
      } else {
        await handlePost({ count: arg1 });
      }
      break;
    default:
      console.log('Usage:');
      console.log('  node cli.js list              List all queued media');
      console.log('  node cli.js approve <id>      Approve a specific media ID');
      console.log('  node cli.js post [count]      Upload and post [count] approved items (default: 1)');
      console.log('  node cli.js post --id <id>    Upload and post a specific media ID directly');
      process.exit(1);
  }
}

run();
