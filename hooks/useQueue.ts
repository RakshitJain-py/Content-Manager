"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type ContentType, type MediaItem } from "@/types/content";
import { getMediaAction, uploadMediaAction, removeMediaAction } from "@/app/actions/studio";
import { getCurrentSession } from "@/app/actions/auth";
import { toast } from "sonner";

export interface UploadingFile {
  id: string;
  name: string;
}

export interface PublishSettings {
  hideLikes: boolean;
  disableComments: boolean;
  shareToFeed: boolean;
  allowRemixing: boolean;
}

export interface UseQueueResult {
  contentType: ContentType | null;
  setContentType: (type: ContentType) => void;
  media: MediaItem[];
  uploadingFiles: UploadingFile[];
  selectedIds: string[];
  allSelected: boolean;
  previewItem: MediaItem | undefined;
  addFiles: (files: FileList | null) => Promise<void>;
  toggleMedia: (id: string) => void;
  toggleSelectAll: () => void;
  removeMedia: (id: string) => Promise<void>;
  storyBuilding: boolean;
  toggleStoryBuilding: () => void;
  caption: string;
  setCaption: (value: string) => void;
  saveCaption: () => Promise<void>;
  storyLink: string;
  setStoryLink: (url: string) => void;
  options: PublishSettings;
  setOption: (key: keyof PublishSettings, value: boolean) => void;
  postMedia: (id: string, targetAccountIds: string[]) => Promise<void>;
  postSelected: (targetAccountIds: string[]) => Promise<void>;
  loading: boolean;
  /** Fired when an unauthenticated user tries to do a restricted action — show login gate */
  onLoginRequired: () => void;
}

