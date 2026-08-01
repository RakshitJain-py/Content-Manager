"use client";

import { useEffect, useState } from "react";
import { getCurrentSession } from "@/app/actions/auth";

export interface SessionInfo {
  role: "user" | "admin";
  ownerId: string;
  /** Display name: "Admin" for admins, "user123456" style for users */
  displayName: string;
  /** True if admin granted the user access to publish/schedule */
  accessGranted: boolean;
}

/**
 * Generates a stable short username from an email.
 * e.g. "user247358" derived from the email string.
 */
function emailToUsername(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  return `user${String(hash).slice(0, 6).padStart(6, "0")}`;
}

export function useSession() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentSession()
      .then((res) => {
        if (res && res.success && res.ownerId && res.role) {
          setSession({
            role: res.role,
            ownerId: res.ownerId,
            displayName:
              res.role === "admin" ? "Admin" : emailToUsername(res.ownerId),
            accessGranted: res.role === "admin" ? true : (res.accessGranted ?? false),
          });
        } else {
          setSession(null);
        }
      })
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  return { session, loading };
}
