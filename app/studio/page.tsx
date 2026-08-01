"use client";

import { useState } from "react";
import { Sparkles, Upload } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { GateModal } from "@/components/common/GateModal";
import { AddAccountModal } from "@/components/studio/AddAccountModal";
import { ConfigPanel } from "@/components/studio/ConfigPanel";
import { MediaQueueItem } from "@/components/studio/MediaQueueItem";
import { SchedulerModal } from "@/components/studio/SchedulerModal";
import { Sidebar } from "@/components/studio/Sidebar";
import { StudioHeader } from "@/components/studio/StudioHeader";
import { StudioToolbar } from "@/components/studio/StudioToolbar";
import { useAccounts } from "@/hooks/useAccounts";
import { useQueue } from "@/hooks/useQueue";
import { useSession } from "@/hooks/useSession";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Studio workspace — app/studio/page.tsx
 */
export default function StudioPage() {
  // Gate modal state: null = closed, "login" = guest, "access" = no permission
  const [gateModal, setGateModal] = useState<"login" | "access" | null>(null);
  const [oauthDraft, setOauthDraft] = useState<{ id: string; name: string } | null>(null);

  const { session } = useSession();

  /** Whether user can publish/schedule (logged in + access granted OR admin) */
  const canPublish = session?.accessGranted ?? false;

  /** Called when an unauthenticated action is attempted */
  const requireLogin = () => setGateModal("login");

  /** Called when publish/schedule is attempted without access */
  const requireAccess = () => setGateModal("access");

  /** Guard for publish/schedule: returns true if allowed, shows modal & returns false otherwise */
  const checkPublishAccess = () => {
    if (!session) { setGateModal("login"); return false; }
    if (!canPublish) { setGateModal("access"); return false; }
    return true;
  };

  const accountsState = useAccounts();
  const queue = useQueue(requireLogin);

  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);

  const handleOpenScheduler = () => {
    if (checkPublishAccess()) setSchedulerOpen(true);
  };

  // Detect Instagram OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("oauth_success");
    const accountId = params.get("accountId");
    const errorMsg = params.get("oauth_error");

    if (errorMsg) {
      toast.error(`Instagram Auth Failed: ${errorMsg}`);
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (success === "true" && accountId) {
      // Fetch draft details safely
      fetch(`/api/accounts/draft/${accountId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.account) {
            setOauthDraft({ id: data.account.id, name: data.account.name });
            setAddAccountOpen(true);
            toast.success("Authorized successfully! Please confirm display name to save.");
          } else {
            toast.error(data.error || "Failed to load connected account details.");
          }
        })
        .catch((err) => {
          console.error("Failed to load draft:", err);
          toast.error("Failed to retrieve connected account draft.");
        })
        .finally(() => {
          // Clean up URL search params
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        });
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-white">
      <StudioHeader onOpenScheduler={handleOpenScheduler} />

      <div className="flex flex-1 flex-col lg:flex-row">
        <Sidebar
          accounts={accountsState.accounts}
          selectedIds={accountsState.selectedIds}
          onToggle={accountsState.toggleAccount}
          onAddAccount={() => setAddAccountOpen(true)}
        />

        <main className="min-w-0 flex-1">
          <StudioToolbar
            contentType={queue.contentType}
            onContentTypeChange={queue.setContentType}
            mediaCount={queue.media.length}
            selectedCount={queue.selectedIds.length}
            allSelected={queue.allSelected}
            onFiles={queue.addFiles}
            onToggleSelectAll={queue.toggleSelectAll}
            storyBuilding={queue.storyBuilding}
            onToggleStoryBuilding={queue.toggleStoryBuilding}
            onPublish={() => {
              if (checkPublishAccess()) {
                queue.postSelected(accountsState.selectedIds);
              }
            }}
          />

          <div className="p-4">
            {!queue.contentType ? (
              <EmptyState
                icon={<Sparkles className="h-5 w-5" />}
                title="Choose a content type"
                body="Pick Post, Reel or Story above to open the workspace."
              />
            ) : queue.media.length === 0 && queue.uploadingFiles.length === 0 ? (
              <EmptyState
                icon={<Upload className="h-5 w-5" />}
                title="No media yet"
                body="Upload images or videos from your device to start building this batch."
              />
            ) : (
              <div className="space-y-2">
                {/* Uploading skeleton placeholders */}
                {queue.uploadingFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/10 p-2.5 opacity-60 animate-pulse"
                  >
                    <div className="h-5 w-5 shrink-0 rounded-full border border-neutral-800 bg-neutral-950 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-neutral-800" />
                    </div>
                    <div className="h-12 w-12 shrink-0 rounded-md bg-neutral-900 flex items-center justify-center border border-neutral-800">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-pink-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-neutral-300">Uploading {file.name}...</p>
                      <p className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                        Please wait
                      </p>
                    </div>
                  </div>
                ))}

                {/* Actual media items */}
                {queue.media.map((item) => (
                  <MediaQueueItem
                    key={item.id}
                    item={item}
                    contentType={queue.contentType!}
                    selectionIndex={queue.selectedIds.indexOf(item.id)}
                    ordered={queue.contentType === "story" && queue.storyBuilding}
                    onToggle={queue.toggleMedia}
                    onRemove={queue.removeMedia}
                    onPublish={() => {
                      if (checkPublishAccess()) {
                        queue.postMedia(item.id, accountsState.selectedIds);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        <ConfigPanel
          contentType={queue.contentType}
          previewItem={queue.previewItem}
          caption={queue.caption}
          onCaptionChange={queue.setCaption}
          onOpenScheduler={handleOpenScheduler}
          onSaveCaption={queue.saveCaption}
          storyLink={queue.storyLink}
          onStoryLinkChange={queue.setStoryLink}
          options={queue.options}
          onOptionToggle={queue.setOption}
        />
      </div>

      {addAccountOpen && (
        <AddAccountModal
          prefilledDraft={oauthDraft}
          onClose={() => {
            setAddAccountOpen(false);
            setOauthDraft(null);
          }}
          onSubmit={(draft) => {
            toast.promise(
              accountsState.addAccount(draft),
              {
                loading: "Adding account...",
                success: "Account added successfully!",
                error: (err) => err.message || "Failed to add account",
              }
            );
            setAddAccountOpen(false);
          }}
          onConfirmDraft={(id, name) => {
            toast.promise(
              accountsState.confirmAccount(id, name),
              {
                loading: "Confirming and saving account...",
                success: "Account connected and active!",
                error: (err) => err.message || "Failed to save account",
              }
            );
            setAddAccountOpen(false);
            setOauthDraft(null);
          }}
        />
      )}

      {schedulerOpen && <SchedulerModal onClose={() => setSchedulerOpen(false)} />}

      {/* Gate modals */}
      {gateModal && (
        <GateModal type={gateModal} onClose={() => setGateModal(null)} />
      )}
    </div>
  );
}
