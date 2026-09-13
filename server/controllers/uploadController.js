// @desc    Upload a single image (avatar / book cover / diary image — the
//          size cap and Cloudinary folder are already decided by which
//          multer instance from config/uploaders.js handled the route).
//          Just hands back the URL; persisting it onto a User/Book/DiaryEntry
//          happens through that resource's own existing update endpoint —
//          this keeps upload a single-purpose "give me a file, get a URL" step.
// @route   POST /api/upload/avatar | /book-cover | /diary-image
// @access  Private
export const uploadImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file was uploaded.' });
  }
  res.status(201).json({ url: req.file.path });
};
