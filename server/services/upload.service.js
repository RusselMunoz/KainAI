// server/services/upload.service.js
// Image upload service using Cloudinary

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with environment variables
// User needs to add these to .env:
// CLOUDINARY_CLOUD_NAME=your_cloud_name
// CLOUDINARY_API_KEY=your_api_key
// CLOUDINARY_API_SECRET=your_api_secret
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Check if Cloudinary is properly configured
 */
function isCloudinaryConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Upload an image to Cloudinary
 * @param {string} base64Data - Base64 encoded image data (with or without data URI prefix)
 * @param {Object} options - Upload options
 * @param {string} options.folder - Folder to store the image in (e.g., 'kainai/posts')
 * @param {string} options.publicId - Optional custom public ID
 * @returns {Promise<Object>} Cloudinary upload result with secure_url
 */
async function uploadImage(base64Data, options = {}) {
  if (!isCloudinaryConfigured()) {
    console.warn('⚠️ Cloudinary not configured - returning placeholder URL');
    // Return a placeholder URL in demo mode
    return {
      secure_url: `https://via.placeholder.com/400x300?text=Demo+Image`,
      public_id: 'demo-' + Date.now(),
      width: 400,
      height: 300,
    };
  }

  try {
    // Ensure base64 data has proper prefix
    let uploadData = base64Data;
    if (!base64Data.startsWith('data:')) {
      uploadData = `data:image/jpeg;base64,${base64Data}`;
    }

    const uploadOptions = {
      folder: options.folder || 'kainai/community',
      resource_type: 'image',
      transformation: [
        { width: 1080, height: 1080, crop: 'limit' }, // Max dimensions
        { quality: 'auto:good' }, // Optimize quality
        { fetch_format: 'auto' }, // Optimal format
      ],
    };

    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    const result = await cloudinary.uploader.upload(uploadData, uploadOptions);
    
    console.log(`📸 Image uploaded: ${result.secure_url}`);
    
    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error.message);
    throw new Error('Failed to upload image: ' + error.message);
  }
}

/**
 * Upload multiple images
 * @param {string[]} base64Images - Array of base64 encoded images
 * @param {Object} options - Upload options
 * @returns {Promise<Object[]>} Array of upload results
 */
async function uploadMultipleImages(base64Images, options = {}) {
  const results = await Promise.all(
    base64Images.map((img, index) => 
      uploadImage(img, {
        ...options,
        publicId: options.publicId ? `${options.publicId}-${index}` : undefined,
      })
    )
  );
  return results;
}

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - The public ID of the image to delete
 */
async function deleteImage(publicId) {
  if (!isCloudinaryConfigured()) {
    console.warn('⚠️ Cloudinary not configured - skipping delete');
    return { result: 'demo' };
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`🗑️ Image deleted: ${publicId}`);
    return result;
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error.message);
    throw new Error('Failed to delete image: ' + error.message);
  }
}

module.exports = {
  isCloudinaryConfigured,
  uploadImage,
  uploadMultipleImages,
  deleteImage,
};
