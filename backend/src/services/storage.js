const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_KEY not set. File storage will not work.');
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const BUCKET = 'documents';

// Ensure bucket exists (called on startup)
async function initStorage() {
  if (!supabase) return;
  const { data, error } = await supabase.storage.getBucket(BUCKET);
  if (error && error.message.includes('not found')) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 20 * 1024 * 1024, // 20MB
    });
    if (createError) {
      console.error('Failed to create storage bucket:', createError.message);
    } else {
      console.log('📦 Storage bucket "documents" created');
    }
  } else {
    console.log('📦 Storage bucket "documents" ready');
  }
}

// Upload a file buffer to Supabase Storage
async function uploadFile(storagePath, buffer, mimeType) {
  if (!supabase) throw new Error('Storage not configured');
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return data.path;
}

// Download a file from Supabase Storage (returns Buffer)
async function downloadFile(storagePath) {
  if (!supabase) throw new Error('Storage not configured');
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);
  if (error) throw new Error(`Download failed: ${error.message}`);
  // data is a Blob, convert to Buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Delete a file from Supabase Storage
async function deleteFile(storagePath) {
  if (!supabase) return;
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);
  if (error) console.error('Delete failed:', error.message);
}

module.exports = { initStorage, uploadFile, downloadFile, deleteFile };
