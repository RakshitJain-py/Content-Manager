"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Bell } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { useSession } from "@/hooks/useSession";
import { signOut } from "@/app/actions/auth";
import { toast } from "sonner";

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

  const handleNotificationClick = () => {
    toast.info("Notifications feature is coming soon!");
  };

  return (
    <header className="grid grid-cols-3 items-center border-b border-neutral-900 px-5 py-3 bg-[#0a0a0a]">
      {/* Left side: Home Link at 70% of 22px (~15.4px) */}
      <div className="flex justify-start">
        <Link
          href={ROUTES.home}
          className="font-mono text-[15.4px] font-bold tracking-[0.3em] text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          CONTENT MANAGER
        </Link>
      </div>

      {/* Center: Heading (bold monospace, shorter in height, gradient color) */}
      <div className="flex justify-center">
        <h1 className="font-mono text-xl font-extrabold tracking-wider bg-gradient-to-r from-[#4f5bd5] via-[#d62976] to-[#fa7e1e] bg-clip-text text-transparent transform scale-y-75 origin-center select-none">
          STUDIO
        </h1>
      </div>

      {/* Right side: Bell icon + Auth status */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleNotificationClick}
          title="Notifications (Coming soon)"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
        >
          <Bell className="h-4 w-4" />
        </button>

        {!loading && session ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-pink-600 to-purple-600 text-[9px] font-bold text-white">
                {session.displayName[0].toUpperCase()}
              </div>
              <span className="text-xs text-neutral-200">{session.displayName}</span>
            </div>
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
