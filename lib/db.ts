import { Pool } from "pg";
import bcrypt from "bcryptjs";

let pool: Pool;

if (process.env.NODE_ENV === "production") {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  if (!(global as any).pgPool) {
    (global as any).pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  pool = (global as any).pgPool;
}

// Run database migrations on pool initialization
pool.query(`
  CREATE TABLE IF NOT EXISTS configurations (
    id SERIAL PRIMARY KEY,
    owner_id VARCHAR(255) NOT NULL,
    owner_role VARCHAR(50) NOT NULL,
    content_type VARCHAR(50) DEFAULT 'post',
    caption TEXT DEFAULT '',
    cover_url TEXT DEFAULT '',
    story_link TEXT DEFAULT '',
    options JSONB DEFAULT '{}'::jsonb
  );
  
  -- Drop legacy constraints and create unified one
  ALTER TABLE configurations DROP CONSTRAINT IF EXISTS unique_owner;
  ALTER TABLE configurations DROP CONSTRAINT IF EXISTS unique_owner_content_type;
  ALTER TABLE configurations ADD CONSTRAINT unique_owner_content_type UNIQUE (owner_id, owner_role, content_type);
`).then(() => {
  console.log("[DB] Configurations table schema and unique constraint updated.");
}).catch((err) => {
  console.error("[DB] Migration error during startup:", err.message);
});

// Media table column migrations — run on every module load so new columns are always present
pool.query(`
  ALTER TABLE media ADD COLUMN IF NOT EXISTS caption TEXT DEFAULT '';
  ALTER TABLE media ADD COLUMN IF NOT EXISTS permalink TEXT DEFAULT '';
  ALTER TABLE media ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
  CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL
  );
  INSERT INTO system_settings (key, value) 
  VALUES ('admin_telegram_username', '@admin_placeholder') 
  ON CONFLICT (key) DO NOTHING;
`).then(() => {
  console.log("[DB] Media table columns and system_settings table ensured.");
}).catch((err) => {
  console.error("[DB] Media migration error:", err.message);
});

// Rate limiting and account quota migrations
pool.query(`
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS posts_remaining INTEGER NOT NULL DEFAULT 20;
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS quota_reset_at TIMESTAMPTZ;
  CREATE TABLE IF NOT EXISTS rate_limit_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    ops_used INTEGER NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rate_limit_windows_user_id_unique UNIQUE (user_id)
  );
`).then(() => {
  console.log("[DB] Rate limiting tables and columns ensured.");
}).catch((err) => {
  console.error("[DB] Rate limiting migration error:", err.message);
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

  async searchUsers(searchQuery: string) {
    // Helper to generate dynamic username matching the frontend useSession logic
    const emailToUsername = (email: string): string => {
      let hash = 0;
      for (let i = 0; i < email.length; i++) {
        hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
      }
      return `user${String(hash).slice(0, 6).padStart(6, "0")}`;
    };

    const res = await this.query(
      `SELECT id, email, access_granted as "accessGranted", created_at as "createdAt"
       FROM users`
    );

    const term = searchQuery.toLowerCase().trim();

    const mapped = res.rows.map(row => {
      const username = emailToUsername(row.email);
      return {
        id: row.id,
        email: row.email,
        username,
        accessGranted: row.accessGranted,
        createdAt: row.createdAt
      };
    });

    if (!term) return mapped.slice(0, 50);

    return mapped
      .filter(u => u.email.toLowerCase().includes(term) || u.username.toLowerCase().includes(term))
      .slice(0, 50);
  },

  async updateUserAccess(email: string, accessGranted: boolean) {
    const res = await this.query(
      `UPDATE users 
       SET access_granted = $1 
       WHERE email = $2 
       RETURNING id, email, access_granted as "accessGranted"`,
      [accessGranted, email.toLowerCase().trim()]
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
    // Schema upgrade migrations (safe ALTER TABLE & CREATE TABLE)
    try {
      await this.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS caption TEXT DEFAULT ''");
      await this.query("ALTER TABLE admins ADD COLUMN IF NOT EXISTS caption TEXT DEFAULT ''");
      await this.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb");
      await this.query("ALTER TABLE admins ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb");
      await this.query("ALTER TABLE media ADD COLUMN IF NOT EXISTS caption TEXT DEFAULT ''");
      await this.query("ALTER TABLE media ADD COLUMN IF NOT EXISTS permalink TEXT DEFAULT ''");
      
      // Create dedicated configurations table
      await this.query(`
        CREATE TABLE IF NOT EXISTS configurations (
          id SERIAL PRIMARY KEY,
          owner_id VARCHAR(255) NOT NULL,
          owner_role VARCHAR(50) NOT NULL,
          content_type VARCHAR(50) DEFAULT 'post',
          caption TEXT DEFAULT '',
          cover_url TEXT DEFAULT '',
          story_link TEXT DEFAULT '',
          options JSONB DEFAULT '{}'::jsonb,
          CONSTRAINT unique_owner UNIQUE (owner_id, owner_role)
        );
      `);
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

  async getPublishedCount24h(ownerId: string): Promise<number> {
    const res = await this.query(
      "SELECT COUNT(*)::int as count FROM media WHERE owner_id = $1 AND status = 'published' AND published_at >= NOW() - INTERVAL '24 hours'",
      [ownerId]
    );
    return res.rows[0].count;
  },

  /** Get total active workspace size in bytes for a user (pending media only). */
  async getWorkspaceSizeBytes(ownerId: string): Promise<number> {
    const res = await this.query(
      "SELECT COALESCE(SUM(file_size), 0)::bigint as total FROM media WHERE owner_id = $1 AND status = 'pending'",
      [ownerId]
    );
    return Number(res.rows[0].total);
  },

  async getActiveMediaCount(ownerId: string): Promise<number> {
    const res = await this.query(
      "SELECT COUNT(*)::int as count FROM media WHERE owner_id = $1 AND status = 'pending'",
      [ownerId]
    );
    return res.rows[0].count;
  },

  // ─── Rate Limit Windows ───────────────────────────────────────────────

  async getRateLimitWindow(userId: string): Promise<{ opsUsed: number; windowStartedAt: Date } | null> {
    const res = await this.query(
      "SELECT ops_used, window_started_at FROM rate_limit_windows WHERE user_id = $1",
      [userId]
    );
    if (res.rows.length === 0) return null;
    return {
      opsUsed: res.rows[0].ops_used,
      windowStartedAt: new Date(res.rows[0].window_started_at),
    };
  },

  async upsertRateLimitWindow(userId: string, opsUsed: number, windowStartedAt: Date): Promise<void> {
    await this.query(
      `INSERT INTO rate_limit_windows (user_id, ops_used, window_started_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET ops_used = $2, window_started_at = $3`,
      [userId, opsUsed, windowStartedAt.toISOString()]
    );
  },

  /** Decrement posts_remaining for an account; set quota_reset_at on first publish. */
  async decrementAccountQuota(accountId: string): Promise<void> {
    // Check if quota_reset_at is NULL (first publish) or has already expired
    const res = await this.query(
      "SELECT posts_remaining, quota_reset_at FROM accounts WHERE id = $1",
      [accountId]
    );
    if (res.rows.length === 0) return;
    const { quota_reset_at } = res.rows[0];

    // If reset time has passed, reset the counter first
    if (quota_reset_at && new Date() >= new Date(quota_reset_at)) {
      await this.query(
        "UPDATE accounts SET posts_remaining = 19, quota_reset_at = NOW() + INTERVAL '24 hours 5 minutes' WHERE id = $1",
        [accountId]
      );
    } else if (!quota_reset_at) {
      // First publish ever for this account
      await this.query(
        "UPDATE accounts SET posts_remaining = GREATEST(posts_remaining - 1, 0), quota_reset_at = NOW() + INTERVAL '24 hours 5 minutes' WHERE id = $1",
        [accountId]
      );
    } else {
      // Normal decrement
      await this.query(
        "UPDATE accounts SET posts_remaining = GREATEST(posts_remaining - 1, 0) WHERE id = $1",
        [accountId]
      );
    }
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
      shareToFeed: "share_to_feed",
      caption: "caption",
      permalink: "permalink",
      fileSize: "file_size",
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
    return res.rows.map(a => {
      // Lazily resolve quota: if reset time has passed, treat as 20
      let postsRemaining: number = a.posts_remaining ?? 20;
      let quotaResetAt: string | null = a.quota_reset_at ? new Date(a.quota_reset_at).toISOString() : null;
      if (quotaResetAt && new Date() >= new Date(quotaResetAt)) {
        postsRemaining = 20;
        quotaResetAt = null; // will be reset on next publish
      }
      return {
        id: a.id,
        name: a.name,
        ownerId: a.owner_id,
        ownerRole: a.owner_role,
        accessToken: a.access_token,
        isActive: a.is_active,
        postsRemaining,
        quotaResetAt,
      };
    });
  },

  async getAccountById(id: string) {
    const res = await this.query("SELECT * FROM accounts WHERE id = $1", [String(id)]);
    if (res.rows.length === 0) return null;
    const a = res.rows[0];
    let postsRemaining: number = a.posts_remaining ?? 20;
    let quotaResetAt: string | null = a.quota_reset_at ? new Date(a.quota_reset_at).toISOString() : null;
    if (quotaResetAt && new Date() >= new Date(quotaResetAt)) {
      postsRemaining = 20;
      quotaResetAt = null;
    }
    return {
      id: a.id,
      name: a.name,
      ownerId: a.owner_id,
      ownerRole: a.owner_role,
      accessToken: a.access_token,
      isActive: a.is_active,
      postsRemaining,
      quotaResetAt,
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

  async getCaption(ownerId: string, role: "user" | "admin", contentType: string) {
    const res = await this.query(
      `SELECT caption FROM configurations WHERE owner_id = $1 AND owner_role = $2 AND content_type = $3`,
      [ownerId, role, contentType]
    );
    return res.rows.length > 0 ? res.rows[0].caption || "" : "";
  },

  async setCaption(ownerId: string, role: "user" | "admin", contentType: string, caption: string) {
    await this.query(
      `INSERT INTO configurations (owner_id, owner_role, content_type, caption)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (owner_id, owner_role, content_type)
       DO UPDATE SET caption = EXCLUDED.caption`,
      [ownerId, role, contentType, caption]
    );
  },

  async getSettings(ownerId: string, role: "user" | "admin", contentType: string) {
    const res = await this.query(
      `SELECT caption, cover_url, story_link, options FROM configurations WHERE owner_id = $1 AND owner_role = $2 AND content_type = $3`,
      [ownerId, role, contentType]
    );
    if (res.rows.length === 0) return {};
    const row = res.rows[0];
    return {
      contentType,
      caption: row.caption,
      coverUrl: row.cover_url,
      storyLink: row.story_link,
      options: row.options || {},
    };
  },

  async setSettings(ownerId: string, role: "user" | "admin", contentType: string, settings: any) {
    const optionsJson = typeof settings.options === "string" ? settings.options : JSON.stringify(settings.options || {});
    await this.query(
      `INSERT INTO configurations (owner_id, owner_role, content_type, caption, cover_url, story_link, options)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (owner_id, owner_role, content_type)
       DO UPDATE SET
         caption = EXCLUDED.caption,
         cover_url = EXCLUDED.cover_url,
         story_link = EXCLUDED.story_link,
         options = EXCLUDED.options`,
      [
        ownerId,
        role,
        contentType,
        settings.caption || "",
        settings.coverUrl || "",
        settings.storyLink || "",
        optionsJson
      ]
    );
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
      shareToFeed: row.share_to_feed,
      caption: row.caption || "",
      permalink: row.permalink || "",
      fileSize: Number(row.file_size) || 0,
    };
  },

  async getSystemSetting(key: string): Promise<string | null> {
    const res = await this.query("SELECT value FROM system_settings WHERE key = $1", [key]);
    return res.rows.length > 0 ? res.rows[0].value : null;
  },

  async setSystemSetting(key: string, value: string): Promise<void> {
    await this.query(
      "INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [key, value]
    );
  }
};
