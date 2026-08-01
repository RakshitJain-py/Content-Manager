import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/app/actions/auth";
import { deleteFile } from "@/lib/storage";
import {
  createImageContainer,
  createReelContainer,
  createVideoStoryContainer,
  waitForContainerReady,
  publishContainer,
  PublishOptions,
} from "@/lib/instagram";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { mediaIds, accountIds, contentType, options = {} } = body as {
      mediaIds: string[];
      accountIds: string[];
      contentType: "post" | "reel" | "story";
      options: PublishOptions;
    };

    if (!mediaIds || mediaIds.length === 0) {
      return NextResponse.json({ error: "No media items selected" }, { status: 400 });
    }

    if (!accountIds || accountIds.length === 0) {
      return NextResponse.json({ error: "No Instagram accounts selected" }, { status: 400 });
    }

    console.log(`[Publish API] Starting publish: type=${contentType}, items=${mediaIds.join(",")}, targets=${accountIds.join(",")}`);

    // Fetch account details (access tokens, names)
    const accounts = await Promise.all(
      accountIds.map(async (id) => {
        const acc = await db.getAccountById(id);
        if (!acc) throw new Error(`Account ${id} not found in database.`);
        return acc;
      })
    );

    // Process each media item sequentially in background/async so client is updated
    // For safety, we will run the publishing loop and update DB statuses.
    // To prevent API timeouts in serverless functions, we process items sequentially,
    // and return the status of the operation.
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of mediaIds) {
      const media = await db.getMediaById(id);
      if (!media) {
        results.push({ id, success: false, error: "Media not found" });
        continue;
      }

      await db.updateMedia(id, { status: "uploading", error: null });

      try {
        const mediaUrl = media.cloudinaryUrl; // Store Supabase Storage URL
        if (!mediaUrl) {
          throw new Error("No media URL found for this item.");
        }

        const publishResults: string[] = [];
        const publishErrors: string[] = [];

        for (const account of accounts) {
          try {
            let containerId = "";

            if (contentType === "reel") {
              if (media.mediaType !== "video") {
                throw new Error("Only videos can be published as Reels.");
              }
              // Create Reel Container
              containerId = await createReelContainer(
                mediaUrl,
                options.caption || "",
                account.id,
                account.accessToken,
                {
                  coverUrl: options.coverUrl,
                  shareToFeed: options.shareToFeed !== false,
                }
              );
              // Wait for container to process
              await waitForContainerReady(containerId, account.accessToken);

            } else if (contentType === "story") {
              if (media.mediaType === "video") {
                containerId = await createVideoStoryContainer(
                  mediaUrl,
                  account.id,
                  account.accessToken,
                  { storyLink: options.storyLink }
                );
                await waitForContainerReady(containerId, account.accessToken);
              } else {
                containerId = await createImageContainer(
                  mediaUrl,
                  account.id,
                  account.accessToken,
                  "STORY",
                  { storyLink: options.storyLink }
                );
              }

            } else {
              // Standard Post
              if (media.mediaType === "video") {
                // Video posts are published as Reels in current Meta Graph API
                containerId = await createReelContainer(
                  mediaUrl,
                  options.caption || "",
                  account.id,
                  account.accessToken,
                  { shareToFeed: true }
                );
                await waitForContainerReady(containerId, account.accessToken);
              } else {
                containerId = await createImageContainer(
                  mediaUrl,
                  account.id,
                  account.accessToken,
                  "POST",
                  {
                    caption: options.caption,
                    hideLikes: options.hideLikes,
                    disableComments: options.disableComments,
                  }
                );
              }
            }

            // Publish the container
            const publishedMediaId = await publishContainer(containerId, account.id, account.accessToken);
            publishResults.push(`${account.name}: ${publishedMediaId}`);

          } catch (accErr: any) {
            console.error(`[Publish API] Failed posting to ${account.name}:`, accErr);
            publishErrors.push(`${account.name}: ${accErr.message || accErr}`);
          }
        }

        if (publishErrors.length === accounts.length) {
          throw new Error(`All accounts failed: ${publishErrors.join(" | ")}`);
        }

        const finalStatus = publishErrors.length > 0 ? "failed" : "published";
        const finalError = publishErrors.length > 0 ? `Some accounts failed: ${publishErrors.join(" | ")}` : null;

        await db.updateMedia(id, {
          status: finalStatus,
          instagramMediaId: publishResults.join(", "),
          publishedAt: new Date().toISOString(),
          error: finalError,
        });

        // Auto-delete from Supabase Storage bucket after successful publish to save space
        if (finalStatus === "published") {
          try {
            await deleteFile(mediaUrl);
            console.log(`[Publish API] Auto-deleted file from Supabase storage: ${mediaUrl}`);
          } catch (delErr: any) {
            console.error(`[Publish API] Storage auto-delete failed: ${delErr.message}`);
          }
        }

        results.push({ id, success: finalStatus === "published" });

      } catch (itemErr: any) {
        console.error(`[Publish API] Failed item ${id}:`, itemErr);
        await db.updateMedia(id, {
          status: "failed",
          error: itemErr.message || "Failed to publish",
        });
        results.push({ id, success: false, error: itemErr.message || "Failed to publish" });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[Publish API] Global Error:", err);
    return NextResponse.json({ error: err.message || "Publish failed" }, { status: 500 });
  }
}
