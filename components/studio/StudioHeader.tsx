"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, LogOut } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/hooks/useSession";
import { signOut } from "@/app/actions/auth";

export interface StudioHeaderProps {
  onOpenScheduler: () => void;
}

export function StudioHeader({ onOpenScheduler }: StudioHeaderProps) {
  const { session, loading } = useSession();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push(ROUTES.login);
    router.refresh();
  };

  return (
    <header className="flex items-center justify-between border-b border-neutral-900 px-5 py-3">
      <Link
        href={ROUTES.home}
        className="font-mono text-[11px] tracking-[0.3em] text-neutral-500 hover:text-neutral-300"
      >
        CONTENT MANAGER
      </Link>
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenScheduler}
          className="ig-gradient flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] shadow-[0_8px_30px_-10px_rgba(214,41,118,0.8)] transition-transform hover:scale-[1.03]"
        >
          <CalendarClock className="h-4 w-4" /> Scheduler
        </button>

        {/* Account area — changes based on session */}
        {!loading && session ? (
          <div className="flex items-center gap-2">
            {/* User chip */}
            <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-pink-600 to-purple-600 text-[9px] font-bold text-white">
                {session.displayName[0].toUpperCase()}
              </div>
              <span className="text-xs text-neutral-200">{session.displayName}</span>
            </div>
            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Sign out"
              className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-400 transition-colors hover:border-red-900 hover:text-red-400"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <Link
            href={ROUTES.login}
            className="rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-400 hover:text-white"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
