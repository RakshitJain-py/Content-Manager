# ReelBot Prototype — single clip, end to end

## Setup

1. Install Node.js if you don't have it (v18+).
2. In this folder, run:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your real values:
   ```
   cp .env.example .env
   ```
   Then edit `.env` with:
   - CLOUDINARY_CLOUD_NAME (you have: zdemoqzu)
   - CLOUDINARY_API_KEY
   - CLOUDINARY_API_SECRET (make sure this is the ROTATED one, not the one pasted earlier)
   - IG_ACCESS_TOKEN
   - IG_USER_ID

## Run it

```
node postReel.js "./clips/clip1.mp4" "Test caption #reels"
```

What happens:
1. Uploads clip1.mp4 to your Cloudinary account (folder: reelbot/) and gets back a public URL.
2. Sends that URL + caption to Instagram to create a Reels container.
3. Polls Instagram every 5 seconds until it's done processing the video (can take anywhere from 10 seconds to a couple minutes depending on clip length).
4. Publishes it — the reel goes live on your account.

You'll see progress logged at each step, and either a ✅ with the live media ID, or a ❌ with the specific error from Instagram's API (very useful for debugging token/permission issues).

## Common errors you might hit

- **"Invalid OAuth access token"** — token expired or wrong IG_USER_ID. Re-generate from the Meta dashboard.
- **"Media type REELS is not supported"** or similar — check your account is still set to Creator/Business (Instagram Settings).
- **Container stuck at status_code IN_PROGRESS past 2 minutes** — usually a very large file or slow-loading Cloudinary URL. Try a shorter clip first (under 30s) to confirm the pipeline works before testing longer ones.

## Next steps once this works

- Swap the hardcoded file path for a queue (folder of clips + a CSV of captions).
- Add a Telegram bot layer so you can trigger `/post <n>` remotely.
- Add pacing/delay between multiple posts instead of firing them back to back.
- Add multi-account support (loop this per friend's token once they're onboarded as testers).
