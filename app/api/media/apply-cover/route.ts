import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/app/actions/auth";
import { uploadFile, deleteFile, resolveContentType, clearThumbnailFolder } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { mediaId, currentCoverUrl } = await request.json();
    if (!mediaId) {
      return NextResponse.json({ success: false, error: "Missing mediaId" }, { status: 400 });
    }

    // Get the media item
    const media = await db.getMediaById(mediaId);
    if (!media || !media.cloudinaryUrl) {
      return NextResponse.json({ success: false, error: "Media item not found or has no URL" }, { status: 404 });
    }

    // Delete all existing thumbnails inside the thumbnail folder first
    try {
      await clearThumbnailFolder(session.role, session.ownerId);
    } catch (err: any) {
      console.warn(`[API Apply Cover] Failed to clear thumbnail folder: ${err.message}`);
    }

    // Fetch the file from the media URL
    const response = await fetch(media.cloudinaryUrl);
    if (!response.ok) throw new Error("Failed to download media file");
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to thumbnail path
    const id = Math.random().toString(36).slice(2, 9);
    const fileExtension = media.filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const storagePath = `uploads/${session.role}/${session.ownerId}/thumbnail/${id}.${fileExtension}`;
    const contentType = resolveContentType("", media.filename);

    const publicUrl = await uploadFile(buffer, storagePath, contentType);
    console.log(`[API Apply Cover] Copied ${media.cloudinaryUrl} to ${publicUrl}`);

    return NextResponse.json({ success: true, coverUrl: publicUrl });
  } catch (err: any) {
    console.error("[API Apply Cover] Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Failed to apply cover" }, { status: 500 });
  }
}
