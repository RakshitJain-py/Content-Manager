import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/app/actions/auth";
import { deleteFile } from "@/lib/storage";
import {
  createImageContainer,
  createReelContainer,
  createVideoStoryContainer,
  createCarouselChildContainer,
  createCarouselContainer,
  waitForContainerReady,
  publishContainer,
  updateMediaSettings,
  getPermalink,
  PublishOptions,
} from "@/lib/instagram";

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.success || !session.ownerId || !session.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { mediaIds, accountIds, contentType, carouselMode = false, options = {} } = body as {
      mediaIds: string[];
      accountIds: string[];
      contentType: "post" | "reel" | "story";
      carouselMode: boolean;
      options: PublishOptions;
    };

    if (!mediaIds || mediaIds.length === 0) {
      return NextResponse.json({ error: "No media items selected" }, { status: 400 });
    }
    if (!accountIds || accountIds.length === 0) {
      return NextResponse.json({ error: "No Instagram accounts selected" }, { status: 400 });
    }

    console.log(`[Publish API] type=${contentType}, carousel=${carouselMode}, items=${mediaIds.join(",")}, targets=${accountIds.join(",")}`);

    // Fetch account details
    const accounts = await Promise.all(
      accountIds.map(async (id) => {
        const acc = await db.getAccountById(id);
        if (!acc) throw new Error(`Account ${id} not found in database.`);
        return acc;
      })
    );

    // ─── PRE-FLIGHT CHECK 1: Per-account daily quota ─────────────────────────
    // Strict: if ANY account is exhausted, block the entire operation.
    const exhaustedAccounts = accounts.filter((a) => (a.postsRemaining ?? 20) <= 0);
    if (exhaustedAccounts.length > 0) {
      const names = exhaustedAccounts.map((a) => a.name).join(", ");
      return NextResponse.json({
        error: `Daily quota exhausted for: ${names}. Each account allows 20 posts per 24 hours. Please deselect exhausted accounts or wait for the quota to reset.`,
      }, { status: 429 });
    }

    // ─── PRE-FLIGHT CHECK 2: 5 ops per 3-minute rolling window ──────────────
    const MAX_OPS_PER_WINDOW = 5;
    const WINDOW_SECONDS = 180;

    // Number of ops this publish will consume: each media × each account = 1 op
    const newOps = carouselMode ? accountIds.length : mediaIds.length * accountIds.length;

    let currentWindow = await db.getRateLimitWindow(session.ownerId);
    let opsUsed = 0;
    let windowStartedAt = new Date();

    if (currentWindow) {
      const elapsed = (Date.now() - currentWindow.windowStartedAt.getTime()) / 1000;
      if (elapsed < WINDOW_SECONDS) {
        opsUsed = currentWindow.opsUsed;
        windowStartedAt = currentWindow.windowStartedAt;
      }
      // else: window expired, starts fresh
    }

    if (opsUsed + newOps > MAX_OPS_PER_WINDOW) {
      const remaining = MAX_OPS_PER_WINDOW - opsUsed;
      const secondsLeft = Math.ceil(WINDOW_SECONDS - (Date.now() - windowStartedAt.getTime()) / 1000);
      return NextResponse.json({
        error: `Rate limit: Only ${remaining} operation${remaining !== 1 ? "s" : ""} left in this window. You requested ${newOps}. Wait ${secondsLeft}s or reduce your selection.`,
        rateLimitSecondsLeft: secondsLeft,
      }, { status: 429 });
    }


    // Helper to sleep between account publishing to prevent throttling
    const sleepDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    // ─── CAROUSEL MODE ──────────────────────────────────────────────────────
    // Bundle multiple selected items into a single Instagram carousel post.
    if (carouselMode && mediaIds.length > 1 && (contentType === "post" || contentType === "story")) {
      const mediaItems = await Promise.all(mediaIds.map((id) => db.getMediaById(id)));
      const validItems = mediaItems.filter(Boolean) as NonNullable<typeof mediaItems[number]>[];

      if (validItems.length === 0) {
        return NextResponse.json({ error: "No valid media found for carousel" }, { status: 400 });
      }

      // Mark all items as uploading
      await Promise.all(validItems.map((m) => db.updateMedia(m.id, { status: "uploading", error: null })));

      const carouselResults: string[] = [];
      const carouselErrors: string[] = [];

      for (let aIndex = 0; aIndex < accounts.length; aIndex++) {
        const account = accounts[aIndex];
        try {
          if (aIndex > 0) {
            console.log(`[Publish API] Sleeping 5s before carousel publishing to account ${account.name} to avoid rate limits...`);
            await sleepDelay(5000);
          }

          // 1. Create child containers in sequence order
          const childIds: string[] = [];
          for (const m of validItems) {
            const childId = await createCarouselChildContainer(
              m.cloudinaryUrl!,
              account.id,
              account.accessToken,
              m.mediaType === "video" ? "video" : "image"
            );
            // Wait for each video child to finish processing
            if (m.mediaType === "video") {
              await waitForContainerReady(childId, account.accessToken);
            }
            childIds.push(childId);
          }

          // 2. Create carousel container
          const carouselContainerId = await createCarouselContainer(
            childIds,
            options.caption || "",
            account.id,
            account.accessToken,
            { hideLikes: options.hideLikes, disableComments: options.disableComments }
          );

          // 3. Wait and publish
          await waitForContainerReady(carouselContainerId, account.accessToken);
          const publishedMediaId = await publishContainer(carouselContainerId, account.id, account.accessToken);
          carouselResults.push(`${account.name}: ${publishedMediaId}`);

          // 4. Get permalink (non-fatal) and apply settings
          let permalink: string | null = null;
          try {
            permalink = await getPermalink(publishedMediaId, account.accessToken);
          } catch (_) {}
          await updateMediaSettings(publishedMediaId, account.accessToken, { 
            disableComments: options.disableComments, 
            hideLikes: options.hideLikes 
          } as any);

          // 5. Mark all items as published; store permalink on the first item
          for (let i = 0; i < validItems.length; i++) {
            const m = validItems[i];
            await db.updateMedia(m.id, {
              status: "published",
              instagramMediaId: publishedMediaId,
              publishedAt: new Date().toISOString(),
              caption: options.caption || "",
              ...(i === 0 && permalink ? { permalink } : {}),
            });
          }

          // 6. Decrement per-account daily quota (only on success)
          await db.decrementAccountQuota(account.id);
        } catch (accErr: any) {
          console.error(`[Publish API] Carousel failed for ${account.name}:`, accErr);
          carouselErrors.push(`${account.name}: ${accErr.message || accErr}`);
        }
      }

      // Update rate limit window with ops consumed by successful publishes
      const successfulOps = carouselResults.length; // 1 op per successful account
      if (successfulOps > 0) {
        const newOpsUsed = opsUsed + successfulOps;
        await db.upsertRateLimitWindow(session.ownerId, newOpsUsed, new Date());
      }

      if (carouselErrors.length === accounts.length) {
        const firstError = carouselErrors[0] || "Carousel publish failed";
        await Promise.all(validItems.map((m) => db.updateMedia(m.id, { status: "failed", error: firstError })));
        return NextResponse.json({
          success: true,
          results: mediaIds.map((id) => ({ id, success: false, error: firstError })),
        });
      }

      return NextResponse.json({
        success: true,
        results: mediaIds.map((id) => ({ id, success: true })),
      });
    }

    // ─── INDIVIDUAL MODE ─────────────────────────────────────────────────────
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of mediaIds) {
      const media = await db.getMediaById(id);
      if (!media) {
        results.push({ id, success: false, error: "Media not found" });
        continue;
      }

      await db.updateMedia(id, { status: "uploading", error: null });

      try {
        const mediaUrl = media.cloudinaryUrl;
        if (!mediaUrl) throw new Error("No media URL found for this item.");

        const publishResults: string[] = [];
        const publishErrors: string[] = [];

        for (let aIndex = 0; aIndex < accounts.length; aIndex++) {
          const account = accounts[aIndex];
          try {
            if (aIndex > 0) {
              console.log(`[Publish API] Sleeping 5s before individual publishing to account ${account.name} to avoid rate limits...`);
              await sleepDelay(5000);
            }

            let containerId = "";

            if (contentType === "reel") {
              if (media.mediaType !== "video") {
                throw new Error("Only videos can be published as Reels.");
              }
              containerId = await createReelContainer(
                mediaUrl,
                options.caption || "",
                account.id,
                account.accessToken,
                { coverUrl: options.coverUrl, shareToFeed: options.shareToFeed !== false }
              );
            } else if (contentType === "story") {
              if (media.mediaType === "video") {
                containerId = await createVideoStoryContainer(
                  mediaUrl,
                  account.id,
                  account.accessToken,
                  { storyLink: options.storyLink }
                );
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
                containerId = await createReelContainer(
                  mediaUrl,
                  options.caption || "",
                  account.id,
                  account.accessToken,
                  {
                    shareToFeed: options.shareToFeed,
                    coverUrl: options.coverUrl,
                    hideLikes: options.hideLikes,
                    disableComments: options.disableComments,
                  }
                );
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

            await waitForContainerReady(containerId, account.accessToken);
            const publishedMediaId = await publishContainer(containerId, account.id, account.accessToken);
            publishResults.push(`${account.name}: ${publishedMediaId}`);

            await updateMediaSettings(publishedMediaId, account.accessToken, { 
              disableComments: options.disableComments, 
              hideLikes: options.hideLikes 
            } as any);

            const permalink = await getPermalink(publishedMediaId, account.accessToken);
            if (permalink) {
              try {
                await db.updateMedia(id, { permalink });
              } catch (plErr: any) {
                console.warn(`[Publish API] Permalink save failed (non-fatal):`, plErr.message);
              }
            }

            // Decrement per-account daily quota on success
            await db.decrementAccountQuota(account.id);
          } catch (accErr: any) {
            console.error(`[Publish API] Failed posting to ${account.name}:`, accErr);
            publishErrors.push(`${account.name}: ${accErr.message || accErr}`);
          }
        }

        // Update rate limit window: 1 op per successful account publish
        const successfulAccountOps = publishResults.length;
        if (successfulAccountOps > 0) {
          const newOpsUsed = opsUsed + successfulAccountOps;
          opsUsed = newOpsUsed; // accumulate across media items in this request
          await db.upsertRateLimitWindow(session.ownerId, newOpsUsed, new Date());
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
          caption: options.caption || "",
        });

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
