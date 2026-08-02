"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export interface PublishingWindowProps {
  opsUsed: number;
  windowStartedAt: Date | null;
  maxOps?: number;
  windowSeconds?: number;
  onRefresh?: () => Promise<void>;
}

const MAX_OPS = 5;
const WINDOW_SECS = 180;

// The Instagram-spectrum gradient stops for 5 dots
const GRADIENT_COLORS = [
  "#4f5bd5", // Indigo/Blue
  "#7d44cc", // Purple
  "#ac2ebe", // Violet/Magenta
  "#d62976", // Pink/Red
  "#fa7e1e", // Orange
];

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PublishingWindow({
  opsUsed,
  windowStartedAt,
  maxOps = MAX_OPS,
  windowSeconds = WINDOW_SECS,
  onRefresh,
}: PublishingWindowProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!windowStartedAt) {
      setSecondsLeft(null);
      return;
    }

    function tick() {
      const elapsed = (Date.now() - windowStartedAt!.getTime()) / 1000;
      const remaining = Math.max(0, windowSeconds - elapsed);
      setSecondsLeft(remaining);
    }

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [windowStartedAt, windowSeconds]);

  const handleRefreshClick = async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  };

  const opsLeft = Math.max(0, maxOps - opsUsed);
  const hasActiveWindow = windowStartedAt !== null && secondsLeft !== null && secondsLeft > 0;
  const windowExpired = windowStartedAt !== null && secondsLeft !== null && secondsLeft <= 0;
  const effectiveOpsLeft = (!hasActiveWindow && !windowExpired) ? maxOps : opsLeft;

  return (
    <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 space-y-3">
      {/* Header with Refresh button */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">
          Publishing Window
        </span>
        {onRefresh && (
          <button
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
            title="Refresh limits"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {/* Ops dots with single continuous gradient stops */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-neutral-500">Posts left</span>
          <span className="font-mono text-[10px] font-bold text-neutral-300">
            {effectiveOpsLeft} / {maxOps}
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: maxOps }).map((_, i) => {
            const filled = i < effectiveOpsLeft;
            const dotColor = GRADIENT_COLORS[i % GRADIENT_COLORS.length];
            return (
              <div
                key={i}
                style={{
                  backgroundColor: filled ? dotColor : "#262626", // #262626 is neutral-800
                }}
                className="h-1.5 flex-1 rounded-full transition-all duration-300"
              />
            );
          })}
        </div>
      </div>

      {/* Countdown / status */}
      <div className="space-y-1">
        <span className="text-[10px] text-neutral-500">Window resets in</span>
        <div className="flex items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 py-2">
          {!hasActiveWindow ? (
            <span className="font-mono text-xs font-semibold text-neutral-500 tracking-widest">
              {windowExpired ? "Window refreshed" : "Ready to post"}
            </span>
          ) : (
            <span className={`font-mono text-sm font-bold tabular-nums tracking-widest ${
              effectiveOpsLeft === 0 ? "text-neutral-500" : "text-neutral-300"
            }`}>
              {formatTime(secondsLeft!)}
            </span>
          )}
        </div>
      </div>

      {hasActiveWindow && effectiveOpsLeft === 0 && (
        <p className="text-[10px] text-neutral-500 leading-relaxed">
          Limit reached. Wait {formatTime(secondsLeft!)} or deselect accounts.
        </p>
      )}
    </div>
  );
}
