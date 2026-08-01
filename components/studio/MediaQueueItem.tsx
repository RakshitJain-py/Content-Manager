import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentType, MediaItem } from "@/types/content";

/** Props for one row in the media publish queue. */
export interface MediaQueueItemProps {
  /** The media record rendered by this row. */
  item: MediaItem;
  /** Content type this item will be published as. */
  contentType: ContentType;
  /** Zero-based position in the selection, or -1 when unselected. */
  selectionIndex: number;
  /** True when the selection should display an order number (story flow). */
  ordered: boolean;
  /** Toggle this item's selection. */
  onToggle: (id: string) => void;
  /** Remove this item from the queue. */
  onRemove: (id: string) => void;
  /** Callback to check publish access before posting */
  onPublish: () => void;
}

/** A single uploaded file with select, preview, remove and post actions. */
export function MediaQueueItem({
  item,
  contentType,
  selectionIndex,
  ordered,
  onToggle,
  onRemove,
  onPublish,
}: MediaQueueItemProps) {
  const selected = selectionIndex > -1;

  const handlePostClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onPublish();
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-neutral-900/40 p-2.5 transition-colors",
        selected ? "border-pink-500/60" : "border-neutral-800",
      )}
    >
      <button
        onClick={() => onToggle(item.id)}
        aria-label="Select media"
        aria-pressed={selected}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
          selected ? "ig-gradient border-transparent" : "border-neutral-600",
        )}
      >
        {selected && (ordered ? selectionIndex + 1 : <Check className="h-3 w-3" />)}
      </button>

      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-neutral-800">
        {item.kind === "image" ? (
          <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <video src={item.url} className="h-full w-full object-cover" muted />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-neutral-200">{item.name}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          {item.kind} · {contentType}
        </p>
      </div>

      <button
        onClick={() => onRemove(item.id)}
        className="rounded-md p-2 text-neutral-500 hover:text-white"
        aria-label="Remove media"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {contentType !== "story" && (
        <button 
          onClick={handlePostClick}
          className="ig-gradient rounded-lg px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em]"
        >
          Post
        </button>
      )}
    </div>
  );
}
