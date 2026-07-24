// postReel.js
// Prototype: takes ONE local video file + a caption, uploads it to Cloudinary,
// then publishes it as an Instagram Reel via the Graph API.
//
// Usage:
//   node postReel.js "./clips/clip1.mp4" "My caption here #reels"

require('dotenv').config();
const { v2: cloudinary } = require('cloudinary');
const fetch = require('node-fetch');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_USER_ID = process.env.IG_USER_ID;
const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Step 1: upload local clip to Cloudinary, get a public video URL back
async function uploadClipToCloudinary(localFilePath) {
  console.log(`Uploading ${localFilePath} to Cloudinary...`);
  const result = await cloudinary.uploader.upload(localFilePath, {
    resource_type: 'video',
    folder: 'reelbot',
  });
  console.log('Uploaded. Public URL:', result.secure_url);
  return result.secure_url;
}

// Step 2: create a Reels media container on Instagram
async function createReelContainer(videoUrl, caption) {
  const url = `${GRAPH_BASE}/${IG_USER_ID}/media`;
  const params = new URLSearchParams({
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption,
    access_token: IG_ACCESS_TOKEN,
  });

  const res = await fetch(url, { method: 'POST', body: params });
  const data = await res.json();

  if (data.error) {
    throw new Error(`Container creation failed: ${JSON.stringify(data.error)}`);
  }

  console.log('Container created. ID:', data.id);
  return data.id;
}

// Step 3: poll the container until Instagram finishes processing the video
async function waitForContainerReady(containerId, { intervalMs = 5000, maxAttempts = 24 } = {}) {
  const url = `${GRAPH_BASE}/${containerId}?fields=status_code,status&access_token=${IG_ACCESS_TOKEN}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      throw new Error(`Status check failed: ${JSON.stringify(data.error)}`);
    }

    console.log(`Attempt ${attempt}: status_code=${data.status_code}`);

    if (data.status_code === 'FINISHED') {
      return true;
    }
    if (data.status_code === 'ERROR') {
      throw new Error(`Container processing failed: ${JSON.stringify(data)}`);
    }

    await sleep(intervalMs);
  }

  throw new Error('Timed out waiting for container to finish processing.');
}

// Step 4: publish the container -> goes live on Instagram
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

  console.log('Published! Media ID:', data.id);
  return data.id;
}

async function postSingleReel(localFilePath, caption) {
  try {
    const videoUrl = await uploadClipToCloudinary(localFilePath);
    const containerId = await createReelContainer(videoUrl, caption);

    console.log('Waiting for Instagram to process the video...');
    await waitForContainerReady(containerId);

    const mediaId = await publishContainer(containerId);
    console.log('\n✅ Done. Reel is live. Media ID:', mediaId);
  } catch (err) {
    console.error('\n❌ Failed:', err.message);
  }
}

// --- CLI entry point ---
const [, , filePath, caption] = process.argv;

if (!filePath || !caption) {
  console.log('Usage: node postReel.js <path-to-video> "<caption>"');
  process.exit(1);
}

postSingleReel(filePath, caption);
