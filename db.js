const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const db = {
  // Helper to query PostgreSQL
  async query(text, params) {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      console.error('Database query error:', err.message);
      throw err;
    }
  },

  // ─── Media ────────────────────────────────────────────────────────────
  async getAll() {
    const res = await this.query('SELECT * FROM media ORDER BY timestamp DESC');
    return res.rows.map(m => this.mapMediaRow(m));
  },

  async getById(id) {
    const res = await this.query('SELECT * FROM media WHERE id = $1', [String(id)]);
    return res.rows.length > 0 ? this.mapMediaRow(res.rows[0]) : null;
  },

  async getPending() {
    const res = await this.query('SELECT * FROM media WHERE status = $1 ORDER BY timestamp DESC', ['pending']);
    return res.rows.map(m => this.mapMediaRow(m));
  },

  async getApproved() {
    const res = await this.query('SELECT * FROM media WHERE status = $1 ORDER BY timestamp DESC', ['approved']);
    return res.rows.map(m => this.mapMediaRow(m));
  },

  async add({ id, filename, localPath, mediaType, telegramUser, telegramUserId }) {
    const idStr = String(id || Date.now());
    const res = await this.query(`
      INSERT INTO media (id, filename, local_path, media_type, telegram_user, telegram_user_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `, [idStr, filename, localPath, mediaType, telegramUser, String(telegramUserId)]);
    return this.mapMediaRow(res.rows[0]);
  },

  async update(id, updates) {
    const fields = [];
    const values = [];
    let idx = 1;

    // Map JS camelCase back to SQL snake_case
    const mappings = {
      status: 'status',
      cloudinaryUrl: 'cloudinary_url',
      instagramMediaId: 'instagram_media_id',
      publishedAt: 'published_at',
      coverUrl: 'cover_url',
      error: 'error',
      telegramUserId: 'telegram_user_id'
    };

    for (const [key, val] of Object.entries(updates)) {
      const sqlField = mappings[key] || key;
      fields.push(`${sqlField} = $${idx}`);
      values.push(val);
      idx++;
    }

    if (fields.length === 0) return this.getById(id);

    values.push(String(id));
    await this.query(`
      UPDATE media
      SET ${fields.join(', ')}
      WHERE id = $${idx}
    `, values);

    return this.getById(id);
  },

  async remove(id) {
    const item = await this.getById(id);
    if (item) {
      await this.query('DELETE FROM media WHERE id = $1', [String(id)]);
    }
    return item;
  },

  // ─── Accounts ─────────────────────────────────────────────────────────
  async getAccounts(telegramOwner) {
    if (!telegramOwner) return [];
    const res = await this.query('SELECT * FROM accounts WHERE telegram_owner = $1', [String(telegramOwner)]);
    return res.rows.map(a => ({
      id: a.id,
      name: a.name,
      userId: a.user_id,
      accessToken: a.access_token,
      telegramOwner: a.telegram_owner,
      isActive: a.is_active
    }));
  },

  async addAccount({ name, userId, accessToken, telegramOwner }) {
    const idStr = String(userId);
    // Delete existing account if matches userId and owner to prevent duplicates
    await this.query('DELETE FROM accounts WHERE id = $1 AND telegram_owner = $2', [idStr, String(telegramOwner)]);
    const res = await this.query(`
      INSERT INTO accounts (id, name, user_id, access_token, telegram_owner, is_active)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      RETURNING *
    `, [idStr, name, userId, accessToken, String(telegramOwner)]);
    const a = res.rows[0];
    return {
      id: a.id,
      name: a.name,
      userId: a.user_id,
      accessToken: a.access_token,
      telegramOwner: a.telegram_owner,
      isActive: a.is_active
    };
  },

  async updateAccount(id, updates) {
    const fields = [];
    const values = [];
    let idx = 1;

    const mappings = {
      isActive: 'is_active',
      name: 'name',
      accessToken: 'access_token'
    };

    for (const [key, val] of Object.entries(updates)) {
      const sqlField = mappings[key];
      if (sqlField) {
        fields.push(`${sqlField} = $${idx}`);
        values.push(val);
        idx++;
      }
    }

    if (fields.length === 0) return null;

    values.push(String(id));
    await this.query(`
      UPDATE accounts
      SET ${fields.join(', ')}
      WHERE id = $${idx}
    `, values);

    // Get updated account
    const res = await this.query('SELECT * FROM accounts WHERE id = $1', [String(id)]);
    if (res.rows.length === 0) return null;
    const a = res.rows[0];
    return {
      id: a.id,
      name: a.name,
      userId: a.user_id,
      accessToken: a.access_token,
      telegramOwner: a.telegram_owner,
      isActive: a.is_active
    };
  },

  async removeAccount(id) {
    const res = await this.query('SELECT * FROM accounts WHERE id = $1', [String(id)]);
    if (res.rows.length === 0) return null;
    const a = res.rows[0];
    await this.query('DELETE FROM accounts WHERE id = $1', [String(id)]);
    return {
      id: a.id,
      name: a.name,
      userId: a.user_id,
      accessToken: a.access_token,
      telegramOwner: a.telegram_owner,
      isActive: a.is_active
    };
  },

  // ─── OTP ──────────────────────────────────────────────────────────────
  async setOtp(otp) {
    await this.query(`
      INSERT INTO system_settings (key, value)
      VALUES ('current_otp', $1)
      ON CONFLICT (key) DO UPDATE SET value = $1
    `, [String(otp)]);
  },

  async getOtp() {
    const res = await this.query('SELECT value FROM system_settings WHERE key = \'current_otp\'');
    return res.rows.length > 0 ? res.rows[0].value : null;
  },

  async clearOtp() {
    await this.query('DELETE FROM system_settings WHERE key = \'current_otp\'');
  },

  // ─── Preset Cover and Caption ─────────────────────────────────────────
  async getPresetCover() {
    const res = await this.query('SELECT value FROM system_settings WHERE key = \'preset_cover_url\'');
    return res.rows.length > 0 ? res.rows[0].value : '';
  },

  async setPresetCover(url) {
    await this.query(`
      INSERT INTO system_settings (key, value)
      VALUES ('preset_cover_url', $1)
      ON CONFLICT (key) DO UPDATE SET value = $1
    `, [String(url)]);
  },

  async getCaption() {
    const res = await this.query('SELECT value FROM system_settings WHERE key = \'caption\'');
    return res.rows.length > 0 ? res.rows[0].value : '';
  },

  async setCaption(caption) {
    await this.query(`
      INSERT INTO system_settings (key, value)
      VALUES ('caption', $1)
      ON CONFLICT (key) DO UPDATE SET value = $1
    `, [String(caption)]);
  },

  // ─── Sessions ─────────────────────────────────────────────────────────
  async createSession(token, userId) {
    const idStr = String(userId);
    // Delete existing sessions for user to maintain one active session
    await this.query('DELETE FROM sessions WHERE user_id = $1', [idStr]);
    await this.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, idStr]);
  },

  async validateSession(token, userId) {
    if (!token || !userId) return false;
    const idStr = String(userId);
    
    const res = await this.query('SELECT * FROM sessions WHERE token = $1 AND user_id = $2', [token, idStr]);
    if (res.rows.length === 0) return false;

    // Admin is always valid if session exists
    const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
    if (adminId && String(adminId) === idStr) return true;

    // Check if user exists in allowed_users list
    const userRes = await this.query('SELECT * FROM allowed_users WHERE user_id = $1', [idStr]);
    return userRes.rows.length > 0;
  },

  async deleteSessionsForUser(userId) {
    const idStr = String(userId);
    await this.query('DELETE FROM sessions WHERE user_id = $1', [idStr]);
    // Also remove entirely from allowedUsers on logout
    const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
    if (!adminId || idStr !== String(adminId)) {
      await this.purgeUserData(idStr);
      await this.query('DELETE FROM allowed_users WHERE user_id = $1', [idStr]);
    }
  },

  // ─── Allowed Users ────────────────────────────────────────────────────
  async addAllowedUser(userId) {
    const idStr = String(userId);
    const time = new Date().toISOString();
    await this.query(`
      INSERT INTO allowed_users (user_id, login_time, upload_count)
      VALUES ($1, $2, 0)
      ON CONFLICT (user_id) DO UPDATE SET login_time = $2
    `, [idStr, time]);
  },

  async isUserAllowed(userId) {
    const idStr = String(userId);
    const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
    if (adminId && String(adminId) === idStr) return true;
    const res = await this.query('SELECT * FROM allowed_users WHERE user_id = $1', [idStr]);
    return res.rows.length > 0;
  },

  async getAllowedUsers() {
    const res = await this.query('SELECT * FROM allowed_users');
    return res.rows.map(u => ({
      userId: u.user_id,
      loginTime: u.login_time,
      uploadCount: u.upload_count || 0,
      cloudinary: u.cloudinary ? JSON.parse(u.cloudinary) : null
    }));
  },

  async revokeUser(userId) {
    const idStr = String(userId);
    await this.purgeUserData(idStr);
    await this.query('DELETE FROM allowed_users WHERE user_id = $1', [idStr]);
  },

  async purgeUserData(userId) {
    const idStr = String(userId);
    // 1. Remove added Instagram accounts
    await this.query('DELETE FROM accounts WHERE telegram_owner = $1', [idStr]);
    
    // 2. Remove media records from DB
    await this.query('DELETE FROM media WHERE telegram_user_id = $1', [idStr]);

    // 3. Remove active sessions
    await this.query('DELETE FROM sessions WHERE user_id = $1', [idStr]);
  },

  async incrementUploadCount(userId) {
    const idStr = String(userId);
    await this.query('UPDATE allowed_users SET upload_count = upload_count + 1 WHERE user_id = $1', [idStr]);
  },

  // ─── Cloudinary Config ────────────────────────────────────────────────
  async getCloudinaryConfig(userId) {
    const idStr = String(userId);
    const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;

    // Check if admin
    if (adminId && idStr === String(adminId)) {
      const res = await this.query('SELECT value FROM system_settings WHERE key = \'admin_cloudinary\'');
      if (res.rows.length > 0 && res.rows[0].value) {
        return JSON.parse(res.rows[0].value);
      }
      // Fallback to env variables
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        return {
          cloudName: process.env.CLOUDINARY_CLOUD_NAME,
          apiKey: process.env.CLOUDINARY_API_KEY,
          apiSecret: process.env.CLOUDINARY_API_SECRET
        };
      }
      return null;
    }

    const res = await this.query('SELECT cloudinary FROM allowed_users WHERE user_id = $1', [idStr]);
    if (res.rows.length > 0 && res.rows[0].cloudinary) {
      return JSON.parse(res.rows[0].cloudinary);
    }
    return null;
  },

  async setCloudinaryConfig(userId, { cloudName, apiKey, apiSecret }) {
    const idStr = String(userId);
    const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
    const configStr = JSON.stringify({ cloudName: cloudName.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim() });

    if (adminId && idStr === String(adminId)) {
      await this.query(`
        INSERT INTO system_settings (key, value)
        VALUES ('admin_cloudinary', $1)
        ON CONFLICT (key) DO UPDATE SET value = $1
      `, [configStr]);
    } else {
      await this.query('UPDATE allowed_users SET cloudinary = $1 WHERE user_id = $2', [configStr, idStr]);
    }
  },

  // Helper mapping database rows to JS camelCase schema
  mapMediaRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      filename: row.filename,
      localPath: row.local_path,
      mediaType: row.media_type,
      telegramUser: row.telegram_user,
      telegramUserId: row.telegram_user_id,
      status: row.status,
      cloudinaryUrl: row.cloudinary_url,
      instagramMediaId: row.instagram_media_id,
      timestamp: row.timestamp,
      publishedAt: row.published_at,
      coverUrl: row.cover_url,
      error: row.error
    };
  }
};

module.exports = db;
