"use client";

import { RoleSelector } from "@/components/auth/RoleSelector";
import { CredentialsForm } from "@/components/auth/CredentialsForm";
import { useAuth } from "@/hooks/useAuth";

/**
 * Interactive login shell — kept in its own Client Component so the parent
 * page.tsx stays a Server Component (metadata, no extra JS on initial load).
 */
export function LoginClient() {
  const { role, selectRole, credentials, setCredential, identifierLabel, identifierPlaceholder } = useAuth();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-28">
      <h1 className="text-3xl font-bold tracking-tight">
        {role ? (role === "user" ? "User sign in" : "Admin sign in") : "Continue as"}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        {role ? "Enter your credentials to open the studio." : "Choose how you want to sign in."}
      </p>

      {!role ? (
        <RoleSelector onSelect={selectRole} />
      ) : (
        <CredentialsForm
          role={role}
          identifierLabel={identifierLabel}
          identifierPlaceholder={identifierPlaceholder}
          credentials={credentials}
          onChange={setCredential}
          onBack={() => selectRole(null)}
        />
      )}
    </div>
  );
}
