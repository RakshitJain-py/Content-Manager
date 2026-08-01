"use client";

import { usePhraseCarousel } from "@/hooks/usePhraseCarousel";

/** Props for the vertical rolling phrase carousel. */
export interface PhraseCarouselProps {
  /** Phrases cycled in order; the middle row is the bright one. */
  phrases: ReadonlyArray<string>;
  /** Row height in px (also sets the visible 3-row window). */
  rowHeight?: number;
}

/** Slow vertical loop with fading top/bottom rows, used under the hero. */
export function PhraseCarousel({ phrases, rowHeight = 34 }: PhraseCarouselProps) {
  const { index, animate } = usePhraseCarousel({ length: phrases.length, loops: 12 });

  /** Repeated rows so the list can scroll continuously before resetting. */
  const rows = Array.from({ length: phrases.length * 12 + 3 }, (_, n) => phrases[n % phrases.length]);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: rowHeight * 3,
        maskImage: "linear-gradient(to bottom, transparent, white 45%, white 55%, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, white 45%, white 55%, transparent)",
      }}
    >
      <div
        style={{
          transform: `translateY(${-index * rowHeight}px)`,
          transition: animate ? "transform 900ms cubic-bezier(0.65,0,0.35,1)" : "none",
        }}
      >
        {rows.map((phrase, n) => (
          <div
            key={n}
            className="flex items-center justify-center text-base font-semibold text-white md:text-lg"
            style={{ height: rowHeight }}
          >
            {phrase}
          </div>
        ))}
      </div>
    </div>
  );
}
