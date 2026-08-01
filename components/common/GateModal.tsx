"use client";

import Link from "next/link";
import { Lock, LogIn } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { ROUTES } from "@/lib/routes";

/** Which gate type to display */
export type GateType = "login" | "access";

export interface GateModalProps {
  type: GateType;
  onClose: () => void;
}

/**
 * A graceful blocking modal shown when a guest tries an action that requires
 * login, or a logged-in user tries an action that requires admin-granted access.
 */
export function GateModal({ type, onClose }: GateModalProps) {
  const isLogin = type === "login";

  return (
    <Modal
      title={isLogin ? "Sign in required" : "Access required"}
      onClose={onClose}
    >
      <div className="flex flex-col items-center gap-5 py-2 text-center">
        {/* Icon */}
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 border border-neutral-800">
          {isLogin ? (
            <LogIn className="h-6 w-6 text-neutral-400" />
          ) : (
            <Lock className="h-6 w-6 text-neutral-400" />
          )}
        </div>

        {/* Message */}
        <div>
          <p className="text-sm text-neutral-300 leading-relaxed">
            {isLogin
              ? "You need to be signed in to upload media."
              : "You need admin-granted access before you can publish or schedule posts."}
          </p>
          {!isLogin && (
            <p className="mt-1 text-xs text-neutral-500">
              Contact the admin to request access for your account.
            </p>
          )}
        </div>

        {/* CTA */}
        <Link
          href={isLogin ? ROUTES.login : ROUTES.contact}
          onClick={onClose}
          className="ig-gradient w-full rounded-lg py-3 text-center text-xs font-bold uppercase tracking-[0.15em] text-white transition-transform hover:scale-[1.02]"
        >
          {isLogin ? "Go to Sign in / Sign up" : "Contact Admin"}
        </Link>

        <button
          onClick={onClose}
          className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </Modal>
  );
}
