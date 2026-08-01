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

    const caption = await db.getCaption(session.ownerId, session.role, contentType);
    return NextResponse.json({ success: true, caption });
  } catch (err: any) {
    console.error("[API Caption] GET error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch caption" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { caption, contentType } = await request.json();
    if (caption === undefined || !contentType) {
      return NextResponse.json({ error: "Missing caption or contentType field" }, { status: 400 });
    }

    await db.setCaption(session.ownerId, session.role, contentType, caption);
    return NextResponse.json({ success: true, caption });
  } catch (err: any) {
    console.error("[API Caption] POST error:", err);
    return NextResponse.json({ error: err.message || "Failed to save caption" }, { status: 500 });
  }
}
