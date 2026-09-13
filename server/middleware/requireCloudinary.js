// Phase 10: if Cloudinary env vars are simply unset (not just wrong), the
// upload SDK fails in ways that don't surface as a clean multer error — a
// 500 with no useful message. Catch that case explicitly, before the file
// even starts uploading, same pattern as config/razorpay.js's getRazorpay().
const requireCloudinary = (req, res, next) => {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return res.status(503).json({ message: 'Image uploads are not configured yet.' });
  }
  next();
};

export default requireCloudinary;
