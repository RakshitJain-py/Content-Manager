import { CalendarClock, Link2, Settings2 } from "lucide-react";
import { ToggleRow } from "@/components/common/ToggleRow";
import type { ContentType, MediaItem } from "@/types/content";

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
}: ConfigPanelProps) {
  return (
    <aside className="w-full shrink-0 border-t border-neutral-900 p-4 lg:w-80 lg:border-l lg:border-t-0">
      <div className="mb-3 flex items-center gap-2">
        <Settings2 className="h-3.5 w-3.5 text-neutral-500" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">Configuration</span>
      </div>

      {!contentType ? (
        <p className="text-xs text-neutral-600">Select a content type to see its settings.</p>
      ) : (
        <div className="space-y-4">
          {contentType === "reel" && previewItem && (
            <div className="rounded-xl border border-neutral-800 p-3">
              <p className="mb-2 text-[11px] text-neutral-500">Thumbnail</p>
              <div className="aspect-[9/16] w-full overflow-hidden rounded-lg bg-neutral-900">
                {previewItem.kind === "image" ? (
                  <img src={previewItem.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <video src={previewItem.url} className="h-full w-full object-cover" muted />
                )}
              </div>
            </div>
          )}

          {contentType !== "story" && (
            <div className="rounded-xl border border-neutral-800 p-3">
              <p className="mb-2 text-[11px] text-neutral-500">Caption</p>
              <textarea
                value={caption}
                onChange={(e) => onCaptionChange(e.target.value)}
                rows={4}
                placeholder="Write a caption… #hashtags"
                className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 p-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-neutral-600"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onCaptionChange(caption + " #reels #instagram")}
                  className="flex-1 rounded-md border border-neutral-800 py-1.5 text-[10px] text-neutral-300 hover:text-white"
                >
                  Tags
                </button>
                <button
                  onClick={() => onCaptionChange("")}
                  className="flex-1 rounded-md border border-neutral-800 py-1.5 text-[10px] text-neutral-300 hover:text-white"
                >
                  Clear
                </button>
                <button
                  onClick={onSaveCaption}
                  className="ig-gradient flex-1 rounded-md py-1.5 text-[10px] font-semibold text-white"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {contentType === "story" && (
            <div className="rounded-xl border border-neutral-800 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] text-neutral-500">
                <Link2 className="h-3 w-3" /> Story link
              </p>
              <input
                value={storyLink}
                onChange={(e) => onStoryLinkChange?.(e.target.value)}
                placeholder="https://example.com"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-neutral-600"
              />
            </div>
          )}

          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">Options</p>
            {contentType === "reel" && (
              <>
                <ToggleRow
                  label="Hide likes and views"
                  defaultOn={options.hideLikes}
                  onChange={(val) => onOptionToggle?.("hideLikes", val)}
                />
                <ToggleRow
                  label="Share to feed"
                  defaultOn={options.shareToFeed}
                  onChange={(val) => onOptionToggle?.("shareToFeed", val)}
                />
                <ToggleRow
                  label="Allow remixing"
                  defaultOn={options.allowRemixing}
                  onChange={(val) => onOptionToggle?.("allowRemixing", val)}
                />
              </>
            )}
            {contentType === "post" && (
              <>
                <ToggleRow
                  label="Hide like counts"
                  defaultOn={options.hideLikes}
                  onChange={(val) => onOptionToggle?.("hideLikes", val)}
                />
                <ToggleRow
                  label="Turn off commenting"
                  defaultOn={options.disableComments}
                  onChange={(val) => onOptionToggle?.("disableComments", val)}
                />
              </>
            )}
          </div>

          <button
            onClick={onOpenScheduler}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-800 py-2.5 text-xs text-neutral-300 hover:text-white"
          >
            <CalendarClock className="h-3.5 w-3.5" /> Schedule instead
          </button>
        </div>
      )}
    </aside>
  );
}
