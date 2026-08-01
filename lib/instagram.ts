const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface PublishOptions {
  caption?: string;
  coverUrl?: string;
  hideLikes?: boolean;
  disableComments?: boolean;
  shareToFeed?: boolean;
  allowRemixing?: boolean;
  storyLink?: string;
}

/**
 * Creates an Instagram Container for a single image (used for POST or STORY).
 */
export async function createImageContainer(
  imageUrl: string,
  userId: string,
  accessToken: string,
  mediaType: "POST" | "STORY",
  opts: PublishOptions = {}
): Promise<string> {
  const url = `${GRAPH_BASE}/${userId}/media`;
  
  const params: Record<string, string> = {
    image_url: imageUrl,
    access_token: accessToken,
  };

  if (mediaType === "STORY") {
    params.media_type = "STORY";
    if (opts.storyLink) {
      // Story link attachment or interactive sticker support
      params.story_link_sticker_url = opts.storyLink;
    }
  } else if (mediaType === "POST") {
    if (opts.caption) params.caption = opts.caption;
    if (opts.hideLikes) params.hide_likes = "true";
    if (opts.disableComments) params.comments_disabled = "true";
  }

  const searchParams = new URLSearchParams(params);
  console.log(`[IG API] Creating image container for ${mediaType} on user ${userId}...`);
  const res = await fetch(url, { method: "POST", body: searchParams });
  const data = await res.json();

  if (data.error) {
    throw new Error(`Container creation failed: ${JSON.stringify(data.error)}`);
  }

  return data.id;
}

/**
 * Creates an Instagram Container for a Reel (REELS).
 */
export async function createReelContainer(
  videoUrl: string,
  caption: string,
  userId: string,
  accessToken: string,
  opts: PublishOptions = {}
): Promise<string> {
  const url = `${GRAPH_BASE}/${userId}/media`;
  
  const params: Record<string, string> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption: caption,
    access_token: accessToken,
  };

  if (opts.coverUrl) params.cover_url = opts.coverUrl;
  if (opts.shareToFeed !== undefined) params.share_to_feed = opts.shareToFeed ? "true" : "false";
  // Meta Reels publishing parameters check:
  // Note: comment/like options for reels can be applied post-publish or through container options
  // if supported by the Graph version.

  const searchParams = new URLSearchParams(params);
  console.log(`[IG API] Creating Reel container on user ${userId}...`);
  const res = await fetch(url, { method: "POST", body: searchParams });
  const data = await res.json();

  if (data.error) {
    throw new Error(`Reel container creation failed: ${JSON.stringify(data.error)}`);
  }

  return data.id;
}

/**
 * Creates an Instagram Container for a video story (STORY).
 */
export async function createVideoStoryContainer(
  videoUrl: string,
  userId: string,
  accessToken: string,
  opts: PublishOptions = {}
): Promise<string> {
  const url = `${GRAPH_BASE}/${userId}/media`;

  const params: Record<string, string> = {
    media_type: "STORY",
    video_url: videoUrl,
    access_token: accessToken,
  };

  if (opts.storyLink) {
    params.story_link_sticker_url = opts.storyLink;
  }

  const searchParams = new URLSearchParams(params);
  console.log(`[IG API] Creating video story container on user ${userId}...`);
  const res = await fetch(url, { method: "POST", body: searchParams });
  const data = await res.json();

  if (data.error) {
    throw new Error(`Video Story container creation failed: ${JSON.stringify(data.error)}`);
  }

  return data.id;
}

/**
 * Polls container status until ready (FINISHED) or error.
 */
export async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  { intervalMs = 5000, maxAttempts = 30 } = {}
): Promise<boolean> {
  const url = `${GRAPH_BASE}/${containerId}?fields=status_code,status&access_token=${accessToken}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[IG API] Polling container ${containerId} (attempt ${attempt}/${maxAttempts})...`);
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      throw new Error(`Status check failed: ${JSON.stringify(data.error)}`);
    }

    const status = data.status_code;
    console.log(`[IG API] Container status: ${status}`);

    if (status === "FINISHED") return true;
    if (status === "ERROR") {
      throw new Error(`Container processing failed on Instagram side: ${JSON.stringify(data)}`);
    }

    await sleep(intervalMs);
  }

  throw new Error("Timed out waiting for container to finish processing on Instagram.");
}

/**
 * Publishes the finalized container.
 */
export async function publishContainer(
  containerId: string,
  userId: string,
  accessToken: string
): Promise<string> {
  const url = `${GRAPH_BASE}/${userId}/media_publish`;
  
  const searchParams = new URLSearchParams({
    creation_id: containerId,
    access_token: accessToken,
  });

  console.log(`[IG API] Publishing container ${containerId}...`);
  const res = await fetch(url, { method: "POST", body: searchParams });
  const data = await res.json();

  if (data.error) {
    throw new Error(`Publish failed: ${JSON.stringify(data.error)}`);
  }

  return data.id;
}
