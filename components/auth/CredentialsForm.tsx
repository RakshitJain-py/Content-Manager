"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import type { AuthCredentials, AuthRole } from "@/types/content";
import { signInUser, signUpUser, signInAdmin } from "@/app/actions/auth";

export interface CredentialsFormProps {
  role: AuthRole;
  identifierLabel: string;
  identifierPlaceholder: string;
  credentials: AuthCredentials;
  onChange: (field: keyof AuthCredentials, value: string) => void;
  onBack: () => void;
}

function Field({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none transition-colors focus:border-neutral-600"
      />
    </label>
  );
}

export function CredentialsForm({
  role,
  identifierLabel,
  identifierPlaceholder,
  credentials,
  onChange,
  onBack,
}: CredentialsFormProps) {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let res;
      if (role === "admin") {
        res = await signInAdmin(credentials.identifier, credentials.password);
      } else if (isSignUp) {
        res = await signUpUser(credentials.identifier, credentials.password);
      } else {
        res = await signInUser(credentials.identifier, credentials.password);
      }

      if (res.success) {
        // Successful login, redirect to studio
        router.push(ROUTES.studio);
        router.refresh();
      } else {
        setError(res.error || "An error occurred. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/30 p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      <Field
        label={identifierLabel}
        type={role === "admin" ? "text" : "email"}
        placeholder={identifierPlaceholder}
        value={credentials.identifier}
        onChange={(v) => onChange("identifier", v)}
      />
      <Field
        label="Password"
        type="password"
        placeholder="••••••••"
        value={credentials.password}
        onChange={(v) => onChange("password", v)}
      />

      <button
        type="submit"
        disabled={loading}
        className="ig-gradient mt-2 inline-flex items-center justify-center rounded-lg px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-white transition-transform hover:scale-[1.02] cursor-pointer disabled:opacity-50"
      >
        {loading ? "Processing..." : role === "admin" ? "Sign In" : isSignUp ? "Create Account" : "Sign In"}
      </button>

      {role === "user" && (
        <div className="text-center mt-1">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-xs text-neutral-400 hover:text-white transition-colors"
          >
            {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="text-xs text-neutral-500 transition-colors hover:text-neutral-300 mt-2"
      >
        ← Back to role selection
      </button>
    </form>
  );
}
