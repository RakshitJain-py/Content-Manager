import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/app/actions/auth";
import { uploadFile, resolveContentType, resolveMediaType } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const isCover = searchParams.get("type") === "cover";

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const id = Math.random().toString(36).slice(2, 9);
    const fileExtension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    
    // Create folders for each role, owner, and subfolders (thumbnail vs media)
    const folderType = isCover ? "thumbnail" : "media";
    const storagePath = `uploads/${session.role}/${session.ownerId}/${folderType}/${id}.${fileExtension}`;
    
    const contentType = resolveContentType(file.type, file.name);
    const mediaType = resolveMediaType(contentType);

    console.log(`[API Upload] Starting: ${file.name} (isCover=${isCover}, ${(file.size / 1024 / 1024).toFixed(2)}MB, ${contentType}) → ${storagePath}`);

    // If uploading a cover, delete all existing thumbnails before saving the new one
    if (isCover) {
      try {
        const { clearThumbnailFolder } = await import("@/lib/storage");
        await clearThumbnailFolder(session.role, session.ownerId);
      } catch (err: any) {
        console.warn(`[API Upload] Error clearing thumbnail folder: ${err.message}`);
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const publicUrl = await uploadFile(buffer, storagePath, contentType);
    console.log(`[API Upload] Storage OK: ${publicUrl}`);

    if (isCover) {
      // Do not write to media DB table for custom cover thumbnails
      return NextResponse.json({ 
        success: true, 
        data: { cloudinaryUrl: publicUrl } 
      });
    }

    // Register in DB
    await db.addMedia({
      id,
      filename: file.name,
      mediaType,
      ownerId: session.ownerId,
      ownerRole: session.role
    });
    console.log(`[API Upload] DB insert OK: id=${id}`);

    // Update with the URL column
    const updatedItem = await db.updateMedia(id, { cloudinaryUrl: publicUrl });
    console.log(`[API Upload] DB update OK:`, updatedItem);

    return NextResponse.json({ success: true, data: updatedItem });
  } catch (err: any) {
    console.error("[API Upload] Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Upload failed" }, { status: 500 });
  }
}
