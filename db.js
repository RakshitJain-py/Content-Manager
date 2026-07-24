const fs = require('fs');
const path = require('path');
const paths = require('./paths');

const DB_PATH = paths.db;

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
      media: [], accounts: [], allowedUsers: [], sessions: [], currentOtp: null
    }, null, 2));
  }
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(data);
    let needsWrite = false;

    if (!parsed.media)       { parsed.media       = [];   needsWrite = true; }
    if (!parsed.accounts)    { parsed.accounts    = [];   needsWrite = true; }
    if (!parsed.sessions)    { parsed.sessions    = [];   needsWrite = true; }
    if (parsed.currentOtp === undefined) { parsed.currentOtp = null; needsWrite = true; }

    // Migrate allowedUsers: string[] → object[]
    if (!parsed.allowedUsers) {
      parsed.allowedUsers = [];
      needsWrite = true;
    } else if (parsed.allowedUsers.length > 0 && typeof parsed.allowedUsers[0] === 'string') {
      parsed.allowedUsers = parsed.allowedUsers.map(uid => ({
        userId: uid,
        loginTime: new Date().toISOString(),
        uploadCount: 0,
        isRevoked: false
      }));
      needsWrite = true;
    }

    // Seed default account from .env if none exist
    if (parsed.accounts.length === 0 && process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN && process.env.ALLOWED_TELEGRAM_USER_ID) {
      parsed.accounts.push({
        id: String(process.env.IG_USER_ID),
        name: 'Primary IG Account',
        userId: process.env.IG_USER_ID,
        accessToken: process.env.IG_ACCESS_TOKEN,
        telegramOwner: String(process.env.ALLOWED_TELEGRAM_USER_ID),
        isActive: true
      });
      needsWrite = true;
    }

    // Auto-migrate accounts missing telegramOwner to the Admin
    if (parsed.accounts.length > 0 && process.env.ALLOWED_TELEGRAM_USER_ID) {
      parsed.accounts.forEach(acc => {
        if (!acc.telegramOwner) {
          acc.telegramOwner = String(process.env.ALLOWED_TELEGRAM_USER_ID);
          needsWrite = true;
        }
      });
    }

    if (needsWrite) fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf8');
    return parsed;
  } catch (err) {
    console.error('Error reading db.json, returning empty database:', err);
    return { media: [], accounts: [], allowedUsers: [], sessions: [], currentOtp: null };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

const db = {

  // ─── Media ────────────────────────────────────────────────────────────
  getAll()        { return readDb().media || []; },
  getById(id)     { return (readDb().media || []).find(m => String(m.id) === String(id)) || null; },
  getPending()    { return this.getAll().filter(m => m.status === 'pending'); },
  getApproved()   { return this.getAll().filter(m => m.status === 'approved'); },

  add({ id, filename, localPath, mediaType, telegramUser, telegramUserId }) {
    const data = readDb();
    const newItem = {
      id: String(id || Date.now()),
      filename, localPath, mediaType, telegramUser,
      telegramUserId: String(telegramUserId),
      status: 'pending',
      cloudinaryUrl: null,
      instagramMediaId: null,
      timestamp: new Date().toISOString(),
      publishedAt: null,
      coverUrl: null,
      error: null
    };
    data.media.push(newItem);
    writeDb(data);
    return newItem;
  },

  update(id, updates) {
    const data = readDb();
    const i = data.media.findIndex(m => String(m.id) === String(id));
    if (i !== -1) { data.media[i] = { ...data.media[i], ...updates }; writeDb(data); return data.media[i]; }
    return null;
  },

  remove(id) {
    const data = readDb();
    const i = data.media.findIndex(m => String(m.id) === String(id));
    if (i !== -1) { const r = data.media[i]; data.media.splice(i, 1); writeDb(data); return r; }
    return null;
  },

  // ─── Accounts ─────────────────────────────────────────────────────────
  getAccounts(telegramOwner) {
    const list = readDb().accounts || [];
    if (!telegramOwner) return [];
    return list.filter(a => String(a.telegramOwner) === String(telegramOwner));
  },

  addAccount({ name, userId, accessToken, telegramOwner }) {
    const data = readDb();
    if (!data.accounts) data.accounts = [];
    const acc = { 
      id: String(userId), 
      name, 
      userId, 
      accessToken, 
      telegramOwner: String(telegramOwner), 
      isActive: true 
    };
    // remove existing if same userId and telegramOwner to prevent duplicates
    data.accounts = data.accounts.filter(a => !(String(a.userId) === String(userId) && String(a.telegramOwner) === String(telegramOwner)));
    data.accounts.push(acc);
    writeDb(data);
    return acc;
  },

  updateAccount(id, updates) {
    const data = readDb();
    const i = data.accounts.findIndex(a => String(a.id) === String(id));
    if (i !== -1) { data.accounts[i] = { ...data.accounts[i], ...updates }; writeDb(data); return data.accounts[i]; }
    return null;
  },

  removeAccount(id) {
    const data = readDb();
    const i = data.accounts.findIndex(a => String(a.id) === String(id));
    if (i !== -1) { const r = data.accounts[i]; data.accounts.splice(i, 1); writeDb(data); return r; }
    return null;
  },

  // ─── OTP ──────────────────────────────────────────────────────────────
  setOtp(otp)   { const d = readDb(); d.currentOtp = String(otp); writeDb(d); },
  getOtp()      { return readDb().currentOtp; },
  clearOtp()    { const d = readDb(); d.currentOtp = null; writeDb(d); },

  // ─── Sessions (server-side token store) ───────────────────────────────
  createSession(token, userId) {
    const data = readDb();
    if (!data.sessions) data.sessions = [];
    // One active session per user at a time
    data.sessions = data.sessions.filter(s => String(s.userId) !== String(userId));
    data.sessions.push({ token, userId: String(userId), createdAt: new Date().toISOString() });
    writeDb(data);
  },

  validateSession(token, userId) {
    if (!token || !userId) return false;
    const data = readDb();
    const session = (data.sessions || []).find(
      s => s.token === token && String(s.userId) === String(userId)
    );
    if (!session) return false;

    // Admin is always valid if session exists
    const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
    if (adminId && String(adminId) === String(userId)) return true;

    // Client must not be revoked
    const user = (data.allowedUsers || []).find(u => String(u.userId) === String(userId));
    return !!(user && !user.isRevoked);
  },

  deleteSessionsForUser(userId) {
    const idStr = String(userId);
    const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
    if (!adminId || idStr !== String(adminId)) {
      this.purgeUserData(idStr);
      const data = readDb();
      data.allowedUsers = (data.allowedUsers || []).filter(u => String(u.userId) !== idStr);
      writeDb(data);
    } else {
      const data = readDb();
      data.sessions = (data.sessions || []).filter(s => String(s.userId) !== idStr);
      writeDb(data);
    }
  },

  // ─── Allowed Users ────────────────────────────────────────────────────
  addAllowedUser(userId) {
    const data = readDb();
    if (!data.allowedUsers) data.allowedUsers = [];
    const idStr = String(userId);
    const existing = data.allowedUsers.findIndex(u => String(u.userId) === idStr);
    if (existing !== -1) {
      data.allowedUsers[existing].loginTime = new Date().toISOString();
    } else {
      data.allowedUsers.push({ userId: idStr, loginTime: new Date().toISOString(), uploadCount: 0, isRevoked: false });
    }
    writeDb(data);
  },

  isUserAllowed(userId) {
    const data = readDb();
    const idStr = String(userId);
    const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
    if (adminId && String(adminId) === idStr) return true;
    const user = (data.allowedUsers || []).find(u => String(u.userId) === idStr);
    return !!user; // Valid if present in list
  },

  getAllowedUsers() { return readDb().allowedUsers || []; },

  revokeUser(userId) {
    const idStr = String(userId);
    this.purgeUserData(idStr);
    const data = readDb();
    data.allowedUsers = (data.allowedUsers || []).filter(u => String(u.userId) !== idStr);
    writeDb(data);
  },

  purgeUserData(userId) {
    const data = readDb();
    const idStr = String(userId);

    // 1. Remove their added Instagram accounts
    data.accounts = (data.accounts || []).filter(a => String(a.telegramOwner) !== idStr);

    // 2. Find and delete their queued media files from disk
    const userMedia = (data.media || []).filter(m => String(m.telegramUserId) === idStr);
    userMedia.forEach(m => {
      if (m.localPath) {
        const absolutePath = paths.resolveMedia(m.localPath);
        if (fs.existsSync(absolutePath)) {
          try { fs.unlinkSync(absolutePath); } catch (e) { /* ignore */ }
        }
      }
    });

    // 3. Remove their media records from db
    data.media = (data.media || []).filter(m => String(m.telegramUserId) !== idStr);

    // 4. Remove active sessions
    data.sessions = (data.sessions || []).filter(s => String(s.userId) !== idStr);

    writeDb(data);
  },

  incrementUploadCount(userId) {
    const data = readDb();
    const idStr = String(userId);
    const user = (data.allowedUsers || []).find(u => String(u.userId) === idStr);
    if (user) { user.uploadCount = (user.uploadCount || 0) + 1; writeDb(data); }
  },

  // ─── Cloudinary Config ────────────────────────────────────────────────
  getCloudinaryConfig(userId) {
    const data = readDb();
    const idStr = String(userId);
    const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
    
    if (adminId && idStr === String(adminId)) {
      if (data.adminCloudinary) return data.adminCloudinary;
      // Fallback to Env vars for admin
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        return {
          cloudName: process.env.CLOUDINARY_CLOUD_NAME,
          apiKey: process.env.CLOUDINARY_API_KEY,
          apiSecret: process.env.CLOUDINARY_API_SECRET
        };
      }
      return null;
    }
    
    const user = (data.allowedUsers || []).find(u => String(u.userId) === idStr);
    return user ? (user.cloudinary || null) : null;
  },

  setCloudinaryConfig(userId, { cloudName, apiKey, apiSecret }) {
    const data = readDb();
    const idStr = String(userId);
    const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
    const configObj = { cloudName: cloudName.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim() };

    if (adminId && idStr === String(adminId)) {
      data.adminCloudinary = configObj;
    } else {
      const idx = (data.allowedUsers || []).findIndex(u => String(u.userId) === idStr);
      if (idx !== -1) {
        data.allowedUsers[idx].cloudinary = configObj;
      }
    }
    writeDb(data);
  }
};

module.exports = db;
