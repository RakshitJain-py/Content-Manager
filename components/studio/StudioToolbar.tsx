"use client";

import { useRef } from "react";
import { Check, Film, Image as ImageIcon, Layers, Send, Upload, History, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentType } from "@/types/content";

/** Props for the workspace toolbar above the media queue. */
export interface StudioToolbarProps {
  /** Active content type, or null when nothing is chosen yet. */
  contentType: ContentType | null;
  /** Change the content type. */
  onContentTypeChange: (type: ContentType) => void;
  /** Number of queued media items (controls which actions are shown). */
  mediaCount: number;
  /** Number of selected media items. */
  selectedCount: number;
  /** True when every queued item is selected. */
  allSelected: boolean;
  /** Files chosen from the device file picker. */
  onFiles: (files: FileList | null) => void;
  /** Select-all / deselect-all. */
  onToggleSelectAll: () => void;
  /** Whether Multiple Slides (ordered batch) mode is active. */
  storyBuilding: boolean;
  /** Toggle Multiple Slides mode. */
  onToggleStoryBuilding: () => void;
  /** Callback to check publish access before posting */
  onPublish: () => void;
  /** Callback to open the Read Me modal */
  onOpenReadme: () => void;
  /** True when a publishing action is currently executing. */
  isPublishing?: boolean;
}

const LEFT_TYPES: ReadonlyArray<Exclude<ContentType, "history">> = ["post", "reel", "story"];

export function StudioToolbar({
  contentType,
  onContentTypeChange,
  mediaCount,
  selectedCount,
  allSelected,
  onFiles,
  onToggleSelectAll,
  storyBuilding,
  onToggleStoryBuilding,
  onPublish,
  onOpenReadme,
  isPublishing = false,
}: StudioToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePostClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onPublish();
  };

  // "Multiple Slides" toggle shown on post & story, not reel
  const showMultiSlides = contentType === "post" || contentType === "story";

  return (
    <div className="flex items-center justify-between border-b border-neutral-900 px-4 py-2.5 bg-[#0a0a0a] min-h-[48px] select-none">
      {/* 1. Left Group: Content Type Tabs (including History) */}
      <div className="flex items-center gap-1.5">
        {LEFT_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => onContentTypeChange(type)}
            className={cn(
              "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-colors cursor-pointer",
              contentType === type
                ? "ig-gradient text-white"
                : "border border-neutral-800 text-neutral-400 hover:text-white"
            )}
          >
            {type === "reel" ? (
              <Film className="h-3 w-3" />
            ) : (
              <ImageIcon className="h-3 w-3" />
            )}
            {type}
          </button>
        ))}

        <div className="h-4 w-px bg-neutral-800 mx-1" />

        <button
          onClick={() => onContentTypeChange("history")}
          className={cn(
            "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer",
            contentType === "history"
              ? "ig-gradient text-white"
              : "border border-neutral-800 text-neutral-400 hover:text-white bg-neutral-900/30"
          )}
        >
          <History className="h-3 w-3" /> History
        </button>
      </div>

      {/* 2. Center Group: Action & Selection Tools */}
      <div className="flex items-center gap-2">
        {contentType && contentType !== "history" && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 px-2.5 py-1.5 text-[11px] text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <Upload className="h-3 w-3 text-pink-500" /> Upload
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,video/mp4,video/quicktime"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </>
        )}

        {contentType && contentType !== "history" && showMultiSlides && (
          <button
            onClick={onToggleStoryBuilding}
            disabled={mediaCount === 0}
            title="Bundle selected media into one post with multiple slides in order"
            className={cn(
              "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40 cursor-pointer",
              storyBuilding
                ? "ig-gradient border-transparent text-white"
                : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500 hover:text-white"
            )}
          >
            <Layers className="h-3 w-3" />
            Slides
          </button>
        )}

        {contentType && contentType !== "history" && mediaCount > 0 && (
          <button
            onClick={onToggleSelectAll}
            className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/20 px-2.5 py-1.5 text-[11px] text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <Check className="h-3 w-3" /> {allSelected ? "Deselect" : "Select all"}
          </button>
        )}
      </div>

      {/* 3. Right Group: Help (Read Me) & Publish Action */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenReadme}
          className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 px-2.5 py-1.5 text-[11px] text-neutral-455 hover:text-white transition-colors cursor-pointer"
        >
          <BookOpen className="h-3 w-3 text-blue-400" /> Guide
        </button>

        {contentType && contentType !== "history" && (
          storyBuilding && selectedCount > 0 ? (
            <button
              onClick={handlePostClick}
              disabled={isPublishing}
              className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition-all cursor-pointer",
                isPublishing 
                  ? "bg-neutral-800 border border-neutral-700 text-neutral-500 cursor-not-allowed opacity-50"
                  : "ig-gradient shadow-[0_4px_20px_-6px_rgba(214,41,118,0.7)] hover:scale-[1.02]"
              )}
            >
              {isPublishing ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-600 border-t-pink-500 shrink-0" />
                  Posting
                </>
              ) : (
                <>
                  <Send className="h-3 w-3" /> Post ({selectedCount})
                </>
              )}
            </button>
          ) : !storyBuilding && selectedCount > 0 ? (
            <button
              onClick={handlePostClick}
              disabled={isPublishing}
              className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white transition-all cursor-pointer",
                isPublishing 
                  ? "bg-neutral-800 border border-neutral-700 text-neutral-500 cursor-not-allowed opacity-50"
                  : "ig-gradient hover:scale-[1.02]"
              )}
            >
              {isPublishing ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-600 border-t-pink-500 shrink-0" />
                  Posting
                </>
              ) : (
                <>
                  <Send className="h-3 w-3" /> Post {selectedCount > 1 ? `(${selectedCount})` : ""}
                </>
              )}
            </button>
          ) : null
        )}
      </div>
    </div>
  );
}
