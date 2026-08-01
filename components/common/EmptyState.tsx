import type { ReactNode } from "react";

/** Props for the dashed placeholder panel shown when the workspace is empty. */
export interface EmptyStateProps {
  /** Small icon rendered above the title. */
  icon: ReactNode;
  title: string;
  /** Supporting sentence under the title. */
  body: string;
}

/** Dashed-border empty placeholder for the studio workspace. */
export function EmptyState({ icon, title, body }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-800 py-20 text-center">
      <span className="mb-3 text-neutral-600">{icon}</span>
      <p className="text-sm font-medium text-neutral-300">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-neutral-600">{body}</p>
    </div>
  );
}
