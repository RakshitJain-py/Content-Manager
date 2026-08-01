"use client";

import { useCallback, useState } from "react";
import type { AuthCredentials, AuthRole } from "@/types/content";

/**
 * Login screen state: chosen role and the credential fields.
 *
 * No network calls yet. When auth is wired up in Next.js, add a `signIn`
 * implementation here (server action / API route) — the form component keeps
 * the exact same props.
 */
export interface UseAuthResult {
  /** `null` until the user picks "user" or "admin". */
  role: AuthRole;
  /** Pick a role (or pass `null` to go back to role selection). */
  selectRole: (role: AuthRole) => void;
  /** Current field values; `identifier` is email for users, Telegram id for admins. */
  credentials: AuthCredentials;
  /** Update one credential field. */
  setCredential: (field: keyof AuthCredentials, value: string) => void;
  /** Label for the identifier field, derived from the role. */
  identifierLabel: string;
  /** Placeholder for the identifier field, derived from the role. */
  identifierPlaceholder: string;
}

export function useAuth(): UseAuthResult {
  const [role, setRole] = useState<AuthRole>(null);
  const [credentials, setCredentials] = useState<AuthCredentials>({ identifier: "", password: "" });

  const selectRole = useCallback((next: AuthRole) => {
    setRole(next);
    setCredentials({ identifier: "", password: "" });
  }, []);

  const setCredential = useCallback((field: keyof AuthCredentials, value: string) => {
    setCredentials((c) => ({ ...c, [field]: value }));
  }, []);

  return {
    role,
    selectRole,
    credentials,
    setCredential,
    identifierLabel: role === "admin" ? "Telegram User ID" : "Email",
    identifierPlaceholder: role === "admin" ? "123456789" : "you@example.com",
  };
}

