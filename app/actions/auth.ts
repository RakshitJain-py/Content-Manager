"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const SESSION_COOKIE_NAME = "cm_session_token";

// Helper to generate a secure session token
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export interface AuthResponse {
  success: boolean;
  error?: string;
  role?: "user" | "admin";
  ownerId?: string;
  accessGranted?: boolean;
}

/**
 * Sign up a new user with email and password
 */
export async function signUpUser(email: string, passwordPlain: string): Promise<AuthResponse> {
  try {
    if (!email || !passwordPlain) {
      return { success: false, error: "Email and password are required." };
    }

    if (passwordPlain.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }

    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return { success: false, error: "An account with this email already exists." };
    }

    const newUser = await db.createUser(email, passwordPlain);
    const token = generateSessionToken();
    await db.createSession(token, newUser.email, "user");

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/"
    });

    return { success: true, role: "user", ownerId: newUser.email };
  } catch (err: any) {
    console.error("SignUp error:", err);
    return { success: false, error: "Internal server error." };
  }
}

/**
 * Sign in user with email and password
 */
export async function signInUser(email: string, passwordPlain: string): Promise<AuthResponse> {
  try {
    if (!email || !passwordPlain) {
      return { success: false, error: "Email and password are required." };
    }

    const user = await db.getUserByEmail(email);
    if (!user) {
      return { success: false, error: "Invalid email or password." };
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!isMatch) {
      return { success: false, error: "Invalid email or password." };
    }

    const token = generateSessionToken();
    await db.createSession(token, user.email, "user");

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/"
    });

    return { success: true, role: "user", ownerId: user.email };
  } catch (err: any) {
    console.error("SignIn user error:", err);
    return { success: false, error: "Internal server error." };
  }
}

/**
 * Sign in admin with Telegram User ID and password
 */
export async function signInAdmin(telegramId: string, passwordPlain: string): Promise<AuthResponse> {
  try {
    if (!telegramId || !passwordPlain) {
      return { success: false, error: "Telegram User ID and password are required." };
    }

    // Seed default admin first if it doesn't exist
    await db.seedAdminIfNeeded();

    const admin = await db.getAdminByTelegramId(telegramId);
    if (!admin) {
      return { success: false, error: "Invalid Telegram ID or password." };
    }

    const isMatch = await bcrypt.compare(passwordPlain, admin.password_hash);
    if (!isMatch) {
      return { success: false, error: "Invalid Telegram ID or password." };
    }

    const token = generateSessionToken();
    await db.createSession(token, admin.telegram_id, "admin");

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/"
    });

    return { success: true, role: "admin", ownerId: admin.telegram_id };
  } catch (err: any) {
    console.error("SignIn admin error:", err);
    return { success: false, error: "Internal server error." };
  }
}

/**
 * Sign out current session
 */
export async function signOut(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      await db.deleteSession(token);
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
    return { success: true };
  } catch (err) {
    console.error("SignOut error:", err);
    return { success: false };
  }
}

/**
 * Get current session details
 */
export async function getCurrentSession(): Promise<AuthResponse | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const session = await db.validateSession(token);
    if (!session) {
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    return {
      success: true,
      role: session.role as "user" | "admin",
      ownerId: session.ownerId,
      accessGranted: session.accessGranted
    };
  } catch (err) {
    console.error("GetCurrentSession error:", err);
    return null;
  }
}
