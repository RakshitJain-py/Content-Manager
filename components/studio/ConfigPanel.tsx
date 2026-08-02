import { useState } from "react";
import { CalendarClock, Settings2, Upload, Eye } from "lucide-react";
import { ToggleRow } from "@/components/common/ToggleRow";
import { Modal } from "@/components/common/Modal";
import type { ContentType, MediaItem } from "@/types/content";
import { toast } from "sonner";

/** Props for the right-hand configuration panel. */
export interface ConfigPanelProps {
  /** Active content type; `null` renders the hint text. */
  contentType: ContentType | null;
  /** Item shown in the reel thumbnail preview. */
  previewItem: MediaItem | undefined;
  /** Caption text for the current batch. */
  caption: string;
  /** Caption change handler. */
  onCaptionChange: (value: string) => void;
  /** Open the scheduler modal. */
  onOpenScheduler: () => void;
  /** Save caption to database. */
  onSaveCaption?: () => void;
  /** Link for stories. */
  storyLink?: string;
  /** Story link change handler. */
  onStoryLinkChange?: (value: string) => void;
  /** Toggle options. */
  options?: {
    hideLikes: boolean;
    disableComments: boolean;
    shareToFeed: boolean;
    allowRemixing: boolean;
  };
  /** Toggle option change handler. */
  onOptionToggle?: (key: "hideLikes" | "disableComments" | "shareToFeed" | "allowRemixing", value: boolean) => void;
  coverUrl?: string;
  onCoverChange?: (url: string) => void;
  onUploadCover?: (file: File) => Promise<void>;
  isCaptionDirty?: boolean;
  onSaveSettings?: () => void;
  mediaList?: MediaItem[];
  onApplyMediaAsCover?: (mediaId: string) => Promise<void>;
  isSettingsDirty?: boolean;
}

