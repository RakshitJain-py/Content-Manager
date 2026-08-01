import { Pool } from "pg";
import bcrypt from "bcryptjs";

// Connection pool for PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export const db = {
  async query(text: string, params?: any[]) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err: any) {
      console.error("Database query error:", err.message);
      throw err;
    }
  },

  // ─── Authentication ───────────────────────────────────────────────────
  
  async createUser(email: string, passwordPlain: string) {
    const hash = await bcrypt.hash(passwordPlain, 10);
    const res = await this.query(
      `INSERT INTO users (email, password_hash, access_granted) VALUES ($1, $2, FALSE) RETURNING id, email, access_granted, created_at`,
      [email.toLowerCase().trim(), hash]
    );
    return res.rows[0];
  },

  async getUserByEmail(email: string) {
    const res = await this.query(
      `SELECT * FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    return res.rows[0] || null;
  },

  async getAdminByTelegramId(telegramId: string) {
    const res = await this.query(
      `SELECT * FROM admins WHERE telegram_id = $1`,
      [String(telegramId).trim()]
    );
    return res.rows[0] || null;
  },

  async createAdmin(telegramId: string, passwordPlain: string) {
    const hash = await bcrypt.hash(passwordPlain, 10);
    const res = await this.query(
      `INSERT INTO admins (telegram_id, password_hash) VALUES ($1, $2) 
       ON CONFLICT (telegram_id) DO UPDATE SET password_hash = $2
       RETURNING telegram_id, created_at`,
      [String(telegramId).trim(), hash]
    );
    return res.rows[0];
  },

  // Seed default admin and run schema upgrades from environment variables if not present
  async seedAdminIfNeeded() {
    // Schema upgrade migrations (safe ALTER TABLE)
    try {
      await this.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS caption TEXT DEFAULT ''");
      await this.query("ALTER TABLE admins ADD COLUMN IF NOT EXISTS caption TEXT DEFAULT ''");
    } catch (e: any) {
      console.warn("Schema upgrade warning (non-fatal):", e.message);
    }

    const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    if (adminId) {
      const admin = await this.getAdminByTelegramId(adminId);
      if (!admin) {
        console.log(`Seeding default admin with Telegram ID: ${adminId}`);
        await this.createAdmin(adminId, adminPassword);
      }
    }
  },

  // ─── Sessions ─────────────────────────────────────────────────────────

  async createSession(token: string, ownerId: string, role: "user" | "admin") {
    // Delete existing sessions for this owner to keep only one active
    await this.query("DELETE FROM cm_sessions WHERE owner_id = $1", [ownerId]);
    await this.query(
      "INSERT INTO cm_sessions (token, owner_id, role) VALUES ($1, $2, $3)",
      [token, ownerId, role]
    );
  },

  async validateSession(token: string) {
    if (!token) return null;
    const res = await this.query(
      "SELECT owner_id, role FROM cm_sessions WHERE token = $1",
      [token]
    );
    if (res.rows.length === 0) return null;
    
    const session = res.rows[0];
    // Check if user/admin still exists
    if (session.role === "admin") {
      const admin = await this.getAdminByTelegramId(session.owner_id);
      // Admins always have full access
      return admin ? { ownerId: session.owner_id, role: "admin", accessGranted: true } : null;
    } else {
      const user = await this.getUserByEmail(session.owner_id);
      return user ? { ownerId: session.owner_id, role: "user", accessGranted: !!user.access_granted } : null;
    }
  },

  async deleteSession(token: string) {
    await this.query("DELETE FROM cm_sessions WHERE token = $1", [token]);
  },

  async deleteSessionsForOwner(ownerId: string) {
    await this.query("DELETE FROM cm_sessions WHERE owner_id = $1", [ownerId]);
  },

  // ─── Media ────────────────────────────────────────────────────────────

  async getAllMedia(ownerId?: string, role?: string) {
    let res;
    if (ownerId && role !== "admin") {
      // Users only see their own media
      res = await this.query(
        "SELECT * FROM media WHERE owner_id = $1 ORDER BY timestamp DESC",
        [ownerId]
      );
    } else {
      // Admins see all media
      res = await this.query("SELECT * FROM media ORDER BY timestamp DESC");
    }
    return res.rows.map(m => this.mapMediaRow(m));
  },

  async getMediaById(id: string) {
    const res = await this.query("SELECT * FROM media WHERE id = $1", [String(id)]);
    return res.rows.length > 0 ? this.mapMediaRow(res.rows[0]) : null;
  },

  async getPendingMedia(ownerId?: string, role?: string) {
    let res;
    if (ownerId && role !== "admin") {
      res = await this.query(
        "SELECT * FROM media WHERE status = $1 AND owner_id = $2 ORDER BY timestamp DESC",
        ["pending", ownerId]
      );
    } else {
      res = await this.query(
        "SELECT * FROM media WHERE status = $1 ORDER BY timestamp DESC",
        ["pending"]
      );
    }
    return res.rows.map(m => this.mapMediaRow(m));
  },

  async getApprovedMedia(ownerId?: string, role?: string) {
    let res;
    if (ownerId && role !== "admin") {
      res = await this.query(
        "SELECT * FROM media WHERE status = $1 AND owner_id = $2 ORDER BY timestamp DESC",
        ["approved", ownerId]
      );
    } else {
      res = await this.query(
        "SELECT * FROM media WHERE status = $1 ORDER BY timestamp DESC",
        ["approved"]
      );
    }
    return res.rows.map(m => this.mapMediaRow(m));
  },

  async addMedia(data: {
    id: string;
    filename: string;
    localPath?: string;
    mediaType: string;
    ownerId: string;
    ownerRole: string;
  }) {
    const res = await this.query(
      `INSERT INTO media (id, filename, local_path, media_type, owner_id, owner_role, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [data.id, data.filename, data.localPath || null, data.mediaType, data.ownerId, data.ownerRole]
    );
    return this.mapMediaRow(res.rows[0]);
  },

  async updateMedia(id: string, updates: Record<string, any>) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const mappings: Record<string, string> = {
      status: "status",
      cloudinaryUrl: "cloudinary_url",
      instagramMediaId: "instagram_media_id",
      publishedAt: "published_at",
      coverUrl: "cover_url",
      error: "error",
      hideLikes: "hide_likes",
      disableComments: "disable_comments",
      shareToFeed: "share_to_feed"
    };

    for (const [key, val] of Object.entries(updates)) {
      const sqlField = mappings[key] || key;
      if (mappings[key]) {
        fields.push(`${sqlField} = $${idx}`);
        values.push(val);
        idx++;
      }
    }

    if (fields.length === 0) return this.getMediaById(id);

    values.push(String(id));
    await this.query(
      `UPDATE media SET ${fields.join(", ")} WHERE id = $${idx}`,
      values
    );

    return this.getMediaById(id);
  },

  async removeMedia(id: string) {
    const item = await this.getMediaById(id);
    if (item) {
      await this.query("DELETE FROM media WHERE id = $1", [String(id)]);
    }
    return item;
  },

  // ─── Accounts ─────────────────────────────────────────────────────────

  async getAccounts(ownerId: string, role?: string) {
    let res;
    if (role === "admin") {
      res = await this.query("SELECT * FROM accounts WHERE is_active = TRUE");
    } else {
      res = await this.query("SELECT * FROM accounts WHERE owner_id = $1 AND is_active = TRUE", [ownerId]);
    }
    return res.rows.map(a => ({
      id: a.id,
      name: a.name,
      ownerId: a.owner_id,
      ownerRole: a.owner_role,
      accessToken: a.access_token,
      isActive: a.is_active
    }));
  },

  async getAccountById(id: string) {
    const res = await this.query("SELECT * FROM accounts WHERE id = $1", [String(id)]);
    if (res.rows.length === 0) return null;
    const a = res.rows[0];
    return {
      id: a.id,
      name: a.name,
      ownerId: a.owner_id,
      ownerRole: a.owner_role,
      accessToken: a.access_token,
      isActive: a.is_active
    };
  },

  async addAccount(data: {
    id: string;
    name: string;
    ownerId: string;
    ownerRole: string;
    accessToken: string;
    isActive?: boolean;
  }) {
    const activeVal = data.isActive !== false; // defaults to true
    // Delete existing account if matches id to prevent duplicates
    await this.query("DELETE FROM accounts WHERE id = $1 AND owner_id = $2", [data.id, data.ownerId]);
    const res = await this.query(
      `INSERT INTO accounts (id, name, owner_id, owner_role, access_token, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.id, data.name, data.ownerId, data.ownerRole, data.accessToken, activeVal]
    );
    const a = res.rows[0];
    return {
      id: a.id,
      name: a.name,
      ownerId: a.owner_id,
      ownerRole: a.owner_role,
      accessToken: a.access_token,
      isActive: a.is_active
    };
  },

  async updateAccount(id: string, updates: Record<string, any>) {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const mappings: Record<string, string> = {
      isActive: "is_active",
      name: "name",
      accessToken: "access_token"
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
    await this.query(
      `UPDATE accounts SET ${fields.join(", ")} WHERE id = $${idx}`,
      values
    );

    const res = await this.query("SELECT * FROM accounts WHERE id = $1", [String(id)]);
    if (res.rows.length === 0) return null;
    const a = res.rows[0];
    return {
      id: a.id,
      name: a.name,
      ownerId: a.owner_id,
      ownerRole: a.owner_role,
      accessToken: a.access_token,
      isActive: a.is_active
    };
  },

  async removeAccount(id: string) {
    const res = await this.query("SELECT * FROM accounts WHERE id = $1", [String(id)]);
    if (res.rows.length === 0) return null;
    const a = res.rows[0];
    await this.query("DELETE FROM accounts WHERE id = $1", [String(id)]);
    return {
      id: a.id,
      name: a.name,
      ownerId: a.owner_id,
      ownerRole: a.owner_role,
      accessToken: a.access_token,
      isActive: a.is_active
    };
  },

  async getCaption(ownerId: string, role: "user" | "admin") {
    const table = role === "admin" ? "admins" : "users";
    const keyColumn = role === "admin" ? "telegram_id" : "email";
    
    const res = await this.query(`SELECT caption FROM ${table} WHERE ${keyColumn} = $1`, [ownerId]);
    return res.rows.length > 0 ? res.rows[0].caption || "" : "";
  },

  async setCaption(ownerId: string, role: "user" | "admin", caption: string) {
    const table = role === "admin" ? "admins" : "users";
    const keyColumn = role === "admin" ? "telegram_id" : "email";

    await this.query(`UPDATE ${table} SET caption = $1 WHERE ${keyColumn} = $2`, [caption, ownerId]);
  },

  // Helper mapping database rows to camelCase schema
  mapMediaRow(row: any) {
    if (!row) return null;
    return {
      id: row.id,
      filename: row.filename,
      localPath: row.local_path,
      mediaType: row.media_type,
      ownerId: row.owner_id,
      ownerRole: row.owner_role,
      status: row.status,
      cloudinaryUrl: row.cloudinary_url,
      instagramMediaId: row.instagram_media_id,
      timestamp: row.timestamp,
      publishedAt: row.published_at,
      coverUrl: row.cover_url,
      error: row.error,
      hideLikes: row.hide_likes,
      disableComments: row.disable_comments,
      shareToFeed: row.share_to_feed
    };
  }
};
