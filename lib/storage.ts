import { createClient } from "@supabase/supabase-js";

const BUCKET = "Media";

/** Map common file extensions to MIME types when the browser doesn't provide one */
const EXT_MIME: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  webm: "video/webm",
  mkv: "video/x-matroska",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/**
 * Resolve content-type from a MIME string and/or file extension fallback.
 * Browsers sometimes send empty type for .mp4 on Windows.
 */
export function resolveContentType(mimeFromBrowser: string, filename: string): string {
  if (mimeFromBrowser && mimeFromBrowser !== "application/octet-stream") {
    return mimeFromBrowser;
  }
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

/**
 * Returns "video" or "image" from a resolved MIME type.
 */
export function resolveMediaType(contentType: string): "video" | "image" {
  return contentType.startsWith("video/") ? "video" : "image";
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_KEY is not set.");
  return createClient(url, key);
}

/**
 * Upload a file buffer to Supabase Storage.
 * @param buffer - File Buffer.
 * @param storagePath - The destination path inside the bucket, e.g. "uploads/file_123.mp4"
 * @param contentType - MIME type of the file.
 * @returns The public URL of the uploaded file.
 */
export async function uploadFile(buffer: Buffer, storagePath: string, contentType: string): Promise<string> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage using its public URL.
 * @param urlOrPath - Either the full public URL or the path inside the bucket.
 */
export async function deleteFile(urlOrPath: string): Promise<void> {
  const supabase = getSupabaseClient();
  let storagePath = urlOrPath;

  const marker = `/object/public/${BUCKET}/`;
  const idx = urlOrPath.indexOf(marker);
  if (idx !== -1) {
    storagePath = urlOrPath.slice(idx + marker.length);
  }

  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(`Supabase Storage delete failed: ${error.message}`);
  }
}

/**
 * Delete all files inside uploads/{role}/{ownerId}/thumbnail/ folder.
 */
export async function clearThumbnailFolder(role: string, ownerId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const folderPath = `uploads/${role}/${ownerId}/thumbnail`;

  const { data, error } = await supabase.storage.from(BUCKET).list(folderPath);
  if (error) {
    console.warn(`[Storage] Failed to list thumbnail folder: ${error.message}`);
    return;
  }

  if (data && data.length > 0) {
    const paths = data.map((f) => `${folderPath}/${f.name}`);
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeError) {
      console.warn(`[Storage] Failed to clear thumbnail folder: ${removeError.message}`);
    } else {
      console.log(`[Storage] Cleared thumbnail folder for ${ownerId}: deleted ${paths.length} file(s)`);
    }
  }
}

/**
 * Creates a signed upload URL for direct client uploads.
 */
export async function createSignedUploadUrl(storagePath: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);
  if (error) {
    throw new Error(`Failed to create signed upload URL: ${error.message}`);
  }
  return data;
}
