import type { Metadata } from "next";
import { SiteMenu } from "@/components/SiteMenu";
import { LoginClient } from "./LoginClient";

export const metadata: Metadata = {
  title: "Sign in — Content Manager",
  description: "Continue as a user or an admin to access the Content Manager studio.",
  openGraph: {
    title: "Sign in — Content Manager",
    description: "Continue as a user or an admin to access the Content Manager studio.",
  },
};

/** Login page — app/login/page.tsx */
export default function LoginPage() {
  return (
    <main className="relative min-h-screen bg-[#0a0a0a] text-white">
      <SiteMenu />
      <LoginClient />
    </main>
  );
}
