import { useRef } from "react";
import { Check, Film, Image as ImageIcon, Plus, Send, Upload } from "lucide-react";
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
  /** Story flow: whether an ordered story batch is being built. */
  storyBuilding: boolean;
  /** Toggle the story flow. */
  onToggleStoryBuilding: () => void;
  /** Callback to check publish access before posting */
  onPublish: () => void;
}

const TYPES: ReadonlyArray<ContentType> = ["post", "reel", "story"];

/** Content-type switcher, uploader and batch publish actions. */
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
}: StudioToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePostClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onPublish();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-900 px-4 py-3">
      {TYPES.map((type) => (
        <button
          key={type}
          onClick={() => onContentTypeChange(type)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors",
            contentType === type
              ? "ig-gradient text-white"
              : "border border-neutral-800 text-neutral-400 hover:text-white",
          )}
        >
          {type === "reel" ? <Film className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
          {type}
        </button>
      ))}

      <div className="mx-1 h-5 w-px bg-neutral-800" />

      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:text-white"
      >
        <Upload className="h-3.5 w-3.5" /> Upload media
      </button>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      {mediaCount > 0 && (
        <button
          onClick={onToggleSelectAll}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:text-white"
        >
          <Check className="h-3.5 w-3.5" /> {allSelected ? "Deselect all" : "Select all"}
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {contentType === "story" ? (
          storyBuilding && selectedCount > 0 ? (
            // POST button — always visible and clearly styled
            <button
              onClick={handlePostClick}
              className="ig-gradient flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-[0_4px_20px_-6px_rgba(214,41,118,0.7)]"
            >
              <Send className="h-3.5 w-3.5" /> Post ({selectedCount})
            </button>
          ) : (
            // CREATE STORY button
            <button
              onClick={onToggleStoryBuilding}
              disabled={mediaCount === 0}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Create story post
            </button>
          )
        ) : (
          selectedCount > 1 && (
            <button
              onClick={handlePostClick}
              className="ig-gradient flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white"
            >
              <Send className="h-3.5 w-3.5" /> Post {selectedCount} items
            </button>
          )
        )}
      </div>
    </div>
  );
}
