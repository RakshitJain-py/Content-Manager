import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/app/actions/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorReason = searchParams.get("error_reason");
  const errorDescription = searchParams.get("error_description");

  // Dynamically resolve site URL from request headers
  const host = request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const siteUrl = `${proto}://${host}`;
  const redirectUri = `${siteUrl}/api/auth/instagram/callback`;

  if (error || errorReason || errorDescription) {
    console.error("[OAuth Callback] Instagram returned error:", { error, errorReason, errorDescription });
    return NextResponse.redirect(`${siteUrl}/studio?oauth_error=${encodeURIComponent(errorDescription || "Auth cancelled")}`);
  }

  if (!code) {
    return NextResponse.redirect(`${siteUrl}/studio?oauth_error=No+code+provided`);
  }

  try {
    // 1. Check user session
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return NextResponse.redirect(`${siteUrl}/login?error=Session+expired.+Please+log+in+again.`);
    }

    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Instagram client credentials not configured on the server.");
    }

    // 2. Exchange code for short-lived token
    console.log("[OAuth Callback] Exchanging code for short-lived token...");
    const shortTokenForm = new URLSearchParams();
    shortTokenForm.append("client_id", clientId);
    shortTokenForm.append("client_secret", clientSecret);
    shortTokenForm.append("grant_type", "authorization_code");
    shortTokenForm.append("redirect_uri", redirectUri);
    shortTokenForm.append("code", code);

    const shortTokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: shortTokenForm,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const shortTokenData = await shortTokenRes.json();
    if (shortTokenData.error) {
      throw new Error(`Short-lived token exchange failed: ${JSON.stringify(shortTokenData.error)}`);
    }

    const shortLivedToken = shortTokenData.access_token;
    const instagramUserId = shortTokenData.user_id;

    // 3. Exchange short-lived token for long-lived token
    console.log("[OAuth Callback] Exchanging short-lived token for long-lived token...");
    const longTokenUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${shortLivedToken}`;
    
    const longTokenRes = await fetch(longTokenUrl);
    const longTokenData = await longTokenRes.json();
    if (longTokenData.error) {
      throw new Error(`Long-lived token exchange failed: ${JSON.stringify(longTokenData.error)}`);
    }

    const longLivedToken = longTokenData.access_token;

    // 4. Fetch Instagram profile username and real user_id (starts with 1784)
    console.log("[OAuth Callback] Fetching Instagram profile username and actual user_id...");
    const meRes = await fetch(`https://graph.instagram.com/me?fields=user_id,username&access_token=${longLivedToken}`);
    const meData = await meRes.json();
    if (meData.error) {
      throw new Error(`Failed to fetch profile details: ${JSON.stringify(meData.error)}`);
    }

    const realInstagramUserId = meData.user_id || String(instagramUserId);
    const username = meData.username || `ig_${realInstagramUserId}`;

    // 5. Store in database as a draft (isActive = false)
    console.log(`[OAuth Callback] Storing draft account: ${username} (id=${realInstagramUserId})`);
    await db.addAccount({
      id: String(realInstagramUserId),
      name: username, // Removed leading @ prefix
      ownerId: session.ownerId,
      ownerRole: session.role,
      accessToken: longLivedToken,
      isActive: false, // Created as unconfirmed draft first
    });

    // 6. Redirect back to Studio to let the user review and confirm
    return NextResponse.redirect(`${siteUrl}/studio?oauth_success=true&accountId=${realInstagramUserId}`);
  } catch (err: any) {
    console.error("[OAuth Callback] Process failed:", err);
    return NextResponse.redirect(`${siteUrl}/studio?oauth_error=${encodeURIComponent(err.message || "Failed connecting account")}`);
  }
}
