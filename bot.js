// bot.js
// Background worker to listen for incoming Telegram media files and add them to the queue.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api').default;
const { v2: cloudinary } = require('cloudinary');
const db = require('./db');
const paths = require('./paths');

const token = process.env.TELEGRAM_BOT_TOKEN;
const allowedUserId = process.env.ALLOWED_TELEGRAM_USER_ID;

if (!token) {
  console.error('Error: TELEGRAM_BOT_TOKEN is not set in your .env file.');
  process.exit(1);
}

const downloadsDir = paths.downloads;

// In-memory user states
const userStates = {}; // userId -> state string

// Initialize the Telegram Bot in polling mode
const bot = new TelegramBot(token, { polling: true });

console.log('Telegram Bot listener started...');

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const username = msg.from.username || '';
  const senderName = `${msg.from.first_name || ''} ${msg.from.last_name || ''} (@${username})`.trim();

  // Check if user is allowed (admin or in db.json allowedUsers list)
  const isAllowed = await db.isUserAllowed(userId);

  if (!isAllowed) {
    console.log(`Received message from unauthorized user. Details:`);
    console.log(`- Sender: ${senderName}`);
    console.log(`- User ID: ${userId}`);
    
    bot.sendMessage(
      chatId,
      `Hello! You are not authorized to use this bot.\n\n` +
      `Your Telegram User ID is: ${userId}\n\n` +
      `To use this bot, please get an invitation code/OTP from the administrator and log in to the web dashboard.`
    );
    return;
  }

  const text = msg.text || '';

  // Handle Telegram Commands
  if (text.startsWith('/start') || text.startsWith('/newreel')) {
    delete userStates[userId];
    bot.sendMessage(
      chatId,
      `🎥 *Content Manager Bot*\n\n` +
      `• Send me any video, GIF, or document video to queue it.\n` +
      `• Send /newthumbnail to set or update the active cover image.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (text.startsWith('/generateotp')) {
    if (userId !== String(allowedUserId)) {
      bot.sendMessage(chatId, '❌ Unauthorized. Only the administrator can generate invitation OTP codes.');
      return;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await db.setOtp(otp);
    console.log(`\n🔑 [ADMIN] Generated Login OTP: ${otp}\n`);
    bot.sendMessage(
      chatId,
      `🔑 *New Login OTP Generated!*\n\n` +
      `Code: \`${otp}\`\n\n` +
      `Share this code and the Telegram User ID with your client to authorize their device.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (text.startsWith('/newthumbnail')) {
    userStates[userId] = 'waiting_for_thumbnail';
    bot.sendMessage(
      chatId,
      `📸 *New Cover Thumbnail*\n\nPlease send me the image you want to use as the cover. You can upload it as a Photo or an uncompressed Document/Image.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (text.startsWith('/cancel')) {
    delete userStates[userId];
    bot.sendMessage(chatId, 'Cancelled. Back to normal mode.');
    return;
  }

  // State: Waiting for Thumbnail
  if (userStates[userId] === 'waiting_for_thumbnail') {
    let fileId = null;
    let filename = '';

    if (msg.photo && msg.photo.length > 0) {
      const photo = msg.photo[msg.photo.length - 1];
      fileId = photo.file_id;
      filename = `cover_${Date.now()}.jpg`;
    } else if (msg.document && msg.document.mime_type && msg.document.mime_type.startsWith('image/')) {
      fileId = msg.document.file_id;
      filename = msg.document.file_name || `cover_${Date.now()}.jpg`;
    }

    if (!fileId) {
      bot.sendMessage(chatId, '❌ That is not an image file. Please send an image or send /cancel to abort.');
      return;
    }

    const cloudConfig = await db.getCloudinaryConfig(userId);
    if (!cloudConfig) {
      delete userStates[userId];
      bot.sendMessage(chatId, '⚠️ Please configure your Cloudinary credentials on the dashboard first under "Manage Cloud"!');
      return;
    }

    try {
      bot.sendMessage(chatId, '📥 Uploading thumbnail to Cloudinary...');
      const downloadedFilePath = await bot.downloadFile(fileId, downloadsDir);

      // Upload directly to Cloudinary using user's specific credentials
      const uploadResult = await cloudinary.uploader.upload(downloadedFilePath, {
        cloud_name: cloudConfig.cloudName,
        api_key: cloudConfig.apiKey,
        api_secret: cloudConfig.apiSecret,
        folder: 'reelbot_covers',
      });
      const coverUrl = uploadResult.secure_url;

      // Save as active preset cover (also save in Supabase so it persists)
      await db.setPresetCover(coverUrl);

      // Backfill all items in the queue (pending/approved) that do not have a cover
      const allMedia = await db.getAll();
      const allPendingOrApproved = allMedia.filter(m => (m.status === 'pending' || m.status === 'approved') && !m.coverUrl);
      for (const item of allPendingOrApproved) {
        await db.update(item.id, { coverUrl });
      }

      // Cleanup local temp file
      if (fs.existsSync(downloadedFilePath)) {
        fs.unlinkSync(downloadedFilePath);
      }

      delete userStates[userId];
      bot.sendMessage(
        chatId,
        `✅ *Success!*\n\nNew cover thumbnail set.\n` +
        `• Applied to **${allPendingOrApproved.length}** pending/approved items in the queue.\n` +
        `• Future videos will use this thumbnail by default.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('Error handling thumbnail upload:', err);
      bot.sendMessage(chatId, `❌ Failed to set thumbnail: ${err.message}`);
    }
    return;
  }

  // Normal state: Queuing videos/media
  let fileId = null;
  let filename = '';
  let mediaType = '';

  if (msg.video) {
    fileId = msg.video.file_id;
    mediaType = 'video';
    filename = msg.video.file_name || `video_${Date.now()}.mp4`;
  } else if (msg.document) {
    fileId = msg.document.file_id;
    mediaType = 'document';
    filename = msg.document.file_name || `doc_${Date.now()}`;
  } else if (msg.animation) {
    fileId = msg.animation.file_id;
    mediaType = 'animation';
    filename = msg.animation.file_name || `gif_${Date.now()}.mp4`;
  } else if (msg.photo && msg.photo.length > 0) {
    // Treat photos as images/posts if they want to post image reels, or let them queue
    const photo = msg.photo[msg.photo.length - 1];
    fileId = photo.file_id;
    mediaType = 'photo';
    filename = `photo_${Date.now()}.jpg`;
  }

  if (!fileId) {
    bot.sendMessage(chatId, 'Send me a video or gif to queue it as a Reel, or send /newthumbnail to set a new cover thumbnail.');
    return;
  }

  const cloudConfig = await db.getCloudinaryConfig(userId);
  if (!cloudConfig) {
    bot.sendMessage(chatId, '⚠️ Please configure your Cloudinary credentials on the dashboard first under "Manage Cloud" to begin queuing videos.');
    return;
  }

  try {
    bot.sendMessage(chatId, `📥 Fetching and uploading media: "${filename}" to your Cloudinary...`);
    console.log(`Downloading ${filename} (ID: ${fileId}) from Telegram...`);

    const downloadedFilePath = await bot.downloadFile(fileId, downloadsDir);

    // Upload to Cloudinary immediately
    const uploadResult = await cloudinary.uploader.upload(downloadedFilePath, {
      cloud_name: cloudConfig.cloudName,
      api_key: cloudConfig.apiKey,
      api_secret: cloudConfig.apiSecret,
      resource_type: 'video',
      folder: 'reelbot',
    });
    const cloudinaryUrl = uploadResult.secure_url;

    // Cleanup local temp file
    if (fs.existsSync(downloadedFilePath)) {
      try { fs.unlinkSync(downloadedFilePath); } catch (_) {}
    }

    // Save record to DB
    const record = await db.add({
      id: msg.message_id,
      filename,
      localPath: null, // No local path needed now
      mediaType,
      telegramUser: username || userId,
      telegramUserId: userId
    });

    // Save Cloudinary URL to record
    await db.update(record.id, { cloudinaryUrl });

    // Check if there is an active preset cover and assign it immediately
    const activeCoverUrl = await db.getPresetCover();

    if (activeCoverUrl) {
      await db.update(record.id, { coverUrl: activeCoverUrl });
    }

    // Track upload count for non-admin clients
    const adminId = process.env.ALLOWED_TELEGRAM_USER_ID;
    if (!adminId || String(userId) !== String(adminId)) {
      await db.incrementUploadCount(userId);
    }

    console.log(`Successfully queued and uploaded: ${filename} (Queue ID: ${record.id})`);
    bot.sendMessage(
      chatId,
      `✅ Media successfully queued and uploaded to Cloudinary!\n` +
      `• Name: ${filename}\n` +
      `• Queue ID: ${record.id}\n` +
      `• Status: pending (Awaiting approval/upload)\n` +
      `${activeCoverUrl ? '• Cover: Preset cover applied 📸' : '• Cover: No preset cover active (will default to video frame)'}`
    );
  } catch (err) {
    console.error('Error downloading/saving/uploading file:', err);
    bot.sendMessage(chatId, `❌ Failed to download and queue media: ${err.message}`);
  }
});
