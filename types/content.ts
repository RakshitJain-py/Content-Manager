/**
 * Domain types for Content Manager.
 *
 * These are the shapes the UI reads/writes today (frontend-only, local state).
 * When a backend is added in Next.js, these same types should describe the
 * API/database rows so no component needs to change.
 */

/** An Instagram account the user can publish to. */
export interface Account {
  /** Client-side unique id (would be a DB primary key later). */
  id: string;
  /** Display handle, e.g. "@studio.main". */
  name: string;
  /** Instagram numeric business account id. */
  igId: string;
  /** Long-lived access token. Never rendered in plain text in the UI. */
  token: string;
  /** How many more posts can be published to this account today (max 20). */
  postsRemaining: number;
  /** ISO timestamp when the daily quota resets; null if never published. */
  quotaResetAt: string | null;
}

/** Payload used when creating a new account (no id yet, no server-side quota fields). */
export interface AccountDraft {
  name: string;
  igId: string;
  token: string;
}

/** A single uploaded media file waiting in the publish queue. */
export interface MediaItem {
  id: string;
  /** Original file name from the device. */
  name: string;
  /** Object URL (or remote URL once storage is wired up). */
  url: string;
  /** Discriminates image vs video rendering. */
  kind: "image" | "video";
}

/** The kind of Instagram content being composed. */
export type ContentType = "post" | "reel" | "story" | "history";

/** Sign-in role chosen on /login. `null` means no role picked yet. */
export type AuthRole = "user" | "admin" | null;

/** Credentials collected by the login form (never sent anywhere yet). */
export interface AuthCredentials {
  /** Email for users, Telegram user id for admins. */
  identifier: string;
  password: string;
}

/** Generates a short client-side id for local-only records. */
export const createId = (): string => Math.random().toString(36).slice(2, 9);
