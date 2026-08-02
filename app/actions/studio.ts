"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentSession } from "./auth";
import { uploadFile, deleteFile, resolveContentType, resolveMediaType, createSignedUploadUrl } from "@/lib/storage";

export interface ActionResponse<T> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Fetch all accounts. Return empty list if not logged in.
 */
export async function getAccountsAction(): Promise<ActionResponse<any[]>> {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId) {
      // Allow guest users to see empty list
      return { success: true, data: [] };
    }

    const accounts = await db.getAccounts(session.ownerId, session.role);
    return { success: true, data: accounts };
  } catch (err: any) {
    console.error("getAccountsAction error:", err);
    return { success: false, error: err.message || "Failed to fetch accounts" };
  }
}

/**
 * Add a new Instagram account. Restricted to logged-in users/admins.
 */
export async function addAccountAction(data: { id: string; name: string; accessToken: string }): Promise<ActionResponse<any>> {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return { success: false, error: "Unauthorized" };
    }

    const account = await db.addAccount({
      id: data.id,
      name: data.name,
      ownerId: session.ownerId,
      ownerRole: session.role,
      accessToken: data.accessToken
    });
    return { success: true, data: account };
  } catch (err: any) {
    console.error("addAccountAction error:", err);
    return { success: false, error: err.message || "Failed to add account" };
  }
}

/**
 * Confirm and activate an Instagram account. Restricted to owner or admin.
 */
export async function confirmAccountAction(id: string, name: string): Promise<ActionResponse<any>> {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId) {
      return { success: false, error: "Unauthorized" };
    }

    const account = await db.getAccountById(id);
    if (!account) {
      return { success: false, error: "Account not found" };
    }

    if (session.role !== "admin" && account.ownerId !== session.ownerId) {
      return { success: false, error: "Forbidden" };
    }

    const updated = await db.updateAccount(id, { isActive: true, name });
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("confirmAccountAction error:", err);
    return { success: false, error: err.message || "Failed to confirm account" };
  }
}

/**
 * Remove an Instagram account. Restricted to owner or admin.
 */
export async function removeAccountAction(id: string): Promise<ActionResponse<any>> {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success) {
      return { success: false, error: "Unauthorized" };
    }

    const account = await db.query("SELECT * FROM accounts WHERE id = $1", [id]);
    if (account.rows.length === 0) {
      return { success: false, error: "Account not found" };
    }

    if (session.role !== "admin" && account.rows[0].owner_id !== session.ownerId) {
      return { success: false, error: "Forbidden" };
    }

    const removed = await db.removeAccount(id);
    return { success: true, data: removed };
  } catch (err: any) {
    console.error("removeAccountAction error:", err);
    return { success: false, error: err.message || "Failed to remove account" };
  }
}

/**
 * Fetch all media items. Return empty list if not logged in.
 */
export async function getMediaAction(): Promise<ActionResponse<any[]>> {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId) {
      // Allow guest users to see empty list
      return { success: true, data: [] };
    }

    const media = await db.getAllMedia(session.ownerId, session.role);
    const activeMedia = media.filter(m => m && m.status !== "published");
    return { success: true, data: activeMedia };
  } catch (err: any) {
    console.error("getMediaAction error:", err);
    return { success: false, error: err.message || "Failed to fetch media" };
  }
}

/**
 * Upload a media file. Restricted to logged-in users/admins.
 */
export async function uploadMediaAction(formData: FormData): Promise<ActionResponse<any>> {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return { success: false, error: "Unauthorized" };
    }

    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    const id = Math.random().toString(36).slice(2, 9);
    const fileExtension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    
    if (fileExtension === "webp") {
      return {
        success: false,
        error: "WebP images are not supported by the Instagram Graph API. Please upload JPG/PNG images or MP4/MOV videos instead."
      };
    }

    const storagePath = `uploads/${session.ownerId}/${id}.${fileExtension}`;

    // Resolve correct MIME type — Windows often sends empty type for .mp4
    const contentType = resolveContentType(file.type, file.name);
    const mediaType = resolveMediaType(contentType);

    console.log(`[upload] Starting: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB, ${contentType}) → ${storagePath}`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Upload to Supabase Storage
    const publicUrl = await uploadFile(buffer, storagePath, contentType);
    console.log(`[upload] Storage OK: ${publicUrl}`);

    // Register in DB
    await db.addMedia({
      id,
      filename: file.name,
      mediaType,
      ownerId: session.ownerId,
      ownerRole: session.role
    });
    console.log(`[upload] DB insert OK: id=${id}`);

    // Update with the URL column
    const updatedItem = await db.updateMedia(id, { cloudinaryUrl: publicUrl });
    console.log(`[upload] DB update OK:`, updatedItem);
    return { success: true, data: updatedItem };
  } catch (err: any) {
    console.error("uploadMediaAction error:", err);
    return { success: false, error: err.message || "Failed to upload media" };
  }
}

/**
 * Remove a media item. Restricted to owner or admin.
 */
export async function removeMediaAction(id: string): Promise<ActionResponse<any>> {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success) {
      return { success: false, error: "Unauthorized" };
    }

    const media = await db.getMediaById(id);
    console.log(`[delete] id=${id} found:`, !!media, media ? `owner=${media.ownerId}` : '');
    if (!media) {
      return { success: false, error: "Media not found" };
    }

    if (session.role !== "admin" && media.ownerId !== session.ownerId) {
      return { success: false, error: "Forbidden" };
    }

    // Delete from Storage if it exists
    if (media.cloudinaryUrl) {
      try {
        await deleteFile(media.cloudinaryUrl);
      } catch (err) {
        console.error(`Storage file deletion failed:`, err);
      }
    }

    const removed = await db.removeMedia(id);
    return { success: true, data: removed };
  } catch (err: any) {
    console.error("removeMediaAction error:", err);
    return { success: false, error: err.message || "Failed to remove media" };
  }
}

