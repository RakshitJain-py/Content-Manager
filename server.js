// server.js
// Express server to run the "Content Manager" local dashboard.
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v2: cloudinary } = require('cloudinary');
const fetch = require('node-fetch');
const db = require('./db');
const paths = require('./paths');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Admin middleware ─────────────────────────────────────────────────────────
// Every admin route uses this to verify BOTH the token (server-side session)
// AND that the user is the actual admin defined in .env.
function requireAdmin(req, res, next) {
  const { token, telegramUserId } = req.body;
  const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
  if (!adminId || String(telegramUserId) !== String(adminId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db.validateSession(token, telegramUserId)) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  next();
}

// ─── Client authentication middleware ─────────────────────────────────────────
// Validates token and user ID from headers, sets req.telegramUserId
function requireAuth(req, res, next) {
  const token = req.headers['x-session-token'];
  const telegramUserId = req.headers['x-telegram-user-id'];
  if (!token || !telegramUserId) {
    return res.status(401).json({ error: 'Session credentials missing.' });
  }
  if (!db.validateSession(token, telegramUserId)) {
    return res.status(401).json({ error: 'Session invalid or revoked.' });
  }
  req.telegramUserId = String(telegramUserId);
  next();
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Cloudinary from environment
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_USER_ID = process.env.IG_USER_ID;
const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

// Shared helper functions for publishing
async function uploadToCloudinary(localFilePath, cloudConfig) {
  if (!cloudConfig) throw new Error('Cloudinary credentials are not configured on the dashboard.');
  const absolutePath = paths.resolveMedia(localFilePath);
  const result = await cloudinary.uploader.upload(absolutePath, {
    cloud_name: cloudConfig.cloudName,
    api_key: cloudConfig.apiKey,
    api_secret: cloudConfig.apiSecret,
    resource_type: 'video',
    folder: 'reelbot',
  });
  return result.secure_url;
}

async function createReelContainer(videoUrl, caption, coverUrl, userId, accessToken) {
  const url = `https://graph.instagram.com/v21.0/${userId}/media`;
  const params = new URLSearchParams({
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption,
    access_token: accessToken,
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

async function waitForContainerReady(containerId, accessToken, { intervalMs = 5000, maxAttempts = 24 } = {}) {
  const url = `https://graph.instagram.com/v21.0/${containerId}?fields=status_code,status&access_token=${accessToken}`;
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
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for container to finish processing.');
}

async function publishContainer(containerId, userId, accessToken) {
  const url = `https://graph.instagram.com/v21.0/${userId}/media_publish`;
  const params = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  });
  const res = await fetch(url, { method: 'POST', body: params });
  const data = await res.json();
  if (data.error) {
    throw new Error(`Publish failed: ${JSON.stringify(data.error)}`);
  }
  return data.id;
}

// API Endpoints
// 1. Get all media
app.get('/api/media', requireAuth, (req, res) => {
  res.json(db.getAll());
});

// 1b. Delete media by ID (also removes from Cloudinary if uploaded)
app.delete('/api/media/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const item = db.getById(id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  // Delete from Cloudinary if there is a cloudinaryUrl
  if (item.cloudinaryUrl) {
    try {
      const uploaderId = item.telegramUserId || req.telegramUserId;
      const cloudConfig = db.getCloudinaryConfig(uploaderId);
      if (cloudConfig) {
        // Extract public_id from URL e.g. reelbot/abc123 from .../reelbot/abc123.mp4
        const urlParts = item.cloudinaryUrl.split('/');
        const filenameWithExt = urlParts[urlParts.length - 1];
        const filename = filenameWithExt.replace(/\.[^/.]+$/, '');
        const folder = urlParts[urlParts.length - 2];
        const publicId = `${folder}/${filename}`;
        await cloudinary.uploader.destroy(publicId, {
          resource_type: 'video',
          cloud_name: cloudConfig.cloudName,
          api_key: cloudConfig.apiKey,
          api_secret: cloudConfig.apiSecret
        });
      }
    } catch (err) {
      console.error(`Cloudinary delete failed for item ${id}:`, err.message);
      // Don't block deletion even if Cloudinary fails
    }
  }

  // Delete local file if it still exists
  if (item.localPath) {
    const absolutePath = paths.resolveMedia(item.localPath);
    if (fs.existsSync(absolutePath)) {
      try { fs.unlinkSync(absolutePath); } catch (e) { /* ignore */ }
    }
  }

  db.remove(id);
  res.json({ success: true });
});

// 2. Approve media by ID
app.post('/api/approve', requireAuth, (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing ID' });
  
  const item = db.getById(id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  
  db.update(id, { status: 'approved' });
  res.json({ success: true, item: db.getById(id) });
});

// 3. Post (publish) items
app.post('/api/post', requireAuth, async (req, res) => {
  const { id, count } = req.body;
  
  const activeAccounts = db.getAccounts(req.telegramUserId).filter(a => a.isActive);
  if (activeAccounts.length === 0) {
    return res.status(400).json({ error: 'No active Instagram accounts selected. Activate at least one account in the dashboard.' });
  }

  let itemsToPost = [];
  if (id) {
    const item = db.getById(id);
    if (!item) return res.status(404).json({ error: `Item with ID ${id} not found.` });
    itemsToPost = [item];
  } else {
    const limit = parseInt(count, 10) || 1;
    const approvedItems = db.getApproved();
    if (approvedItems.length === 0) {
      return res.status(400).json({ error: 'No approved media items found in queue.' });
    }
    itemsToPost = approvedItems.slice(0, limit);
  }

  // Respond immediately that processing has started
  res.json({ success: true, message: `Processing ${itemsToPost.length} item(s) in background.` });

  // Process in the background so the UI doesn't hang
  for (const item of itemsToPost) {
    db.update(item.id, { status: 'uploading', error: null });
    try {
      // Fetch current caption.txt (or fallback to environment variable)
      let caption = process.env.DEFAULT_CAPTION || 'Default caption #reels';
      const captionFilePath = paths.caption;
      if (fs.existsSync(captionFilePath)) {
        caption = fs.readFileSync(captionFilePath, 'utf8').trim();
      }

      // Retrieve uploader's Cloudinary credentials dynamically
      const uploaderId = item.telegramUserId || req.telegramUserId;
      const cloudConfig = db.getCloudinaryConfig(uploaderId);
      if (!cloudConfig) {
        throw new Error('Cloudinary credentials are not configured on the dashboard under "Manage Cloud".');
      }

      // Step 1: Upload to Cloudinary
      const cloudinaryUrl = await uploadToCloudinary(item.localPath, cloudConfig);
      db.update(item.id, { cloudinaryUrl });

      // Determine coverUrl: item-level first, then preset_cover.txt
      let coverUrl = item.coverUrl || null;
      if (!coverUrl) {
        const presetCoverPath = paths.presetCover;
        if (fs.existsSync(presetCoverPath)) {
          coverUrl = fs.readFileSync(presetCoverPath, 'utf8').trim() || null;
        }
      }

      const results = [];
      const errors = [];

      for (const account of activeAccounts) {
        try {
          // Step 2: Create IG Reel Container (passing coverUrl, userId, accessToken)
          const containerId = await createReelContainer(cloudinaryUrl, caption, coverUrl, account.userId, account.accessToken);

          // Step 3: Wait for IG to process video
          await waitForContainerReady(containerId, account.accessToken);

          // Step 4: Publish Reel
          const mediaId = await publishContainer(containerId, account.userId, account.accessToken);

          results.push(`${account.name}: ${mediaId}`);
        } catch (accErr) {
          console.error(`Failed posting to account ${account.name}:`, accErr);
          errors.push(`${account.name}: ${accErr.message}`);
        }
      }

      if (errors.length === activeAccounts.length) {
        // All accounts failed
        throw new Error(`All accounts failed: ${errors.join(' | ')}`);
      }

      // Update DB with success/partial success
      const finalStatus = errors.length > 0 ? 'failed' : 'published';
      const finalError = errors.length > 0 ? `Some accounts failed: ${errors.join(' | ')}` : null;

      db.update(item.id, {
        status: finalStatus,
        instagramMediaId: results.join(', '),
        publishedAt: new Date().toISOString(),
        error: finalError
      });
    } catch (err) {
      console.error(`Error publishing item ${item.id}:`, err);
      db.update(item.id, {
        status: 'failed',
        error: err.message
      });
    }
  }
});

// 4. Get active caption
app.get('/api/caption', requireAuth, (req, res) => {
  const captionFilePath = paths.caption;
  let caption = '';
  if (fs.existsSync(captionFilePath)) {
    caption = fs.readFileSync(captionFilePath, 'utf8');
  } else {
    caption = process.env.DEFAULT_CAPTION || '';
  }
  res.json({ caption });
});

// 5. Update caption
app.post('/api/caption', requireAuth, (req, res) => {
  const { caption } = req.body;
  if (caption === undefined) return res.status(400).json({ error: 'Missing caption field' });
  
  const captionFilePath = paths.caption;
  fs.writeFileSync(captionFilePath, caption, 'utf8');
  res.json({ success: true, caption });
});

// 6. Get preset cover thumbnail URL
app.get('/api/preset-cover', requireAuth, (req, res) => {
  const presetCoverPath = paths.presetCover;
  let coverUrl = '';
  if (fs.existsSync(presetCoverPath)) {
    coverUrl = fs.readFileSync(presetCoverPath, 'utf8');
  }
  res.json({ coverUrl });
});

// 7. Update preset cover thumbnail URL
app.post('/api/preset-cover', requireAuth, (req, res) => {
  const { coverUrl } = req.body;
  if (coverUrl === undefined) return res.status(400).json({ error: 'Missing coverUrl field' });
  
  const presetCoverPath = paths.presetCover;
  fs.writeFileSync(presetCoverPath, coverUrl, 'utf8');
  res.json({ success: true, coverUrl });
});

// 8. Update specific media custom cover
app.post('/api/media/cover', requireAuth, (req, res) => {
  const { id, coverUrl } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing ID' });
  
  const item = db.getById(id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  
  db.update(id, { coverUrl: coverUrl || null });
  res.json({ success: true, item: db.getById(id) });
});

// 8b. Cloudinary Config endpoints (Secured & Isolated per User)
app.get('/api/cloudinary-config', requireAuth, (req, res) => {
  const config = db.getCloudinaryConfig(req.telegramUserId);
  res.json({ success: true, config });
});

app.post('/api/cloudinary-config', requireAuth, (req, res) => {
  const { cloudName, apiKey, apiSecret } = req.body;
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(400).json({ error: 'Missing cloudName, apiKey, or apiSecret' });
  }
  db.setCloudinaryConfig(req.telegramUserId, { cloudName, apiKey, apiSecret });
  res.json({ success: true });
});

// 9. Accounts endpoints (Secured & Isolated per User)
app.get('/api/accounts', requireAuth, (req, res) => {
  res.json(db.getAccounts(req.telegramUserId));
});

app.post('/api/accounts', requireAuth, (req, res) => {
  const { name, userId, accessToken } = req.body;
  if (!name || !userId || !accessToken) {
    return res.status(400).json({ error: 'Missing name, userId, or accessToken' });
  }
  const newAcc = db.addAccount({ name, userId, accessToken, telegramOwner: req.telegramUserId });
  res.json({ success: true, account: newAcc });
});

app.post('/api/accounts/toggle', requireAuth, (req, res) => {
  const { id, isActive } = req.body;
  const accounts = db.getAccounts(req.telegramUserId);
  const belongsToUser = accounts.some(a => String(a.id) === String(id));
  if (!belongsToUser) {
    return res.status(403).json({ error: 'Access denied to this account.' });
  }

  const updated = db.updateAccount(id, { isActive: !!isActive });
  if (!updated) return res.status(404).json({ error: 'Account not found' });
  res.json({ success: true, account: updated });
});

app.delete('/api/accounts/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const accounts = db.getAccounts(req.telegramUserId);
  const belongsToUser = accounts.some(a => String(a.id) === String(id));
  if (!belongsToUser) {
    return res.status(403).json({ error: 'Access denied to this account.' });
  }

  const removed = db.removeAccount(id);
  if (!removed) return res.status(404).json({ error: 'Account not found' });
  res.json({ success: true });
});

// 10. Authentication
app.post('/api/login', (req, res) => {
  const { telegramUserId, otp } = req.body;
  if (!telegramUserId || !otp) {
    return res.status(400).json({ error: 'Missing telegramUserId or otp' });
  }

  // Validate OTP
  const activeOtp = db.getOtp();
  if (!activeOtp || activeOtp !== String(otp).trim()) {
    return res.status(401).json({ error: 'Invalid or expired access code.' });
  }

  const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
  const isAdm = adminId && String(adminId) === String(telegramUserId);

  if (!isAdm) {
    // Adds or re-activates client in allowedUsers
    db.addAllowedUser(telegramUserId);
  }

  // Single-use OTP — clear immediately
  db.clearOtp();

  // Generate a cryptographically secure server-side session token
  const token = crypto.randomBytes(32).toString('hex');
  db.createSession(token, telegramUserId);

  res.json({ success: true, isAdmin: isAdm, token });
});

app.post('/api/verify-session', (req, res) => {
  const { token, telegramUserId } = req.body;
  if (!token || !telegramUserId) return res.status(401).json({ valid: false });

  const valid = db.validateSession(token, telegramUserId);
  if (!valid) return res.json({ valid: false });

  const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
  const isAdmin = adminId && String(adminId) === String(telegramUserId);
  res.json({ valid: true, isAdmin });
});

app.post('/api/logout', (req, res) => {
  const { token, telegramUserId } = req.body;
  if (token && telegramUserId) {
    db.deleteSessionsForUser(telegramUserId);
  }
  res.json({ success: true });
});

// 11. Admin-only routes — all protected by requireAdmin middleware
app.post('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.getAllowedUsers().map(u => ({
    userId: u.userId,
    loginTime: u.loginTime,
    uploadCount: u.uploadCount || 0,
    isRevoked: u.isRevoked
  }));
  res.json({ success: true, users });
});

app.post('/api/admin/revoke', requireAdmin, (req, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'Missing targetUserId' });

  // Cannot revoke the admin themselves
  const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
  if (String(targetUserId) === String(adminId)) {
    return res.status(400).json({ error: 'Cannot revoke admin access.' });
  }

  db.revokeUser(targetUserId);
  res.json({ success: true });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Content Manager Dashboard running at http://localhost:${PORT}`);
});

