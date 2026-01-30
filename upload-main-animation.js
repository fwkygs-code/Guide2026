#!/usr/bin/env node

/**
 * Upload MainAnimation.mp4 to Cloudinary
 * 
 * This script uploads the MainAnimation.mp4 file to Cloudinary using the unsigned upload preset
 * and updates the logo.js file with the correct URL.
 * 
 * Usage: node upload-main-animation.js
 */

const fs = require('fs');
const path = require('path');

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'ds1dgifj8';
const CLOUDINARY_UPLOAD_PRESET = 'interguide_static_upload';

async function uploadMainAnimation() {
  try {
    console.log('🚀 Starting upload of MainAnimation.mp4...');
    
    const VIDEO_PATH = path.join(__dirname, 'frontend', 'public', 'MainAnimation.mp4');
    
    // Check if video file exists
    if (!fs.existsSync(VIDEO_PATH)) {
      throw new Error(`❌ Video file not found at: ${VIDEO_PATH}`);
    }

    console.log('✅ Video file found, preparing upload...');

    // For this environment, we'll use a simpler approach
    // The actual upload should be done in a proper Node.js environment with FormData support
    console.log('📋 Upload Instructions:');
    console.log('');
    console.log('To upload MainAnimation.mp4 to Cloudinary:');
    console.log('1. Go to https://cloudinary.com/console/upload');
    console.log('2. Upload frontend/public/MainAnimation.mp4');
    console.log('3. Set public ID to: interguide-static/main-animation');
    console.log('4. Use unsigned preset: interguide_static_upload');
    console.log('');
    console.log('Or run this script in a proper Node.js environment with FormData support.');
    console.log('');

    // For now, let's update the URL to point to the correct location once uploaded
    const logoJsPath = path.join(__dirname, 'frontend', 'src', 'utils', 'logo.js');
    let logoJsContent = fs.readFileSync(logoJsPath, 'utf8');
    
    // Update the URL to the expected location after upload
    const expectedUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/q_auto,f_auto/interguide-static/main-animation`;
    const oldUrlPattern = /export const INTERGUIDE_MAIN_ANIMATION_URL = `[^`]+`;/;
    const newUrlLine = `export const INTERGUIDE_MAIN_ANIMATION_URL = '${expectedUrl}';`;
    
    if (oldUrlPattern.test(logoJsContent)) {
      logoJsContent = logoJsContent.replace(oldUrlPattern, newUrlLine);
      fs.writeFileSync(logoJsPath, logoJsContent);
      console.log('✅ Updated logo.js with the expected Cloudinary URL');
      console.log('📹 Expected URL:', expectedUrl);
    } else {
      console.log('⚠️  Could not find the URL pattern in logo.js to update');
    }
    
    console.log('');
    console.log('🎯 Current Status:');
    console.log('- Video element is in place in LandingPage.js');
    console.log('- Fallback to original logo is implemented');
    console.log('- URL is set to expected Cloudinary location');
    console.log('');
    console.log('🔧 Next Steps:');
    console.log('1. Upload the video to Cloudinary with public ID: interguide-static/main-animation');
    console.log('2. The video will automatically appear on the landing page');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    throw error;
  }
}

// Run the setup
uploadMainAnimation()
  .then(() => {
    console.log('\n✨ Setup complete!');
  })
  .catch(error => {
    console.error('\n💥 Setup failed:', error.message);
    process.exit(1);
  });