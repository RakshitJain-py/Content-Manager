"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MENU_LINKS, ROUTES } from "@/lib/routes";
import { useSession } from "@/hooks/useSession";
import { signOut, searchUsersAction, updateUserAccessAction } from "@/app/actions/auth";
import { Modal } from "@/components/common/Modal";
import { Users, Search, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export interface SiteMenuProps {
  delayed?: boolean;
}

export function SiteMenu({ delayed = false }: SiteMenuProps) {
  const [open, setOpen] = useState(false);
  const [manageUsersOpen, setManageUsersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const { session, loading } = useSession();
  const router = useRouter();

  const handleSearchUsers = useCallback(async (q: string) => {
    setSearchQuery(q);
    setSearching(true);
    try {
      const res = await searchUsersAction(q);
      if (res.success && res.users) {
        setFoundUsers(res.users);
      } else {
        setFoundUsers([]);
      }
    } catch (err) {
      console.error("Search error:", err);
      setFoundUsers([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleToggleAccess = useCallback(async (email: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    try {
      const res = await updateUserAccessAction(email, nextStatus);
      if (res.success) {
        toast.success(`Access ${nextStatus ? "granted" : "revoked"} for ${email}`);
        setFoundUsers((prev) =>
          prev.map((u) => (u.email === email ? { ...u, accessGranted: nextStatus } : u))
        );
      } else {
        toast.error(res.error || "Failed to update access");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update access");
    }
  }, []);

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

        {/* Manage Users (Admin only) */}
        {!loading && session?.role === "admin" && (
          <button
            onClick={() => {
              setOpen(false);
              setManageUsersOpen(true);
              handleSearchUsers(""); // initial load
            }}
            className="group flex items-center justify-between border-b border-neutral-900 py-4 text-lg font-medium text-neutral-200 transition-colors hover:text-white text-left w-full cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-pink-500" />
              Manage Users
            </span>
            <span className="text-neutral-600 transition-transform group-hover:translate-x-1">→</span>
          </button>
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

      {manageUsersOpen && (
        <Modal title="Manage User Access" onClose={() => setManageUsersOpen(false)}>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search user email..."
                value={searchQuery}
                onChange={(e) => handleSearchUsers(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-neutral-600"
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {searching && (
                <p className="text-center text-xs text-neutral-500 animate-pulse py-4">Searching users...</p>
              )}

              {!searching && foundUsers.length === 0 && searchQuery && (
                <p className="text-center text-xs text-neutral-600 py-4">No users found matching "{searchQuery}"</p>
              )}

              {!searching && foundUsers.length === 0 && !searchQuery && (
                <p className="text-center text-xs text-neutral-600 py-4">Type to search registered users.</p>
              )}

              {foundUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/40 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-neutral-200">{user.email}</p>
                    <p className="text-[10px] text-neutral-500 font-mono">
                      Joined: {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="ml-3 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      {user.accessGranted ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[10px] text-emerald-400 font-medium">Allowed</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5 text-rose-400" />
                          <span className="text-[10px] text-rose-400 font-medium">Blocked</span>
                        </>
                      )}
                    </span>

                    <button
                      onClick={() => handleToggleAccess(user.email, user.accessGranted)}
                      className={cn(
                        "rounded px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer",
                        user.accessGranted
                          ? "bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 border border-rose-900/40"
                          : "bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-900/40"
                      )}
                    >
                      {user.accessGranted ? "Revoke" : "Grant"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
