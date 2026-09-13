import multer from 'multer';

// Phase 10: the app had no centralized error handler — an error thrown or
// passed to next() anywhere just hit Express's default HTML error page.
// Mounted last in server.js (Express error-handling middleware is
// recognized by its 4-argument signature) so any route's uncaught error,
// not just multer's, gets a clean JSON response instead.
const errorHandler = (err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'That file is too large.' });
    }
    return res.status(400).json({ message: err.message });
  }

  if (err.message === 'Only image files are allowed.' || err.message === 'Not allowed by CORS') {
    return res.status(400).json({ message: err.message });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Server error.' });
};

export default errorHandler;
