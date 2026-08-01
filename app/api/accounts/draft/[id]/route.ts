import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/app/actions/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const account = await db.getAccountById(id);
    if (!account) {
      return NextResponse.json({ error: "Draft account not found" }, { status: 404 });
    }

    // Verify ownership
    if (session.role !== "admin" && account.ownerId !== session.ownerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Return only public metadata (excluding access token!)
    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        igId: account.id,
        isActive: account.isActive,
      },
    });
  } catch (err: any) {
    console.error("[API Draft Fetch] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch draft" }, { status: 500 });
  }
}
