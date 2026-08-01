import type { Metadata } from "next";
import { SiteMenu } from "@/components/SiteMenu";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Contact Admin — Content Manager",
  description: "Reach the Content Manager admin on Telegram for access and account setup.",
  openGraph: {
    title: "Contact Admin — Content Manager",
    description: "Reach the Content Manager admin on Telegram for access and account setup.",
  },
};

export const dynamic = "force-dynamic";

/** Contact page — app/contact/page.tsx */
export default async function ContactPage() {
  const adminTelegram = (await db.getSystemSetting("admin_telegram_username")) || "@admin_placeholder";

  return (
    <main className="relative min-h-screen bg-[#0a0a0a] text-white">
      <SiteMenu />
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-28">
        <h1 className="text-3xl font-bold tracking-tight">Contact admin</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Access is granted manually. Message the admin on Telegram with your account name.
        </p>

        <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">
            Telegram ID
          </span>
          <p className="mt-2 text-xl font-semibold">{adminTelegram}</p>
          <a
            href={`https://t.me/${adminTelegram.replace("@", "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ig-gradient mt-6 flex w-full items-center justify-center rounded-lg px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-white transition-transform hover:scale-[1.02]"
          >
            Message on Telegram →
          </a>
        </div>

        <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-sm text-neutral-400">
          <p className="font-medium text-neutral-200">Response time</p>
          <p className="mt-1">Usually within 24 hours.</p>
        </div>
      </div>
    </main>
  );
}
