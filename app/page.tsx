import type { Metadata } from "next";
import Link from "next/link";
import { SiteMenu } from "@/components/SiteMenu";
import { HeroHeading } from "@/components/landing/HeroHeading";
import { PhraseCarousel } from "@/components/landing/PhraseCarousel";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Content Manager — Your content just got a Manager",
  description:
    "Plan, configure and publish Instagram posts, reels and stories to multiple accounts from one premium dark studio.",
  openGraph: {
    title: "Content Manager — Your content just got a Manager",
    description: "Create faster, post smarter and own the feed with one multi-account Instagram studio.",
  },
};

/** Phrases cycled by the hero carousel. */
const PHRASES: ReadonlyArray<string> = ["Create faster.", "Post smarter.", "Own the feed."];

/** Landing page — app/page.tsx */
export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <SiteMenu delayed />

      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <HeroHeading lineOne="Your content" lineTwo="Just got a" gradientLine="MANAGER" />

        <div className="cm-rise mt-8 w-full max-w-xs" style={{ animationDelay: "1300ms" }}>
          <PhraseCarousel phrases={PHRASES} />
        </div>

        <Link
          href={ROUTES.studio}
          className="ig-gradient cm-rise mt-6 inline-flex w-[280px] items-center justify-center gap-2 rounded-lg px-8 py-4 font-mono text-xs font-bold uppercase tracking-[0.2em] text-white shadow-[0_10px_40px_-10px_rgba(214,41,118,0.7)] transition-transform duration-200 hover:scale-[1.03]"
          style={{ animationDelay: "1300ms" }}
        >
          Enter the Studio <span aria-hidden>→</span>
        </Link>
      </section>
    </main>
  );
}
