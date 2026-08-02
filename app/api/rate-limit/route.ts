import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/app/actions/auth";

/** GET /api/rate-limit -- returns the current user's rate limit window, or null if no active window. */
export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const window = await db.getRateLimitWindow(session.ownerId);

    // No window in DB — user has never published, or window was never set
    if (!window) {
      return NextResponse.json({ success: true, window: null });
    }

    // Window has expired (3 minutes = 180 seconds have passed since last post)
    const elapsed = (Date.now() - window.windowStartedAt.getTime()) / 1000;
    if (elapsed >= 180) {
      return NextResponse.json({ success: true, window: null });
    }

    // Active window
    return NextResponse.json({
      success: true,
      window: {
        opsUsed: window.opsUsed,
        windowStartedAt: window.windowStartedAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error("[Rate Limit API] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