export function useQueue(onLoginRequired: () => void): UseQueueResult {
  const [contentType, setContentTypeState] = useState<ContentType | null>(null);

  // Restore content type from localStorage after mount to avoid SSR hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem("cm_contentType") as ContentType | null;
    if (saved && ["post", "reel", "story"].includes(saved)) {
      setContentTypeState(saved);
    }
  }, []);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [storyBuilding, setStoryBuilding] = useState(false);
  const [caption, setCaption] = useState("");
  const [storyLink, setStoryLink] = useState("");
  const [options, setOptions] = useState<PublishSettings>({
    hideLikes: false,
    disableComments: false,
    shareToFeed: true,
    allowRemixing: false,
  });
  const [loading, setLoading] = useState(true);

  const setOption = useCallback((key: keyof PublishSettings, value: boolean) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Fetch media & caption on mount
  useEffect(() => {
    let active = true;

    // Load media
    getMediaAction()
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) {
          const mapped: MediaItem[] = res.data
            .filter((m) => m !== null && m !== undefined)
            .map((m) => ({
              id: m!.id,
              name: m!.filename || "unnamed",
              url: m!.cloudinaryUrl || "",
              kind: m!.mediaType === "video" ? "video" : "image",
            }));
          setMedia(mapped);
        }
      })
      .catch((err) => {
        console.error("Error loading media queue:", err);
      });

    // Load caption
    fetch("/api/caption")
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success) {
          setCaption(data.caption || "");
        }
      })
      .catch((err) => console.error("Error loading caption:", err))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const setContentType = useCallback((type: ContentType) => {
    setContentTypeState(type);
    localStorage.setItem("cm_contentType", type);
    setSelectedIds([]);
    setStoryBuilding(false);
  }, []);

  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;

    // Check session client-side first — show modal if not logged in
    const session = await getCurrentSession();
    if (!session || !session.success) {
      onLoginRequired();
      return;
    }

    const MAX_SIZE = 40 * 1024 * 1024; // 40MB

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > MAX_SIZE) {
        toast.error(`File "${file.name}" exceeds the 40MB size limit.`);
        continue;
      }

      // Add to uploading queue
      const tempId = Math.random().toString(36).slice(2, 9);
      setUploadingFiles((prev) => [...prev, { id: tempId, name: file.name }]);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/media/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed with status ${response.status}`);
        }

        const res = await response.json();
        if (res.success && res.data) {
          const newItem: MediaItem = {
            id: res.data.id,
            name: res.data.filename || file.name,
            url: res.data.cloudinaryUrl || "",
            kind: res.data.mediaType === "video" ? "video" : "image",
          };
          setMedia((list) => [newItem, ...list]);
        } else {
          console.error("Failed to upload file:", res.error);
          toast.error(`Failed to upload "${file.name}": ${res.error}`);
        }
      } catch (err: any) {
        console.error(`Error uploading file ${file.name}:`, err);
        toast.error(`Error uploading "${file.name}": ${err.message || err}`);
      } finally {
        // Remove from uploading queue
        setUploadingFiles((prev) => prev.filter((f) => f.id !== tempId));
      }
    }
  }, [onLoginRequired]);

  const toggleMedia = useCallback((id: string) => {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }, []);

  const removeMedia = useCallback(async (id: string) => {
    try {
      // Check session client-side first — show modal if not logged in
      const session = await getCurrentSession();
      if (!session || !session.success) {
        onLoginRequired();
        return;
      }

      const res = await removeMediaAction(id);
      if (!res.success) {
        throw new Error(res.error || "Failed to remove media");
      }
      setMedia((list) => list.filter((m) => m.id !== id));
      setSelectedIds((ids) => ids.filter((x) => x !== id));
    } catch (err) {
      console.error("Error deleting media:", err);
    }
  }, [onLoginRequired]);

  const saveCaption = useCallback(async () => {
    try {
      const response = await fetch("/api/caption", {
        method: "POST",
        body: JSON.stringify({ caption }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save caption");
      }
      toast.success("Caption saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save caption");
    }
  }, [caption]);

  const postMedia = useCallback(async (id: string, targetAccountIds: string[]) => {
    if (targetAccountIds.length === 0) {
      toast.error("Please select at least one account to publish to.");
      return;
    }
    const item = media.find((m) => m.id === id);
    if (!item) return;

    const promise = fetch("/api/media/publish", {
      method: "POST",
      body: JSON.stringify({
        mediaIds: [id],
        accountIds: targetAccountIds,
        contentType,
        options: {
          caption,
          storyLink,
          hideLikes: options.hideLikes,
          disableComments: options.disableComments,
          shareToFeed: options.shareToFeed,
          allowRemixing: options.allowRemixing,
        },
      }),
      headers: { "Content-Type": "application/json" },
    }).then(async (response) => {
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to publish");
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Publish failed");
      }
      setMedia((list) => list.filter((m) => m.id !== id));
      setSelectedIds((ids) => ids.filter((x) => x !== id));
      return data;
    });

    toast.promise(promise, {
      loading: `Publishing "${item.name}" to Instagram...`,
      success: `Successfully published "${item.name}"!`,
      error: (err) => `Failed to publish: ${err.message || err}`,
    });
  }, [media, contentType, caption, storyLink, options]);

  const postSelected = useCallback(async (targetAccountIds: string[]) => {
    if (selectedIds.length === 0) {
      toast.error("No media items selected.");
      return;
    }
    if (targetAccountIds.length === 0) {
      toast.error("Please select at least one account to publish to.");
      return;
    }

    const promise = fetch("/api/media/publish", {
      method: "POST",
      body: JSON.stringify({
        mediaIds: selectedIds,
        accountIds: targetAccountIds,
        contentType,
        options: {
          caption,
          storyLink,
          hideLikes: options.hideLikes,
          disableComments: options.disableComments,
          shareToFeed: options.shareToFeed,
          allowRemixing: options.allowRemixing,
        },
      }),
      headers: { "Content-Type": "application/json" },
    }).then(async (response) => {
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to publish batch");
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Publish batch failed");
      }
      setMedia((list) => list.filter((m) => !selectedIds.includes(m.id)));
      setSelectedIds([]);
      return data;
    });

    toast.promise(promise, {
      loading: `Publishing ${selectedIds.length} item(s) to Instagram...`,
      success: `Successfully published ${selectedIds.length} item(s)!`,
      error: (err) => `Failed to publish batch: ${err.message || err}`,
    });
  }, [selectedIds, contentType, caption, storyLink, options]);

  const allSelected = media.length > 0 && selectedIds.length === media.length;

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((ids) => (media.length > 0 && ids.length === media.length ? [] : media.map((m) => m.id)));
  }, [media]);

  const toggleStoryBuilding = useCallback(() => setStoryBuilding((v) => !v), []);

  const previewItem = useMemo(() => {
    const id = selectedIds[0] ?? media[0]?.id;
    return media.find((m) => m.id === id);
  }, [media, selectedIds]);

  return {
    contentType,
    setContentType,
    media,
    uploadingFiles,
    selectedIds,
    allSelected,
    previewItem,
    addFiles,
    toggleMedia,
    toggleSelectAll,
    removeMedia,
    storyBuilding,
    toggleStoryBuilding,
    caption,
    setCaption,
    saveCaption,
    storyLink,
    setStoryLink,
    options,
    setOption,
    postMedia,
    postSelected,
    loading,
    onLoginRequired,
  };
}
