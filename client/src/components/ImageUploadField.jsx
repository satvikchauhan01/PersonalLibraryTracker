import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Loader } from 'lucide-react';

// Phase 10: single-image picker with client-side validation (type + size,
// rejected before any request fires), an immediate local preview via
// createObjectURL while the real upload is in flight, then swaps to the
// real Cloudinary URL once it resolves. Used for avatar + book cover.
const ImageUploadField = ({
  currentUrl,
  uploadFn,
  onUploaded,
  maxSizeMB = 3,
  shape = 'circle',
  size = 96,
  // Override when the field sits on a dark background (e.g. Profile's
  // gradient header) — the default indigo link text needs to stay legible.
  buttonClassName = 'text-indigo-600 hover:text-indigo-800',
}) => {
  const [preview, setPreview] = useState(currentUrl || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setPreview(currentUrl || '');
  }, [currentUrl]);

  const handleChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;
    setError('');

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Image must be under ${maxSizeMB}MB.`);
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setPreview(localPreviewUrl);
    setUploading(true);
    try {
      const url = await uploadFn(file);
      onUploaded(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed.');
      setPreview(currentUrl || '');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div
        className={`relative overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-white/60 dark:border-gray-700/60 flex items-center justify-center flex-shrink-0 ${
          shape === 'circle' ? 'rounded-full' : 'rounded-lg'
        }`}
        style={{ width: size, height: size }}
      >
        {preview ? (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={size * 0.4} className="text-gray-300 dark:text-gray-600" />
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader size={size * 0.3} className="animate-spin text-white" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`text-xs font-medium ${buttonClassName}`}
      >
        {preview ? 'Change photo' : 'Upload photo'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {error && <p className="text-xs text-red-500 text-center max-w-[160px]">{error}</p>}
    </div>
  );
};

export default ImageUploadField;
