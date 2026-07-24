// storage.js
// Supabase Storage helper for uploading and deleting media files.
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const BUCKET = 'Media';

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY is not set.');
  return createClient(url, key);
}

/**
 * Upload a local file to Supabase Storage.
 * @param {string} localFilePath - Absolute path to the local file.
 * @param {string} storagePath   - The destination path inside the bucket, e.g. "reels/file_123.mp4"
 * @returns {string} The public URL of the uploaded file.
 */
async function uploadFile(localFilePath, storagePath) {
  const supabase = getClient();
  const fileBuffer = fs.readFileSync(localFilePath);
  const contentType = mime.lookup(localFilePath) || 'application/octet-stream';

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, { contentType, upsert: true });

  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase Storage using its public URL or storage path.
 * @param {string} urlOrPath - Either the full public URL or the path inside the bucket.
 */
async function deleteFile(urlOrPath) {
  const supabase = getClient();

  let storagePath = urlOrPath;

  // If a full URL was passed, extract just the path inside the bucket
  // Public URLs look like: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const marker = `/object/public/${BUCKET}/`;
  const idx = urlOrPath.indexOf(marker);
  if (idx !== -1) {
    storagePath = urlOrPath.slice(idx + marker.length);
  }

  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(`Supabase Storage delete failed: ${error.message}`);
}

module.exports = { uploadFile, deleteFile };
