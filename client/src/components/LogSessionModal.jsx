import React, { useState } from 'react';
import { logSession } from '../services/readingService';
import { X, BookOpen, Clock, FileText, TrendingUp } from 'lucide-react';

const getLocalDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const LogSessionModal = ({ book, onClose, onSaved }) => {
  const [form, setForm] = useState({
    pagesRead: '',
    currentPage: book.currentPage || '',
    durationMinutes: '',
    note: '',
    date: getLocalDateStr(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const pagesRead = parseInt(form.pagesRead, 10);
    if (!pagesRead || pagesRead < 1) {
      setError('Pages read must be at least 1.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        pagesRead,
        date: form.date,
      };
      if (form.durationMinutes) payload.durationMinutes = parseInt(form.durationMinutes, 10);
      if (form.note.trim()) payload.note = form.note.trim();
      if (form.currentPage !== '') payload.currentPage = parseInt(form.currentPage, 10);

      await logSession(book._id, payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log session. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const progress =
    book.totalPages > 0
      ? Math.min(
          100,
          Math.round(((parseInt(form.currentPage, 10) || book.currentPage) / book.totalPages) * 100)
        )
      : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex justify-between items-start">
          <div>
            <h2 className="text-white text-xl font-bold flex items-center gap-2">
              <BookOpen size={20} />
              Log Reading Session
            </h2>
            <p className="text-indigo-100 text-sm mt-0.5 line-clamp-1">{book.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-indigo-200 hover:text-white transition-colors mt-0.5"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Progress preview */}
          {book.totalPages > 0 && (
            <div className="bg-indigo-50 rounded-xl p-3">
              <div className="flex justify-between text-sm text-indigo-700 font-medium mb-1.5">
                <span>Progress</span>
                <span>
                  {parseInt(form.currentPage, 10) || book.currentPage} / {book.totalPages} pages (
                  {progress}%)
                </span>
              </div>
              <div className="h-2 bg-indigo-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Pages read */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Pages Read <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="pagesRead"
              value={form.pagesRead}
              onChange={handleChange}
              min="1"
              placeholder="e.g. 45"
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Current page (optional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              <TrendingUp size={14} className="inline mr-1 text-indigo-500" />
              Now on page
              <span className="text-gray-400 font-normal ml-1">(updates progress bar)</span>
            </label>
            <input
              type="number"
              name="currentPage"
              value={form.currentPage}
              onChange={handleChange}
              min="0"
              max={book.totalPages || undefined}
              placeholder={`Currently on page ${book.currentPage || 0}`}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Duration */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                <Clock size={14} className="inline mr-1 text-indigo-500" />
                Duration (min)
              </label>
              <input
                type="number"
                name="durationMinutes"
                value={form.durationMinutes}
                onChange={handleChange}
                min="1"
                placeholder="e.g. 30"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            {/* Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                max={getLocalDateStr()}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              <FileText size={14} className="inline mr-1 text-indigo-500" />
              Note <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              name="note"
              value={form.note}
              onChange={handleChange}
              rows={2}
              placeholder="What did you think of today's reading?"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:opacity-90 transition disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Log Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LogSessionModal;