/**
 * Update media details. Restricted to owner or admin.
 */
export async function updateMediaAction(id: string, updates: Record<string, any>): Promise<ActionResponse<any>> {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success) {
      return { success: false, error: "Unauthorized" };
    }

    const media = await db.getMediaById(id);
    if (!media) {
      return { success: false, error: "Media not found" };
    }

    if (session.role !== "admin" && media.ownerId !== session.ownerId) {
      return { success: false, error: "Forbidden" };
    }

    const updated = await db.updateMedia(id, updates);
    return {
      success: true,
      data: updated
    };
  } catch (err: any) {
    console.error("updateMediaAction error:", err);
    return { success: false, error: err.message || "Failed to update media" };
  }
}

/**
 * Fetch all publish history logs (all statuses: published, failed, uploading).
 */
export async function getPublishHistoryAction(): Promise<ActionResponse<any[]>> {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId) {
      return { success: true, data: [] };
    }

    const allMedia = await db.getAllMedia(session.ownerId, session.role);
    // Include all non-pending items as history logs
    const logs = allMedia.filter((m) => m && m.status && m.status !== "pending" && m.status !== "approved");
    return { success: true, data: logs };
  } catch (err: any) {
    console.error("getPublishHistoryAction error:", err);
    return { success: false, error: err.message || "Failed to fetch publish history" };
  }
}

/**
 * Get admin telegram username setting.
 */
export async function getAdminTelegramAction(): Promise<ActionResponse<string>> {
  try {
    const val = await db.getSystemSetting("admin_telegram_username");
    return { success: true, data: val || "@admin_placeholder" };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch admin settings" };
  }
}

/**
 * Update admin telegram username setting. Restricted to admin role.
 */
export async function updateAdminTelegramAction(username: string): Promise<ActionResponse<void>> {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || session.role !== "admin") {
      return { success: false, error: "Unauthorized" };
    }
    const cleanUsername = username.trim().startsWith("@") ? username.trim() : `@${username.trim()}`;
    await db.setSystemSetting("admin_telegram_username", cleanUsername);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update admin settings" };
  }
}

/**
 * Create a signed upload URL for uploading files directly from client to Supabase Storage.
 */
export async function getSignedUploadUrlAction(filename: string, mimeType: string): Promise<ActionResponse<{ signedUrl: string; token: string; path: string; id: string; publicUrl: string; mediaType: "image" | "video"; currentWorkspaceSizeBytes: number }>> {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return { success: false, error: "Unauthorized" };
    }

    const id = Math.random().toString(36).slice(2, 9);
    const fileExtension = filename.split(".").pop()?.toLowerCase() ?? "bin";
    
    if (fileExtension === "webp") {
      return {
        success: false,
        error: "WebP images are not supported by the Instagram Graph API. Please upload JPG/PNG images or MP4/MOV videos instead."
      };
    }

    // Verify 400MB workspace size limit
    const MAX_WORKSPACE_BYTES = 400 * 1024 * 1024;
    const currentSizeBytes = await db.getWorkspaceSizeBytes(session.ownerId);
    if (currentSizeBytes >= MAX_WORKSPACE_BYTES) {
      const usedMB = (currentSizeBytes / 1024 / 1024).toFixed(0);
      return {
        success: false,
        error: `Workspace full (${usedMB} MB / 400 MB). Delete some media before uploading more.`
      };
    }

    const storagePath = `uploads/${session.ownerId}/${id}.${fileExtension}`;
    const contentType = resolveContentType(mimeType, filename);
    const mediaType = resolveMediaType(contentType);

    // Call Supabase storage to create the signed upload url
    const result = await createSignedUploadUrl(storagePath);
    
    // Generate the public URL
    const bucket = "Media";
    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${storagePath}`;

    return {
      success: true,
      data: {
        signedUrl: result.signedUrl,
        token: result.token,
        path: result.path,
        id,
        publicUrl,
        mediaType,
        currentWorkspaceSizeBytes: currentSizeBytes,
      }
    };
  } catch (err: any) {
    console.error("getSignedUploadUrlAction error:", err);
    return { success: false, error: err.message || "Failed to generate upload URL" };
  }
}

/**
 * Register the successfully uploaded media file metadata in the Postgres database.
 */
export async function registerUploadedMediaAction(
  id: string,
  filename: string,
  mediaType: "image" | "video",
  publicUrl: string,
  fileSize?: number
): Promise<ActionResponse<any>> {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return { success: false, error: "Unauthorized" };
    }

    // Register in DB
    await db.addMedia({
      id,
      filename,
      mediaType,
      ownerId: session.ownerId,
      ownerRole: session.role
    });

    // Update with the URL column and file size
    const updatedItem = await db.updateMedia(id, { cloudinaryUrl: publicUrl, fileSize: fileSize || 0 });
    return { success: true, data: updatedItem };
  } catch (err: any) {
    console.error("registerUploadedMediaAction error:", err);
    return { success: false, error: err.message || "Failed to register uploaded media" };
  }
}
