import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/app/actions/auth";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const caption = await db.getCaption(session.ownerId, session.role);
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

    const { caption } = await request.json();
    if (caption === undefined) {
      return NextResponse.json({ error: "Missing caption field" }, { status: 400 });
    }

    await db.setCaption(session.ownerId, session.role, caption);
    return NextResponse.json({ success: true, caption });
  } catch (err: any) {
    console.error("[API Caption] POST error:", err);
    return NextResponse.json({ error: err.message || "Failed to save caption" }, { status: 500 });
  }
}
