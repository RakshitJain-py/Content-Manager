import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { LabeledInput } from "@/components/common/LabeledInput";
import { Info, ArrowRight, Check } from "lucide-react";
import type { AccountDraft } from "@/types/content";

/** Props for the "add Instagram account" modal. */
export interface AddAccountModalProps {
  /** Close without saving. */
  onClose: () => void;
  /** Called with the completed draft when manual "Add account" is pressed. */
  onSubmit: (draft: AccountDraft) => void;
  /** Initial draft from OAuth if redirected back. */
  prefilledDraft?: { id: string; name: string } | null;
  /** Fired when the prefilled OAuth draft is confirmed/saved. */
  onConfirmDraft?: (id: string, name: string) => void;
}

const EMPTY_DRAFT: AccountDraft = { name: "", igId: "", token: "" };

/** Collects account name, numeric id and a censored access token. */
export function AddAccountModal({ onClose, onSubmit, prefilledDraft, onConfirmDraft }: AddAccountModalProps) {
  const [draft, setDraft] = useState<AccountDraft>(() => {
    if (prefilledDraft) {
      const cleanName = prefilledDraft.name.startsWith("@") ? prefilledDraft.name.slice(1) : prefilledDraft.name;
      return { name: cleanName, igId: prefilledDraft.id, token: "••••••••••••" };
    }
    return EMPTY_DRAFT;
  });

  const [showRedirectPrompt, setShowRedirectPrompt] = useState(false);

  const handleInstagramConnect = () => {
    setShowRedirectPrompt(true);
  };

  const handleProceedRedirect = () => {
    window.location.href = "/api/auth/instagram/login";
  };

  // If we are confirming an OAuth draft
  if (prefilledDraft) {
    return (
      <Modal title="Confirm Connected Account" onClose={onClose}>
        <div className="space-y-4">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-start gap-2.5">
            <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-300">
              Successfully authorized with Instagram! Verify or rename the account name below to finish setup.
            </div>
          </div>

          <LabeledInput
            label="Account Display Name"
            value={draft.name}
            onChange={(name) => setDraft({ ...draft, name })}
            placeholder="@my.account"
          />
          <LabeledInput
            label="Instagram Numeric ID"
            value={draft.igId}
            onChange={() => {}}
            disabled
            placeholder="17841400000000000"
          />
          <LabeledInput
            label="Access Token"
            type="password"
            value={draft.token}
            onChange={() => {}}
            disabled
            placeholder="••••••••••••"
          />
          <button
            onClick={() => {
              if (!draft.name.trim()) return;
              onConfirmDraft?.(prefilledDraft.id, draft.name);
            }}
            className="ig-gradient w-full rounded-lg py-3 text-xs font-bold uppercase tracking-[0.15em] text-white flex items-center justify-center gap-1.5"
          >
            Confirm & Add Account
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add Instagram Account" onClose={onClose}>
      {showRedirectPrompt ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-neutral-900 border border-neutral-800 p-3 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-pink-400 shrink-0 mt-0.5" />
            <div className="text-xs text-neutral-400 space-y-2">
              <p>You will be redirected to Instagram to authorize this account.</p>
              <p className="text-[10px] text-neutral-500">
                Ensure the account has been added as a <strong>Tester</strong> on the Meta Developer App and has accepted the invite first.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRedirectPrompt(false)}
              className="flex-1 rounded-lg border border-neutral-800 bg-neutral-950 py-2.5 text-xs text-neutral-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleProceedRedirect}
              className="flex-1 ig-gradient rounded-lg py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white flex items-center justify-center gap-1"
            >
              Proceed <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Official Premium OAuth Button */}
          <button
            onClick={handleInstagramConnect}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-lg shadow-pink-600/20 transition-all hover:scale-[1.01]"
          >
            Connect with Instagram
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-neutral-900"></div>
            <span className="flex-shrink mx-4 text-[10px] font-mono text-neutral-600 uppercase">Or Add Manually</span>
            <div className="flex-grow border-t border-neutral-900"></div>
          </div>

          <div className="space-y-3">
            <LabeledInput
              label="Account Display Name"
              value={draft.name}
              onChange={(name) => setDraft({ ...draft, name })}
              placeholder="@my.account"
            />
            <LabeledInput
              label="Numeric ID"
              value={draft.igId}
              onChange={(igId) => setDraft({ ...draft, igId })}
              placeholder="17841400000000000"
            />
            <LabeledInput
              label="Access Token"
              type="password"
              value={draft.token}
              onChange={(token) => setDraft({ ...draft, token })}
              placeholder="••••••••••••"
            />
            <button
              onClick={() => {
                if (!draft.name || !draft.igId || !draft.token) return;
                onSubmit(draft);
                setDraft(EMPTY_DRAFT);
              }}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 py-3 text-xs font-bold uppercase tracking-[0.15em] text-neutral-200 transition-colors"
            >
              Add account
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
