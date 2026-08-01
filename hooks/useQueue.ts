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
  lastSavedCaption: string;
  coverUrl: string;
  setCoverUrl: (url: string) => void;
  uploadCover: (file: File) => Promise<void>;
  saveSettings: () => Promise<void>;
  applyMediaAsCover: (mediaId: string) => Promise<void>;
  lastSavedCoverUrl: string;
  isSettingsDirty: boolean;
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
  const [lastSavedCaption, setLastSavedCaption] = useState("");
  const [storyLink, setStoryLink] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [lastSavedCoverUrl, setLastSavedCoverUrl] = useState("");
  const [options, setOptions] = useState<PublishSettings>({
    hideLikes: false,
    disableComments: false,
    shareToFeed: true,
    allowRemixing: false,
  });
  const [lastSavedOptions, setLastSavedOptions] = useState<PublishSettings>({
    hideLikes: false,
    disableComments: false,
    shareToFeed: true,
    allowRemixing: false,
  });
  const [lastSavedStoryLink, setLastSavedStoryLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const setOption = useCallback((key: keyof PublishSettings, value: boolean) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Fetch media queue on mount
  useEffect(() => {
    let active = true;

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

    return () => {
      active = false;
    };
  }, []);

  // Fetch configurations whenever the active content type tab changes
  useEffect(() => {
    if (!contentType || contentType === "history") return;

    setLoading(true);
    setSettingsLoaded(false);

    let active = true;
    fetch(`/api/settings?contentType=${contentType}`)
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success && data.settings) {
          const s = data.settings;
          setCaption(s.caption || "");
          setLastSavedCaption(s.caption || "");
          setStoryLink(s.storyLink || "");
          setLastSavedStoryLink(s.storyLink || "");
          setCoverUrl(s.coverUrl || "");
          setLastSavedCoverUrl(s.coverUrl || "");
          if (s.options) {
            setOptions((prev) => ({ ...prev, ...s.options }));
            setLastSavedOptions((prev) => ({ ...prev, ...s.options }));
          }
        } else {
          // Reset fields to defaults if no custom settings exist for this contentType
          setCaption("");
          setLastSavedCaption("");
          setStoryLink("");
          setLastSavedStoryLink("");
          setCoverUrl("");
          setLastSavedCoverUrl("");
          const defaults = {
            hideLikes: false,
            disableComments: false,
            shareToFeed: true,
            allowRemixing: false,
          };
          setOptions(defaults);
          setLastSavedOptions(defaults);
        }
      })
      .catch((err) => console.error("Error loading settings:", err))
      .finally(() => {
        if (active) {
          setTimeout(() => {
            if (active) setSettingsLoaded(true);
          }, 100);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [contentType]);

  // Sync content type tab choice to localStorage
  useEffect(() => {
    if (contentType && contentType !== "history") {
      localStorage.setItem("cm_contentType", contentType);
    }
  }, [contentType]);

  const saveSettings = useCallback(async () => {
    if (!contentType || contentType === "history") return;

    const promise = fetch("/api/settings", {
      method: "POST",
      body: JSON.stringify({
        contentType,
        settings: {
          caption,
          storyLink,
          coverUrl,
          options,
        },
      }),
      headers: { "Content-Type": "application/json" },
    }).then(async (res) => {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save configurations");
      }
      setLastSavedCaption(caption);
      setLastSavedCoverUrl(coverUrl);
      setLastSavedStoryLink(storyLink);
      setLastSavedOptions(options);
      return res.json();
    });

    toast.promise(promise, {
      loading: "Saving settings...",
      success: "Settings saved successfully!",
      error: (err) => `Failed to save settings: ${err.message || err}`,
    });
  }, [contentType, caption, storyLink, coverUrl, options]);

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
        body: JSON.stringify({ caption, contentType }),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save caption");
      }
      setLastSavedCaption(caption);
      toast.success("Caption saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save caption");
    }
  }, [caption, contentType]);

  const uploadCover = useCallback(async (file: File) => {
    // Check session client-side first
    const session = await getCurrentSession();
    if (!session || !session.success) {
      onLoginRequired();
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const promise = fetch(`/api/media/upload?type=cover&contentType=${contentType}`, {
      method: "POST",
      body: formData,
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed with status ${res.status}`);
        }
        const data = await res.json();
        if (data.success && data.data?.cloudinaryUrl) {
          setCoverUrl(data.data.cloudinaryUrl);
          return data.data.cloudinaryUrl;
        } else {
          throw new Error(data.error || "Failed to upload cover thumbnail");
        }
      });

    toast.promise(promise, {
      loading: "Uploading cover thumbnail...",
      success: "Cover thumbnail uploaded successfully!",
      error: (err) => `Thumbnail upload failed: ${err.message || err}`,
    });
  }, [contentType, onLoginRequired]);

  const applyMediaAsCover = useCallback(async (mediaId: string) => {
    // Check session client-side first
    const session = await getCurrentSession();
    if (!session || !session.success) {
      onLoginRequired();
      return;
    }

    const promise = fetch("/api/media/apply-cover", {
      method: "POST",
      body: JSON.stringify({
        mediaId,
        currentCoverUrl: coverUrl,
      }),
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Apply cover failed with status ${res.status}`);
        }
        const data = await res.json();
        if (data.success && data.coverUrl) {
          setCoverUrl(data.coverUrl);
          return data.coverUrl;
        } else {
          throw new Error(data.error || "Failed to apply cover");
        }
      });

    toast.promise(promise, {
      loading: "Applying media as cover...",
      success: "Media applied as cover successfully!",
      error: (err) => `Failed to apply cover: ${err.message || err}`,
    });
  }, [coverUrl, onLoginRequired]);

  const postMedia = useCallback(async (id: string, targetAccountIds: string[]) => {
    if (targetAccountIds.length === 0) {
      toast.error("Please select at least one account to publish to.");
      return;
    }
    const item = media.find((m) => m.id === id);
    if (!item) return;

    // Pre-validate: Reels only support videos
    if (contentType === "reel" && item.kind === "image") {
      toast.error(`"${item.name}" is an image — only videos can be published as Reels.`);
      return;
    }

    const promise = fetch("/api/media/publish", {
      method: "POST",
      body: JSON.stringify({
        mediaIds: [id],
        accountIds: targetAccountIds,
        contentType,
        options: {
          caption,
          storyLink,
          coverUrl, // Pass custom cover/thumbnail
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
      
      const itemResult = data.results?.find((r: any) => r.id === id);
      if (itemResult && !itemResult.success) {
        throw new Error(itemResult.error || "Failed to publish to Instagram");
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
  }, [media, contentType, caption, storyLink, coverUrl, options]);

  const postSelected = useCallback(async (targetAccountIds: string[]) => {
    if (selectedIds.length === 0) {
      toast.error("No media items selected.");
      return;
    }
    if (targetAccountIds.length === 0) {
      toast.error("Please select at least one account to publish to.");
      return;
    }

    // Pre-validate: Reels only support videos
    if (contentType === "reel") {
      const selectedItems = media.filter((m) => selectedIds.includes(m.id));
      const imageItems = selectedItems.filter((m) => m.kind === "image");
      if (imageItems.length > 0) {
        toast.error(
          imageItems.length === 1
            ? `"${imageItems[0].name}" is an image — only videos can be published as Reels.`
            : `${imageItems.length} selected item(s) are images — only videos can be published as Reels.`
        );
        return;
      }
    }

    // Carousel mode: multiple slides into one post
    const carouselMode = storyBuilding && selectedIds.length > 1 && (contentType === "post" || contentType === "story");

    const promise = fetch("/api/media/publish", {
      method: "POST",
      body: JSON.stringify({
        mediaIds: selectedIds,
        accountIds: targetAccountIds,
        contentType,
        carouselMode,
        options: {
          caption,
          storyLink,
          coverUrl,
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

      const failed = data.results?.filter((r: any) => !r.success) || [];
      if (failed.length > 0) {
        const failedIds = failed.map((f: any) => f.id);
        const succeededIds = selectedIds.filter((sid) => !failedIds.includes(sid));

        setMedia((list) => list.filter((m) => !succeededIds.includes(m.id)));
        setSelectedIds(failedIds); // Keep only failed items selected

        // Surface specific error messages from failed items
        const firstError = failed[0]?.error;
        throw new Error(firstError || `${failed.length} item(s) failed to publish.`);
      }

      setMedia((list) => list.filter((m) => !selectedIds.includes(m.id)));
      setSelectedIds([]);
      return data;
    });

    toast.promise(promise, {
      loading: carouselMode
        ? `Publishing ${selectedIds.length} slides as one post...`
        : `Publishing ${selectedIds.length} item(s) to Instagram...`,
      success: carouselMode
        ? `Carousel post published successfully!`
        : `Successfully published ${selectedIds.length} item(s)!`,
      error: (err) => `Failed to publish: ${err.message || err}`,
    });
  }, [selectedIds, media, contentType, storyBuilding, caption, storyLink, coverUrl, options]);

  const allSelected = media.length > 0 && selectedIds.length === media.length;

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((ids) => (media.length > 0 && ids.length === media.length ? [] : media.map((m) => m.id)));
  }, [media]);

  const toggleStoryBuilding = useCallback(() => setStoryBuilding((v) => !v), []);

  const previewItem = useMemo(() => {
    const id = selectedIds[0] ?? media[0]?.id;
    return media.find((m) => m.id === id);
  }, [media, selectedIds]);

  const isSettingsDirty = useMemo(() => {
    return (
      coverUrl !== lastSavedCoverUrl ||
      storyLink !== lastSavedStoryLink ||
      options.hideLikes !== lastSavedOptions.hideLikes ||
      options.disableComments !== lastSavedOptions.disableComments ||
      options.shareToFeed !== lastSavedOptions.shareToFeed ||
      options.allowRemixing !== lastSavedOptions.allowRemixing
    );
  }, [
    coverUrl,
    lastSavedCoverUrl,
    storyLink,
    lastSavedStoryLink,
    options.hideLikes,
    lastSavedOptions.hideLikes,
    options.disableComments,
    lastSavedOptions.disableComments,
    options.shareToFeed,
    lastSavedOptions.shareToFeed,
    options.allowRemixing,
    lastSavedOptions.allowRemixing,
  ]);

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
    lastSavedCaption,
    coverUrl,
    setCoverUrl,
    uploadCover,
    saveSettings,
    applyMediaAsCover,
    lastSavedCoverUrl,
    isSettingsDirty,
  };
}
