import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/app/actions/auth";

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get("contentType") || "post";

    const settings = await db.getSettings(session.ownerId, session.role, contentType);
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    console.error("[API Settings] GET error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { settings, contentType } = await request.json();
    if (settings === undefined || !contentType) {
      return NextResponse.json({ error: "Missing settings or contentType field" }, { status: 400 });
    }

    // Clean up older thumbnail covers from Supabase storage if changed or removed
    try {
      const oldSettings = await db.getSettings(session.ownerId, session.role, contentType);
      if (oldSettings.coverUrl && oldSettings.coverUrl !== settings.coverUrl) {
        try {
          const { clearThumbnailFolder } = await import("@/lib/storage");
          await clearThumbnailFolder(session.role, session.ownerId);
          console.log(`[API Settings] Cleared thumbnail folder since coverUrl changed or was removed.`);
        } catch (delErr: any) {
          console.warn(`[API Settings] Failed to clear thumbnail folder: ${delErr.message}`);
        }
      }
    } catch (dbErr: any) {
      console.warn(`[API Settings] Error loading old settings: ${dbErr.message}`);
    }

    await db.setSettings(session.ownerId, session.role, contentType, settings);
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    console.error("[API Settings] POST error:", err);
    return NextResponse.json({ error: err.message || "Failed to save settings" }, { status: 500 });
  }
}
