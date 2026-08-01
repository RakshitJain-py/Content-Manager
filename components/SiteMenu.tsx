"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MENU_LINKS, ROUTES } from "@/lib/routes";
import { useSession } from "@/hooks/useSession";
import { signOut } from "@/app/actions/auth";

export interface SiteMenuProps {
  delayed?: boolean;
}

export function SiteMenu({ delayed = false }: SiteMenuProps) {
  const [open, setOpen] = useState(false);
  const { session, loading } = useSession();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    setOpen(false);
    router.push(ROUTES.login);
    router.refresh();
  };

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-6 md:px-10",
          delayed && "cm-rise",
        )}
        style={delayed ? { animationDelay: "1300ms" } : undefined}
      >
        <Link
          href={ROUTES.home}
          className="font-mono text-[11px] tracking-[0.35em] text-neutral-500 transition-colors hover:text-neutral-300"
        >
          CONTENT MANAGER
        </Link>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="relative h-8 w-8 shrink-0"
        >
          <span
            className={cn(
              "absolute left-1 h-[2px] w-6 rounded-full bg-neutral-200 transition-all duration-300 ease-out",
              open ? "top-[15px] rotate-45" : "top-[9px]",
            )}
          />
          <span
            className={cn(
              "absolute left-1 top-[15px] h-[2px] w-6 rounded-full bg-neutral-200 transition-all duration-200",
              open && "opacity-0",
            )}
          />
          <span
            className={cn(
              "absolute left-1 h-[2px] w-6 rounded-full bg-neutral-200 transition-all duration-300 ease-out",
              open ? "top-[15px] -rotate-45" : "top-[21px]",
            )}
          />
        </button>
      </header>

      {/* backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-300 opacity-100"
        />
      )}

      {/* slide-in panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-40 flex h-full w-[300px] max-w-[85vw] flex-col justify-center gap-2 border-l border-neutral-900 bg-neutral-950 px-8 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <p className="mb-6 font-mono text-[10px] tracking-[0.3em] text-neutral-600">MENU</p>

        {/* Logged-in user display */}
        {!loading && session && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-600 to-purple-600 text-xs font-bold text-white">
              {session.displayName[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{session.displayName}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                {session.role}
              </p>
            </div>
          </div>
        )}

        {MENU_LINKS.filter((link) => {
          // Hide login link if already signed in
          if (session && link.to === ROUTES.login) return false;
          return true;
        }).map((link) => (
          <Link
            key={link.to}
            href={link.to}
            onClick={() => setOpen(false)}
            className="group flex items-center justify-between border-b border-neutral-900 py-4 text-lg font-medium text-neutral-200 transition-colors hover:text-white"
          >
            {link.label}
            <span className="text-neutral-600 transition-transform group-hover:translate-x-1">→</span>
          </Link>
        ))}

        {/* Logout button (only when logged in) */}
        {!loading && session && (
          <button
            onClick={handleLogout}
            className="mt-4 rounded-lg border border-neutral-800 py-3 text-sm text-neutral-400 transition-colors hover:border-red-900 hover:text-red-400"
          >
            Sign out
          </button>
        )}
      </aside>
    </>
  );
}
