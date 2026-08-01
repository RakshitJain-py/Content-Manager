import { cn } from "@/lib/utils";

/** Props for a single settings toggle row. */
export interface ToggleRowProps {
  /** Text shown on the left of the row. */
  label: string;
  /** Controlled on/off state. */
  checked: boolean;
  /** Callback fired with the new state. */
  onChange?: (on: boolean) => void;
}

/** Full-width switch row used in the configuration panel. */
export function ToggleRow({ label, checked = false, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        onChange?.(!checked);
      }}
      className="flex w-full items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2.5 text-left text-xs text-neutral-300 transition-colors hover:border-neutral-700"
    >
      {label}
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", checked ? "ig-gradient" : "bg-neutral-700")}>
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
