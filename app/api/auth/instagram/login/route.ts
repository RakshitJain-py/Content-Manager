import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.INSTAGRAM_CLIENT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectUri = `${siteUrl}/api/auth/instagram/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: "INSTAGRAM_CLIENT_ID is not configured in environment variables." },
      { status: 500 }
    );
  }

  // Scopes required for publishing content and basic user profile reading
  const scopes = ["instagram_business_basic", "instagram_business_content_publish"].join(",");

  const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scopes)}&response_type=code`;

  return NextResponse.redirect(authUrl);
}
