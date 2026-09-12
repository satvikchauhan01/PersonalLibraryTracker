import React, { useState, useEffect, useCallback } from 'react';
import { X, MessageSquare, StickyNote, Quote as QuoteIcon, Tag, Trash2, Plus } from 'lucide-react';
import { getReview, saveReview, getNote, saveNote, setTags } from '../services/organizationService';
import { getQuotes, createQuote, deleteQuote } from '../services/quoteService';

const TABS = [
  { id: 'review', label: 'Review', icon: MessageSquare },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'quotes', label: 'Quotes', icon: QuoteIcon },
  { id: 'tags', label: 'Tags', icon: Tag },
];

const BookDetailModal = ({ book, onClose, onUpdated }) => {
  const [activeTab, setActiveTab] = useState('review');

  const [reviewText, setReviewText] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('');

  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteStatus, setNoteStatus] = useState('');

  const [quotes, setQuotes] = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [newQuoteText, setNewQuoteText] = useState('');
  const [newQuotePage, setNewQuotePage] = useState('');
  const [addingQuote, setAddingQuote] = useState(false);

  const [tags, setTagsState] = useState(book.tags || []);
  const [newTag, setNewTag] = useState('');
  const [tagsSaving, setTagsSaving] = useState(false);

  useEffect(() => {
    getReview(book._id)
      .then(({ data }) => setReviewText(data.text))
      .catch(() => {}); // 404 = no review yet, leave textarea empty

    getNote(book._id)
      .then(({ data }) => setNoteText(data.text))
      .catch(() => {});

    setQuotesLoading(true);
    getQuotes(book._id)
      .then(({ data }) => setQuotes(data))
      .catch(() => {})
      .finally(() => setQuotesLoading(false));
  }, [book._id]);

  // ── Review ───────────────────────────────────────────────────────────────
  const handleSaveReview = async () => {
    setReviewSaving(true);
    setReviewStatus('');
    try {
      await saveReview(book._id, reviewText);
      setReviewStatus('Saved.');
    } catch (err) {
      setReviewStatus(err.response?.data?.message || 'Failed to save review.');
    } finally {
      setReviewSaving(false);
    }
  };

  // ── Notes ────────────────────────────────────────────────────────────────
  const handleSaveNote = async () => {
    setNoteSaving(true);
    setNoteStatus('');
    try {
      await saveNote(book._id, noteText);
      setNoteStatus('Saved.');
    } catch (err) {
      setNoteStatus(err.response?.data?.message || 'Failed to save notes.');
    } finally {
      setNoteSaving(false);
    }
  };

  // ── Quotes ───────────────────────────────────────────────────────────────
  const refreshQuotes = useCallback(async () => {
    const { data } = await getQuotes(book._id);
    setQuotes(data);
  }, [book._id]);

  const handleAddQuote = async (e) => {
    e.preventDefault();
    if (!newQuoteText.trim()) return;
    setAddingQuote(true);
    try {
      await createQuote(book._id, newQuoteText.trim(), newQuotePage ? Number(newQuotePage) : null);
      setNewQuoteText('');
      setNewQuotePage('');
      await refreshQuotes();
    } catch (err) {
      console.error('Failed to add quote:', err);
    } finally {
      setAddingQuote(false);
    }
  };

  const handleDeleteQuote = async (quoteId) => {
    try {
      await deleteQuote(quoteId);
      setQuotes((prev) => prev.filter((q) => q._id !== quoteId));
    } catch (err) {
      console.error('Failed to delete quote:', err);
    }
  };

  // ── Tags ─────────────────────────────────────────────────────────────────
  const persistTags = async (nextTags) => {
    setTagsSaving(true);
    try {
      await setTags(book._id, nextTags);
      setTagsState(nextTags);
      onUpdated?.();
    } catch (err) {
      console.error('Failed to update tags:', err);
    } finally {
      setTagsSaving(false);
    }
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    const value = newTag.trim();
    if (!value) return;
    setNewTag('');
    persistTags([...tags, value]);
  };

  const handleRemoveTag = (tag) => {
    persistTags(tags.filter((t) => t !== tag));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex justify-between items-start flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-white text-lg font-bold line-clamp-1">{book.title}</h2>
            <p className="text-indigo-100 text-sm">by {book.author}</p>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-grow">
          {activeTab === 'review' && (
            <div className="space-y-3">
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={8}
                placeholder="What did you think of this book?"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{reviewStatus}</span>
                <button
                  onClick={handleSaveReview}
                  disabled={reviewSaving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
                >
                  {reviewSaving ? 'Saving…' : 'Save Review'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Private scratchpad — only you can see this. Different from your review.
              </p>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={8}
                placeholder="Page references, half-formed thoughts, anything..."
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{noteStatus}</span>
                <button
                  onClick={handleSaveNote}
                  disabled={noteSaving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
                >
                  {noteSaving ? 'Saving…' : 'Save Notes'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'quotes' && (
            <div className="space-y-4">
              <form onSubmit={handleAddQuote} className="flex gap-2">
                <input
                  type="text"
                  value={newQuoteText}
                  onChange={(e) => setNewQuoteText(e.target.value)}
                  placeholder="Add a quote or highlight..."
                  className="flex-grow border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <input
                  type="number"
                  min="1"
                  value={newQuotePage}
                  onChange={(e) => setNewQuotePage(e.target.value)}
                  placeholder="p."
                  className="w-16 border border-gray-300 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  type="submit"
                  disabled={addingQuote || !newQuoteText.trim()}
                  className="flex-shrink-0 px-3 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50"
                >
                  <Plus size={18} />
                </button>
              </form>

              {quotesLoading ? (
                <p className="text-sm text-gray-400">Loading quotes…</p>
              ) : quotes.length === 0 ? (
                <p className="text-sm text-gray-400">No quotes yet.</p>
              ) : (
                <ul className="space-y-2">
                  {quotes.map((q) => (
                    <li
                      key={q._id}
                      className="flex items-start justify-between gap-3 bg-gray-50 rounded-xl p-3"
                    >
                      <div>
                        <p className="text-sm text-gray-800 italic">&ldquo;{q.text}&rdquo;</p>
                        {q.page && <p className="text-xs text-gray-400 mt-1">page {q.page}</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteQuote(q._id)}
                        className="text-gray-400 hover:text-red-500 flex-shrink-0"
                        title="Delete quote"
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'tags' && (
            <div className="space-y-4">
              <form onSubmit={handleAddTag} className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag..."
                  className="flex-grow border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  type="submit"
                  disabled={tagsSaving || !newTag.trim()}
                  className="flex-shrink-0 px-3 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50"
                >
                  <Plus size={18} />
                </button>
              </form>

              {tags.length === 0 ? (
                <p className="text-sm text-gray-400">No tags yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-indigo-400 hover:text-indigo-700"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookDetailModal;