/** Per-content-type settings: thumbnail, caption, story link and toggles. */
export function ConfigPanel({
  contentType,
  previewItem,
  caption,
  onCaptionChange,
  onOpenScheduler,
  onSaveCaption,
  storyLink = "",
  onStoryLinkChange,
  options = { hideLikes: false, disableComments: false, shareToFeed: true, allowRemixing: false },
  onOptionToggle,
  coverUrl = "",
  onCoverChange,
  onUploadCover,
  isCaptionDirty = false,
  onSaveSettings,
  mediaList = [],
  onApplyMediaAsCover,
  isSettingsDirty = false,
}: ConfigPanelProps) {
  const [viewingCoverUrl, setViewingCoverUrl] = useState<string | null>(null);
  const [viewingCaptionText, setViewingCaptionText] = useState<string | null>(null);

  return (
    <aside className="w-full shrink-0 border-t border-neutral-900 p-4 lg:w-64 lg:border-l lg:border-t-0">
      <div className="mb-3 flex items-center gap-2">
        <Settings2 className="h-3.5 w-3.5 text-neutral-500" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">Configuration</span>
      </div>

      {!contentType ? (
        <p className="text-xs text-neutral-600">Select a content type to see its settings.</p>
      ) : (
        <div className="space-y-4">
          {/* Custom Cover Thumbnail section */}
          {contentType === "reel" && (
            <div className="rounded-xl border border-neutral-800 p-2.5">
              <div className="flex items-center gap-3">
                {/* Tiny Thumbnail Square */}
                <div className="w-12 h-12 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center shrink-0 relative overflow-hidden">
                  {coverUrl ? (
                    <img src={coverUrl} alt="custom cover" className="h-full w-full object-cover" />
                  ) : (
                    <label className="cursor-pointer text-neutral-500 hover:text-neutral-300 transition-colors w-full h-full flex items-center justify-center">
                      <Upload className="h-4 w-4 text-neutral-500" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && onUploadCover) onUploadCover(file);
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Cover status and controls */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Thumbnail Cover</p>
                  <div className="flex items-center gap-2 mt-1">
                    {coverUrl ? (
                      <>
                        <button
                          onClick={() => setViewingCoverUrl(coverUrl)}
                          className="p-1 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 rounded cursor-pointer"
                          title="View Cover"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => onCoverChange?.("")}
                          className="text-[10px] font-semibold text-neutral-400 hover:text-red-400 cursor-pointer"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col w-full">
                        <span className="text-[10px] text-neutral-600 italic">None selected</span>
                        {mediaList && mediaList.filter((m) => m.kind === "image").length > 0 && (
                          <select
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val && onApplyMediaAsCover) {
                                onApplyMediaAsCover(val);
                              }
                            }}
                            className="w-full rounded bg-neutral-900 border border-neutral-800 p-1 text-[9px] text-neutral-400 outline-none cursor-pointer mt-1"
                            defaultValue=""
                          >
                            <option value="" disabled>Select from media...</option>
                            {mediaList.filter((m) => m.kind === "image").map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {contentType !== "story" && (
            <div className="rounded-xl border border-neutral-800 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Caption</p>
                {caption && (
                  <button
                    onClick={() => setViewingCaptionText(caption)}
                    className="p-1 hover:bg-neutral-900 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
                    title="View full caption"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                )}
              </div>
              <textarea
                value={caption}
                onChange={(e) => onCaptionChange(e.target.value)}
                rows={2}
                placeholder="Write a caption…"
                className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-xs text-white placeholder:text-neutral-600 outline-none focus:border-neutral-600"
              />
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={() => onCaptionChange(caption + " #reels #instagram")}
                  className="flex-1 rounded-md border border-neutral-800 py-1 text-[10px] text-neutral-400 hover:text-white"
                >
                  Tags
                </button>
                <button
                  onClick={() => onCaptionChange("")}
                  className="flex-1 rounded-md border border-neutral-800 py-1 text-[10px] text-neutral-400 hover:text-white"
                >
                  Clear
                </button>
                <button
                  onClick={onSaveCaption}
                  disabled={!isCaptionDirty}
                  className={isCaptionDirty
                    ? "ig-gradient flex-1 rounded-md py-1 text-[10px] font-bold text-white shadow-[0_4px_12px_-4px_rgba(214,41,118,0.5)] cursor-pointer"
                    : "flex-1 rounded-md border border-neutral-800 bg-neutral-900/50 py-1 text-[10px] font-semibold text-neutral-500 cursor-not-allowed"
                  }
                >
                  Save
                </button>
              </div>
            </div>
          )}


          


          <button
            onClick={() => { }}
            disabled
            className="ig-gradient flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold text-white cursor-not-allowed"
          >
            <CalendarClock className="h-3.5 w-3.5" /> Schedule instead (Coming Soon)
          </button>

          <div className="mt-6 border-t border-neutral-900 pt-4">
            <p className="text-[10px] text-neutral-500 leading-relaxed font-mono">
              <strong className="text-neutral-400">NOTE:</strong> Once published, original media binaries are permanently auto-deleted from our storage to save space. Metadata history logs are retained permanently.
            </p>
          </div>
        </div>
      )}

      {/* Pop-up modal views */}
      {viewingCoverUrl !== null && (
        <Modal title="Thumbnail Cover Preview" onClose={() => setViewingCoverUrl(null)}>
          <div className="flex justify-center bg-neutral-950/80 border border-neutral-800 rounded-lg p-4">
            <div className="max-w-xs w-full aspect-[9/16] overflow-hidden rounded-xl border border-neutral-850">
              <img src={viewingCoverUrl} alt="custom cover preview" className="w-full h-full object-cover" />
            </div>
          </div>
        </Modal>
      )}

      {viewingCaptionText !== null && (
        <Modal title="Caption Preview" onClose={() => setViewingCaptionText(null)}>
          <div className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-4 max-h-[300px] overflow-y-auto">
            <p className="text-sm text-neutral-200 whitespace-pre-wrap select-all">{viewingCaptionText}</p>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setViewingCaptionText(null)}
              className="rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </aside>
  );
}
