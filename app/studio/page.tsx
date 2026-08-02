"use client";

import { useState, useEffect } from "react";
import { Sparkles, Upload, Eye, History, ExternalLink, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { GateModal } from "@/components/common/GateModal";
import { Modal } from "@/components/common/Modal";
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
import { getPublishHistoryAction } from "@/app/actions/studio";
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
  const [readmeOpen, setReadmeOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingCaption, setViewingCaption] = useState<string | null>(null);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await getPublishHistoryAction();
      if (res.success && res.data) {
        setHistoryItems(res.data);
      } else {
        toast.error(res.error || "Failed to load publish history.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Auto-load history whenever the History tab is active
  useEffect(() => {
    if (queue.contentType === "history") {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.contentType]);

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
          onRemove={(id) => {
            toast.promise(
              accountsState.removeAccount(id),
              {
                loading: "Disconnecting account...",
                success: "Account disconnected successfully!",
                error: (err) => err.message || "Failed to disconnect account",
              }
            );
          }}
          rateLimitWindow={queue.rateLimitWindow}
          onRefreshRateLimit={queue.refreshRateLimit}
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
            onOpenReadme={() => setReadmeOpen(true)}
            isPublishing={queue.isPublishing}
          />

          <div className="p-4">
            {queue.contentType === "history" ? (
              /* HISTORY VIEW */
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-900 pb-3 mb-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <History className="h-5 w-5 text-pink-500" />
                    Publishing History Logs
                  </h2>
                  <button
                    onClick={loadHistory}
                    disabled={historyLoading}
                    className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {historyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {historyLoading ? "Loading..." : "Refresh"}
                  </button>
                </div>

                {historyLoading && (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-4 bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 animate-pulse">
                        <div className="w-16 h-16 rounded-lg bg-neutral-800 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-neutral-800 rounded w-24" />
                          <div className="h-3 bg-neutral-800 rounded w-48" />
                        </div>
                        <div className="space-y-1.5 text-right">
                          <div className="h-3 bg-neutral-800 rounded w-12" />
                          <div className="h-3 bg-neutral-800 rounded w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!historyLoading && historyItems.length === 0 && (
                  <div className="py-16">
                    <EmptyState
                      icon={<History className="h-5 w-5" />}
                      title="No history yet"
                      body="Published, failed, and in-progress Instagram posts will appear here."
                    />
                  </div>
                )}

                {!historyLoading && historyItems.length > 0 && (
                  <div className="space-y-3">
                    {historyItems.map((item) => {
                      const d = new Date(item.publishedAt || item.timestamp);
                      const time24 = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                      const day = String(d.getDate()).padStart(2, "0");
                      const month = String(d.getMonth() + 1).padStart(2, "0");
                      const year = String(d.getFullYear()).slice(-2);
                      const dateStr = `${day}-${month}-${year}`;

                      const isPublished = item.status === "published";
                      const isFailed = item.status === "failed";
                      const isUploading = item.status === "uploading";

                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-4 bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 transition-all hover:border-neutral-700"
                        >
                          {/* Left: Thumbnail */}
                          <div className="w-16 h-16 rounded-lg bg-neutral-950 overflow-hidden shrink-0 border border-neutral-800 flex items-center justify-center relative">
                            {item.cloudinaryUrl ? (
                              item.mediaType === "video" ? (
                                <video
                                  src={item.cloudinaryUrl}
                                  className="w-full h-full object-cover"
                                  preload="metadata"
                                  muted
                                />
                              ) : (
                                <img
                                  src={item.cloudinaryUrl}
                                  alt="thumbnail"
                                  className="w-full h-full object-cover"
                                />
                              )
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                {isFailed ? (
                                  <AlertCircle className="h-5 w-5 text-red-500/60" />
                                ) : (
                                  <CheckCircle2 className="h-5 w-5 text-neutral-700" />
                                )}
                              </div>
                            )}
                            <span className="absolute bottom-1 right-1 bg-black/70 text-[8px] px-1 py-0.5 rounded text-neutral-400 font-semibold uppercase">
                              {item.mediaType}
                            </span>
                          </div>

                          {/* Center: Content type, caption, error */}
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[9px] font-bold tracking-wider uppercase bg-pink-950/40 text-pink-400 px-1.5 py-0.5 rounded border border-pink-900/40">
                                {item.shareToFeed === false ? "Story" : "Post/Reel"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-neutral-300 truncate flex-1">
                                {isFailed && item.error
                                  ? <span className="text-red-400/80 text-xs">{item.error}</span>
                                  : item.caption || <span className="text-neutral-600 italic text-xs">No caption</span>
                                }
                              </p>
                              {item.caption && !isFailed && (
                                <button
                                  onClick={() => setViewingCaption(item.caption)}
                                  className="p-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg border border-neutral-800 transition-colors shrink-0 cursor-pointer"
                                  title="View full caption"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Right: Status pill + timestamp */}
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {/* Status pill */}
                            {isPublished && item.permalink ? (
                              <a
                                href={item.permalink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide cursor-pointer transition-opacity hover:opacity-80"
                                style={{ background: "linear-gradient(135deg, #10b981, #0ea5e9)", color: "#fff" }}
                              >
                                View <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            ) : isPublished ? (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide"
                                style={{ background: "linear-gradient(135deg, #10b981, #0ea5e9)", color: "#fff" }}
                              >
                                <CheckCircle2 className="h-2.5 w-2.5" /> Published
                              </span>
                            ) : isFailed ? (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide"
                                style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff" }}
                              >
                                <AlertCircle className="h-2.5 w-2.5" /> Failed
                              </span>
                            ) : isUploading ? (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide animate-pulse"
                                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff" }}
                              >
                                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Uploading
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide bg-neutral-800 text-neutral-400">
                                {item.status}
                              </span>
                            )}
                            {/* Timestamp */}
                            <div className="text-right">
                              <p className="text-xs font-semibold text-neutral-300">{time24}</p>
                              <p className="text-[10px] text-neutral-500 font-mono">{dateStr}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            ) : (
              /* EXISTING WORKSPACE QUEUE */
              <>
                {!queue.contentType ? (
                  <EmptyState
                    icon={<Sparkles className="h-5 w-5" />}
                    title="Choose a content type"
                    body="Pick Post, Reel, Story or History above to open the workspace."
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
                        ordered={queue.storyBuilding}
                        onToggle={queue.toggleMedia}
                        onRemove={queue.removeMedia}
                        onPublish={() => {
                          if (checkPublishAccess()) {
                            queue.postMedia(item.id, accountsState.selectedIds);
                          }
                        }}
                        isPublishing={queue.isPublishing}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {queue.contentType && queue.contentType !== "history" && (
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
            coverUrl={queue.coverUrl}
            onCoverChange={queue.setCoverUrl}
            onUploadCover={queue.uploadCover}
            isCaptionDirty={queue.caption !== queue.lastSavedCaption}
            onSaveSettings={queue.saveSettings}
            mediaList={queue.media}
            onApplyMediaAsCover={queue.applyMediaAsCover}
            isSettingsDirty={queue.isSettingsDirty}
          />
        )}
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



      {viewingCaption !== null && (
        <Modal title="Full Caption" onClose={() => setViewingCaption(null)}>
          <div className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-4 max-h-[300px] overflow-y-auto">
            <p className="text-sm text-neutral-200 whitespace-pre-wrap select-all">{viewingCaption}</p>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setViewingCaption(null)}
              className="rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {readmeOpen && (
        <Modal title="Read Me — Guidelines & Policies" onClose={() => setReadmeOpen(false)}>
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 text-sm text-neutral-300">
            <div className="rounded-lg border border-red-950 bg-red-950/20 p-3 text-xs leading-relaxed text-red-400">
              ⚠️ <strong className="font-bold text-red-300">Storage Binary Policy:</strong> Once successfully published to Instagram, media files are permanently deleted from our database/storage to conserve space. However, logs, timestamps, captions, and links remain in your <strong>History</strong>.
            </div>

            <div>
              <h3 className="font-bold text-white mb-1.5">Supported Formats</h3>
              <ul className="list-disc pl-4 space-y-1 text-xs text-neutral-400">
                <li><strong className="text-neutral-300">Images:</strong> JPG/JPEG, PNG. (WebP is strictly blocked because the Instagram API rejects it).</li>
                <li><strong className="text-neutral-300">Videos:</strong> MP4, MOV.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-white mb-1.5">Quick Guide</h3>
              <ul className="list-disc pl-4 space-y-1 text-xs text-neutral-400">
                <li>Choose a media format tab on the left (Post, Reel, Story).</li>
                <li>Use <strong className="text-neutral-300">Multiple Slides</strong> mode (available for Posts & Stories) to combine selected items into a single multi-slide carousel.</li>
                <li>Stories can include an optional custom <strong className="text-neutral-300">Link Sticker</strong>.</li>
              </ul>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setReadmeOpen(false)}
              className="ig-gradient rounded-lg px-5 py-2 text-xs font-bold text-white cursor-pointer hover:opacity-95"
            >
              Got it
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
