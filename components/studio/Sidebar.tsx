import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/content";

/** Props for the left accounts sidebar. */
export interface SidebarProps {
  /** Every account available to publish to. */
  accounts: Account[];
  /** Ids currently selected as publish targets. */
  selectedIds: string[];
  /** Toggle one account's selection. */
  onToggle: (id: string) => void;
  /** Open the "add account" modal. */
  onAddAccount: () => void;
}

/** Multi-select list of Instagram accounts. */
export function Sidebar({ accounts, selectedIds, onToggle, onAddAccount }: SidebarProps) {
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
          return (
            <button
              key={account.id}
              onClick={() => onToggle(account.id)}
              aria-pressed={on}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                on
                  ? "border-transparent bg-neutral-900 ring-1 ring-pink-500/60"
                  : "border-neutral-800 hover:border-neutral-700",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  on ? "ig-gradient border-transparent" : "border-neutral-600",
                )}
              >
                {on && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{account.name}</span>
                <span className="block truncate font-mono text-[10px] text-neutral-500">{account.igId}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[11px] text-neutral-600">
        {selectedIds.length} of {accounts.length} accounts selected for publishing.
      </p>
    </aside>
  );
}
