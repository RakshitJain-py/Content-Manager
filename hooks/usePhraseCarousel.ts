"use client";

import { useEffect, useState } from "react";

/** Options for {@link usePhraseCarousel}. */
export interface PhraseCarouselOptions {
  /** How many phrases are in one loop. */
  length: number;
  /** How many times the list is repeated before silently resetting. */
  loops?: number;
  /** Milliseconds between steps. */
  intervalMs?: number;
  /** Duration of the translate transition, in milliseconds. */
  durationMs?: number;
}

/** Return value of {@link usePhraseCarousel}. */
export interface PhraseCarouselState {
  /** Current row index (grows monotonically, resets invisibly at the end). */
  index: number;
  /** False for the single frame where the list snaps back to the start. */
  animate: boolean;
}

/**
 * Drives the vertical rolling phrase list on the landing page.
 * Pure timing logic, no DOM — the component owns the markup.
 */
export function usePhraseCarousel({
  length,
  loops = 12,
  intervalMs = 2200,
  durationMs = 900,
}: PhraseCarouselOptions): PhraseCarouselState {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setIndex((v) => v + 1), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  useEffect(() => {
    if (index !== length * loops) return undefined;
    const timer = setTimeout(() => {
      setAnimate(false);
      setIndex(0);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    }, durationMs);
    return () => clearTimeout(timer);
  }, [index, length, loops, durationMs]);

  return { index, animate };
}

