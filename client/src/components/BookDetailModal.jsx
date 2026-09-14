import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  MessageSquare,
  StickyNote,
  Quote as QuoteIcon,
  Tag,
  Trash2,
  Plus,
  Sparkles,
  Loader2,
  BookOpen,
  Wand2,
} from 'lucide-react';
import { getReview, saveReview, getNote, saveNote, setTags } from '../services/organizationService';
import { getQuotes, createQuote, deleteQuote } from '../services/quoteService';
import { getBookSummary, getSimilarBooks, reviewAssist } from '../services/aiService'; // Phase 18

const TABS = [
  { id: 'review', label: 'Review', icon: MessageSquare },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'quotes', label: 'Quotes', icon: QuoteIcon },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'ai', label: 'AI', icon: Sparkles },
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

  // Phase 18: AI tab — summary + similar books, fetched on demand (not on
  // modal open) so opening this tab is the thing that spends AI quota, not
  // just opening the modal.
  const [aiLoaded, setAiLoaded] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiQuotaExceeded, setAiQuotaExceeded] = useState(false);
  const [summary, setSummary] = useState(null);
  const [similarBooks, setSimilarBooks] = useState([]);

  // Phase 18: "Draft with AI" inside the Review tab
  const [showAiDraft, setShowAiDraft] = useState(false);
  const [aiBulletInput, setAiBulletInput] = useState('');
  const [draftingReview, setDraftingReview] = useState(false);
  const [draftError, setDraftError] = useState('');

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

  // ── AI: summary + similar books ─────────────────────────────────────────
  const handleAnalyze = async () => {
    setAiLoading(true);
    setAiError('');
    setAiQuotaExceeded(false);
    try {
      const [summaryRes, similarRes] = await Promise.all([
        getBookSummary(book._id),
        getSimilarBooks(book._id),
      ]);
      setSummary(summaryRes.data);
      setSimilarBooks(similarRes.data.similar || []);
      setAiLoaded(true);
    } catch (err) {
      if (err.response?.status === 402) {
        setAiQuotaExceeded(true);
      } else if (err.response?.status === 503) {
        setAiError('AI features are not configured on this server yet.');
      } else {
        setAiError('Something went wrong generating AI insights for this book.');
      }
    } finally {
      setAiLoading(false);
    }
  };

  // ── AI: draft a review from bullet points ───────────────────────────────
  const handleDraftReview = async () => {
    const bulletPoints = aiBulletInput
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (bulletPoints.length === 0) return;

    setDraftingReview(true);
    setDraftError('');
    try {
      const { data } = await reviewAssist(book._id, bulletPoints);
      setReviewText(data.draft);
      setShowAiDraft(false);
      setAiBulletInput('');
      setReviewStatus('Draft added below — edit it, then Save Review.');
    } catch (err) {
      if (err.response?.status === 402) {
        setDraftError(
          "You've used all your free AI drafts this month. Upgrade to Library Pro for unlimited access."
        );
      } else {
        setDraftError(err.response?.data?.message || 'Could not draft a review right now.');
      }
    } finally {
      setDraftingReview(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
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
        <div className="flex border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
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
              {/* Phase 18: bullet points → drafted review paragraph */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowAiDraft((prev) => !prev);
                    setDraftError('');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
                >
                  <Wand2 size={13} /> Draft with AI
                </button>
              </div>

              {showAiDraft && (
                <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Jot down your thoughts, one per line — AI turns them into a draft paragraph you
                    can edit.
                  </p>
                  <textarea
                    value={aiBulletInput}
                    onChange={(e) => setAiBulletInput(e.target.value)}
                    rows={4}
                    placeholder={
                      'loved the pacing\nending felt rushed\nwould recommend to fantasy fans'
                    }
                    className="w-full border border-purple-200 dark:border-purple-800 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                  />
                  {draftError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{draftError}</p>
                  )}
                  <div className="flex justify-end">
                    <button
                      onClick={handleDraftReview}
                      disabled={draftingReview || !aiBulletInput.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 disabled:opacity-50"
                    >
                      {draftingReview ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Sparkles size={13} />
                      )}
                      {draftingReview ? 'Drafting…' : 'Draft Review'}
                    </button>
                  </div>
                </div>
              )}

              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={8}
                placeholder="What did you think of this book?"
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-2.5 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
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
                className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-4 py-2.5 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
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
                  className="flex-grow border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <input
                  type="number"
                  min="1"
                  value={newQuotePage}
                  onChange={(e) => setNewQuotePage(e.target.value)}
                  placeholder="p."
                  className="w-16 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                      className="flex items-start justify-between gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3"
                    >
                      <div>
                        <p className="text-sm text-gray-800 dark:text-gray-200 italic">
                          &ldquo;{q.text}&rdquo;
                        </p>
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
                  className="flex-grow border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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

          {activeTab === 'ai' && (
            <div className="space-y-5">
              {!aiLoaded && !aiLoading && !aiError && !aiQuotaExceeded && (
                <div className="text-center py-6">
                  <Sparkles size={28} className="text-purple-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Get a spoiler-light summary and find similar books from your library.
                  </p>
                  <button
                    onClick={handleAnalyze}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700"
                  >
                    <Sparkles size={15} /> Analyze this book
                  </button>
                </div>
              )}

              {aiLoading && (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 size={28} className="animate-spin text-purple-500" />
                  <p className="mt-3 text-sm text-gray-400">Thinking…</p>
                </div>
              )}

              {aiQuotaExceeded && (
                <p className="text-sm text-center text-amber-600 dark:text-amber-400 py-6">
                  You've used all your free AI calls this month. Upgrade to Library Pro for
                  unlimited access.
                </p>
              )}

              {aiError && (
                <p className="text-sm text-center text-red-600 dark:text-red-400 py-6">{aiError}</p>
              )}

              {aiLoaded && !aiLoading && (
                <>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Spoiler-Light Summary
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {summary?.summary}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Similar Books In Your Library
                    </h4>
                    {similarBooks.length === 0 ? (
                      <p className="text-sm text-gray-400">
                        Nothing similar found yet — add a few more books to your library.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {similarBooks.map((b) => (
                          <li
                            key={b._id}
                            className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-2.5"
                          >
                            <div className="w-8 h-11 flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex items-center justify-center">
                              {b.coverUrl ? (
                                <img
                                  src={b.coverUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <BookOpen size={14} className="text-gray-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                                {b.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                by {b.author}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookDetailModal;
