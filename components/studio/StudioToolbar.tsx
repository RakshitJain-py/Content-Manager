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
}: StudioToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePostClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onPublish();
  };

  // "Multiple Slides" toggle shown on post & story, not reel
  const showMultiSlides = contentType === "post" || contentType === "story";

  return (
    <div className="flex items-center justify-between border-b border-neutral-900 px-4 py-3 bg-[#0a0a0a] min-h-[56px] select-none">
      {/* 1. Left Section: Content types divided by a thin line */}
      <div className="flex items-center gap-2">
        {LEFT_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => onContentTypeChange(type)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors cursor-pointer",
              contentType === type
                ? "ig-gradient text-white"
                : "border border-neutral-800 text-neutral-400 hover:text-white"
            )}
          >
            {type === "reel" ? (
              <Film className="h-3.5 w-3.5" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
            {type}
          </button>
        ))}
      </div>

      {/* Thin line separating content types */}
      <div className="hidden sm:block h-5 w-px bg-neutral-800 mx-3" />

      {/* 2. Center Section: Upload, History, Read Me */}
      <div className="flex items-center gap-2.5 mx-auto">
        {contentType && contentType !== "history" && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-900 px-3.5 py-1.5 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-pink-500" /> Upload media
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

        <button
          onClick={() => onContentTypeChange("history")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
            contentType === "history"
              ? "ig-gradient text-white"
              : "border border-neutral-800 text-neutral-400 hover:text-white bg-neutral-900/30"
          )}
        >
          <History className="h-3.5 w-3.5" /> History
        </button>

        <button
          onClick={onOpenReadme}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 px-3.5 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <BookOpen className="h-3.5 w-3.5 text-blue-400" /> Read Me
        </button>
      </div>

      {/* 3. Right Section: Ordered from right-to-left: Post, Select All, Multiple Slides */}
      <div className="flex items-center gap-2">
        {/* Multiple Slides (left-most in right section) */}
        {contentType && contentType !== "history" && showMultiSlides && (
          <button
            onClick={onToggleStoryBuilding}
            disabled={mediaCount === 0}
            title="Bundle selected media into one post with multiple slides in order"
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer",
              storyBuilding
                ? "ig-gradient border-transparent text-white"
                : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500 hover:text-white"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            Multiple Slides
          </button>
        )}

        {/* Select All (middle in right section) */}
        {contentType && contentType !== "history" && mediaCount > 0 && (
          <button
            onClick={onToggleSelectAll}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/20 px-3 py-1.5 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" /> {allSelected ? "Deselect all" : "Select all"}
          </button>
        )}

        {/* Post (right-most in right section) */}
        {contentType && contentType !== "history" && (
          storyBuilding && selectedCount > 0 ? (
            <button
              onClick={handlePostClick}
              className="ig-gradient flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-[0_4px_20px_-6px_rgba(214,41,118,0.7)] transition-transform hover:scale-[1.02] cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" /> Post ({selectedCount})
            </button>
          ) : !storyBuilding && selectedCount > 0 ? (
            <button
              onClick={handlePostClick}
              className="ig-gradient flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition-transform hover:scale-[1.02] cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" /> Post {selectedCount > 1 ? `(${selectedCount})` : ""}
            </button>
          ) : null
        )}
      </div>
    </div>
  );
}
