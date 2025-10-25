const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Compress and upload image to Cloudinary
 * @param {Object} file - Multer file object
 * @param {string} teamId - Team ID for unique naming
 * @returns {Promise<Object>} - Upload result with URL and metadata
 */
async function compressAndUploadImage(file, teamId) {
  try {
    // Create unique public ID
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const publicId = `hackathon/payment-proofs/team-${teamId}-${timestamp}-${randomString}`;
    
    // Compress image using Sharp
    const compressedBuffer = await sharp(file.buffer)
      .resize(1200, 1200, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .webp({ 
        quality: 80,
        effort: 6 
      })
      .toBuffer();

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(
      `data:image/webp;base64,${compressedBuffer.toString('base64')}`,
      {
        public_id: publicId,
        folder: 'hackathon/payment-proofs',
        resource_type: 'image',
        format: 'webp',
        quality: 'auto',
        fetch_format: 'auto',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto' }
        ],
        tags: ['payment-proof', `team-${teamId}`],
        context: {
          team_id: teamId,
          original_name: file.originalname,
          upload_timestamp: timestamp.toString()
        }
      }
    );
    
    return {
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      originalSize: file.size,
      compressedSize: uploadResult.bytes,
      compressionRatio: ((file.size - uploadResult.bytes) / file.size * 100).toFixed(2),
      cloudinaryId: uploadResult.public_id
    };

  } catch (error) {
    console.error('Image compression/upload error:', error);
    throw new Error('Failed to compress and upload image');
  }
}

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<boolean>} - Success status
 */
async function deleteImageFromCloudinary(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    return false;
  }
}

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Full URL from Cloudinary
 * @returns {string} - Public ID
 */
function extractPublicIdFromUrl(url) {
  if (!url) return null;
  // Extract public ID from Cloudinary URL
  // Format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.webp
  const match = url.match(/\/upload\/.*\/(.+?)\.(webp|jpg|jpeg|png)$/);
  return match ? match[1] : null;
}

module.exports = {
  compressAndUploadImage,
  deleteImageFromCloudinary,
  extractPublicIdFromUrl
};
