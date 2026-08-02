import { Check, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/content";
import { PublishingWindow } from "./PublishingWindow";

/** Props for the left accounts sidebar. */
export interface SidebarProps {
  /** Every account available to publish to. */
  accounts: Account[];
  /** Ids currently selected as publish targets. */
  selectedIds: string[];
  /** Toggle one account'"'"'s selection. */
  onToggle: (id: string) => void;
  /** Open the "add account" modal. */
  onAddAccount: () => void;
  /** Remove/Delete one account. */
  onRemove: (id: string) => void;
  /** Current rate limit window state. */
  rateLimitWindow: { opsUsed: number; windowStartedAt: Date } | null;
  /** Force refetch rate limit window from server. */
  onRefreshRateLimit?: () => Promise<void>;
}

/** Formats a future ISO timestamp into "Xh Ym" relative time. */
function formatResetIn(isoTimestamp: string): string {
  const diff = Math.max(0, new Date(isoTimestamp).getTime() - Date.now());
  const totalMins = Math.ceil(diff / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Multi-select list of Instagram accounts. */
export function Sidebar({ accounts, selectedIds, onToggle, onAddAccount, onRemove, rateLimitWindow, onRefreshRateLimit }: SidebarProps) {
  return (
    <aside className="w-full shrink-0 border-b border-neutral-900 p-4 lg:w-64 lg:border-b-0 lg:border-r">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">Accounts</span>
        <button
          onClick={onAddAccount}
          aria-label="Add account"
          className="rounded-md border border-neutral-800 p-1 text-neutral-400 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {accounts.map((account) => {
          const on = selectedIds.includes(account.id);
          const exhausted = (account.postsRemaining ?? 20) <= 0;

          return (
            <div key={account.id} className="group relative flex items-center">
              <button
                onClick={() => !exhausted && onToggle(account.id)}
                aria-pressed={on}
                disabled={exhausted}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 pr-10 text-left transition-colors",
                  exhausted
                    ? "border-neutral-800/50 bg-neutral-950/40 opacity-50 cursor-not-allowed"
                    : on
                    ? "border-transparent bg-neutral-900 ring-1 ring-pink-500/60"
                    : "border-neutral-800 hover:border-neutral-700",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    exhausted
                      ? "border-neutral-700 bg-neutral-900"
                      : on
                      ? "ig-gradient border-transparent"
                      : "border-neutral-600",
                  )}
                >
                  {on && !exhausted && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{account.name}</span>
                  <span className="block font-mono text-[10px] text-neutral-500">
                    {exhausted && account.quotaResetAt
                      ? `Exhausted · resets in ${formatResetIn(account.quotaResetAt)}`
                      : `${account.postsRemaining ?? 20} / 20 posts`
                    }
                  </span>
                </span>
              </button>

              {!exhausted && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to disconnect @${account.name.replace(/^@/, "")}?`)) {
                      onRemove(account.id);
                    }
                  }}
                  className="absolute right-3 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-neutral-500 hover:text-neutral-300 transition-all rounded"
                  aria-label="Delete account"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-neutral-600">
        {selectedIds.length} of {accounts.length} accounts selected.
      </p>

      {/* Publishing window panel */}
      <PublishingWindow
        opsUsed={rateLimitWindow?.opsUsed ?? 0}
        windowStartedAt={rateLimitWindow?.windowStartedAt ?? null}
        onRefresh={onRefreshRateLimit}
      />
    </aside>
  );
}
