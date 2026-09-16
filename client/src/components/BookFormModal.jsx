import React, { useState, useEffect } from 'react';
import { X, Save, Search, Loader, Hash, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { lookupIsbn } from '../services/isbnService';
import ImageUploadField from './ImageUploadField';
import { uploadBookCover } from '../services/uploadService';

// Which lookup mode is active in the add-book search section
const LOOKUP_TABS = [
  { id: 'isbn', label: 'ISBN Lookup' },
  { id: 'title', label: 'Search by Title' },
];

const BookFormModal = ({ isOpen, onClose, onSave, editingBook }) => {
  const [formState, setFormState] = useState({
    title: '',
    author: '',
    genre: '',
    status: 'wantToRead',
    coverUrl: '',
    isbn: '',
    totalPages: '',
    currentPage: '',
    description: '', // Phase 18: optional — feeds the AI "similar books"/summary features
  });

  // Lookup tab state
  const [activeTab, setActiveTab] = useState('isbn');

  // ISBN lookup states
  const [isbnQuery, setIsbnQuery] = useState('');
  const [isbnLooking, setIsbnLooking] = useState(false);
  const [isbnError, setIsbnError] = useState('');
  const [isbnSuccess, setIsbnSuccess] = useState(false);

  // Google Books Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Conflict / submission error state
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (editingBook) {
      setFormState({
        title: editingBook.title,
        author: editingBook.author,
        genre: editingBook.genre || '',
        status: editingBook.status,
        coverUrl: editingBook.coverUrl || '',
        isbn: editingBook.isbn || '',
        totalPages: editingBook.totalPages || '',
        currentPage: editingBook.currentPage || '',
        description: editingBook.description || '',
      });
    } else {
      resetAll();
    }
  }, [editingBook, isOpen]);

  const resetAll = () => {
    setFormState({
      title: '',
      author: '',
      genre: '',
      status: 'wantToRead',
      coverUrl: '',
      isbn: '',
      totalPages: '',
      currentPage: '',
      description: '',
    });
    setIsbnQuery('');
    setIsbnError('');
    setIsbnSuccess(false);
    setSearchQuery('');
    setSearchResults([]);
    setSubmitError('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
    if (submitError) setSubmitError('');
  };

  // ── ISBN Lookup ──────────────────────────────────────────────────────────────
  const handleIsbnLookup = async () => {
    const raw = isbnQuery.trim();
    if (!raw) return;

    // Basic sanity check — 10 or 13 digits (hyphens stripped)
    const digits = raw.replace(/[\s-]/g, '');
    if (!/^\d{10}(\d{3})?$/.test(digits) && !/^\d{9}X$/i.test(digits)) {
      setIsbnError('Please enter a valid 10- or 13-digit ISBN.');
      return;
    }

    setIsbnLooking(true);
    setIsbnError('');
    setIsbnSuccess(false);

    try {
      const book = await lookupIsbn(raw);
      setFormState({
        title: book.title || '',
        author: book.author || '',
        genre: book.genre || '',
        coverUrl: book.coverUrl || '',
        status: 'wantToRead',
        isbn: book.isbn || digits,
        totalPages: '',
        currentPage: '',
        description: book.description || '',
      });
      setIsbnSuccess(true);
    } catch (err) {
      if (err.response?.status === 404) {
        setIsbnError(`No book found for ISBN "${raw}". Fill in the details manually.`);
      } else {
        setIsbnError('ISBN lookup failed. Please try again or use the title search.');
      }
    } finally {
      setIsbnLooking(false);
    }
  };

  const handleIsbnKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleIsbnLookup();
    }
  };

  // ── Google Books Search ──────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (searchQuery.length < 3) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const { data } = await api.get(
        `/external/gbooks/search?q=${encodeURIComponent(searchQuery)}`
      );
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching Google Books:', error);
    }
    setIsSearching(false);
  };

  const handleSelectBook = (book) => {
    setFormState({
      title: book.title,
      author: book.author,
      genre: book.genre,
      coverUrl: book.coverUrl,
      status: 'wantToRead',
      isbn: '',
      totalPages: '',
      currentPage: '',
      description: book.description || '',
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    // Send isbn as null if empty so backend treats it correctly
    const payload = {
      ...formState,
      isbn: formState.isbn.trim() || null,
      // Phase 04: coerce progress fields to numbers or omit
      totalPages: formState.totalPages !== '' ? Number(formState.totalPages) : undefined,
      currentPage: formState.currentPage !== '' ? Number(formState.currentPage) : undefined,
      description: formState.description.trim() || undefined, // Phase 18
    };

    try {
      const success = await onSave(payload);
      if (success) {
        onClose();
      } else {
        setSubmitError('Failed to save book. Please try again.');
      }
    } catch (err) {
      // onSave may re-throw — catch 409 specifically for duplicate detection
      if (err?.response?.status === 409) {
        setSubmitError(err.response.data?.message || 'You already have this book in your library.');
      } else {
        setSubmitError('Failed to save book. Please try again.');
      }
    }
  };

  if (!isOpen) return null;

  const inputClass =
    'mt-1 block w-full rounded-neu-lg border-none bg-surface shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 p-3 text-on-surface placeholder:text-outline transition-all';
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-on-surface-variant';

  return (
    <div className="fixed inset-0 bg-black/50 overflow-y-auto z-50 flex items-start justify-center p-4 py-8">
      <div className="relative bg-surface rounded-neu-xl shadow-neu-xl w-full max-w-lg p-6 my-auto">
        <h3 className="font-display text-xl font-bold text-on-surface mb-6">
          {editingBook ? 'Edit Book Details' : 'Add New Book'}
        </h3>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface shadow-neu-xs hover:shadow-neu-inset-sm text-on-surface-variant flex items-center justify-center transition-all"
        >
          <X size={16} />
        </button>

        {/* ── Lookup Section (add mode only) ────────────────────────────── */}
        {!editingBook && (
          <div className="mb-6 pb-5 border-b border-outline-variant/20">
            {/* Tab switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-neu-lg bg-surface-container shadow-neu-inset-sm mb-4">
              {LOOKUP_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsbnError('');
                    setIsbnSuccess(false);
                    setSearchResults([]);
                  }}
                  className={`py-1.5 px-3 text-sm font-semibold rounded-neu transition-all ${
                    activeTab === tab.id
                      ? 'bg-surface-container-low text-primary shadow-neu-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── ISBN Tab ── */}
            {activeTab === 'isbn' && (
              <div>
                <label
                  htmlFor="isbnLookup"
                  className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2"
                >
                  Enter ISBN-10 or ISBN-13
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-grow flex items-center gap-2 rounded-neu-lg bg-surface shadow-neu-inset-lg focus-within:shadow-neu-inset-focus px-3.5 py-2.5 transition-all">
                    <Hash size={15} className="text-outline shrink-0" />
                    <input
                      type="text"
                      id="isbnLookup"
                      value={isbnQuery}
                      onChange={(e) => {
                        setIsbnQuery(e.target.value);
                        setIsbnError('');
                        setIsbnSuccess(false);
                      }}
                      onKeyDown={handleIsbnKeyDown}
                      placeholder="e.g. 9780743273565"
                      className="w-full bg-transparent border-none p-0 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-0"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleIsbnLookup}
                    disabled={isbnLooking || !isbnQuery.trim()}
                    className="flex-shrink-0 inline-flex items-center px-4 py-2 text-sm font-bold rounded-full text-on-primary bg-primary shadow-neu-sm hover:shadow-neu-xs active:shadow-neu-inset disabled:opacity-50 transition-all"
                  >
                    {isbnLooking ? <Loader size={16} className="animate-spin" /> : 'Look up'}
                  </button>
                </div>

                {/* Success / Error feedback */}
                {isbnSuccess && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-secondary">
                    <CheckCircle2 size={15} />
                    Book found! Form filled — review and save.
                  </p>
                )}
                {isbnError && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                    <AlertCircle size={15} />
                    {isbnError}
                  </p>
                )}
              </div>
            )}

            {/* ── Title Search Tab ── */}
            {activeTab === 'title' && (
              <div>
                <label
                  htmlFor="bookSearch"
                  className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2"
                >
                  Search for Book (Google Books API)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="bookSearch"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title or author..."
                    className="flex-grow rounded-neu-lg border-none bg-surface shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 p-3 text-sm text-on-surface placeholder:text-outline transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={isSearching || searchQuery.length < 3}
                    className="flex-shrink-0 inline-flex items-center px-4 py-2 rounded-full text-on-primary bg-primary shadow-neu-sm hover:shadow-neu-xs active:shadow-neu-inset disabled:opacity-50 transition-all"
                  >
                    {isSearching ? (
                      <Loader size={18} className="animate-spin" />
                    ) : (
                      <Search size={18} />
                    )}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-3 max-h-40 overflow-y-auto rounded-neu-lg p-2 bg-surface-container shadow-neu-inset-sm space-y-1">
                    {searchResults.map((book) => (
                      <div
                        key={book.id}
                        onClick={() => handleSelectBook(book)}
                        className="p-2 hover:shadow-neu-inset-sm cursor-pointer rounded-neu-lg transition-all"
                      >
                        <p className="text-sm font-semibold text-on-surface">{book.title}</p>
                        <p className="text-xs text-on-surface-variant italic">by {book.author}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Conflict / Submit Error ────────────────────────────────────── */}
        {submitError && (
          <div className="mb-4 flex items-start gap-2 rounded-neu-lg bg-surface shadow-neu-inset-xs p-3 text-sm text-neu-error">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* ── Book Form ─────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Title <span className="text-neu-error">*</span>
            </label>
            <input
              type="text"
              name="title"
              id="title"
              value={formState.title}
              onChange={handleInputChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="author" className={labelClass}>
              Author <span className="text-neu-error">*</span>
            </label>
            <input
              type="text"
              name="author"
              id="author"
              value={formState.author}
              onChange={handleInputChange}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="genre" className={labelClass}>
              Genre
            </label>
            <input
              type="text"
              name="genre"
              id="genre"
              value={formState.genre}
              onChange={handleInputChange}
              className={inputClass}
            />
          </div>

          {/* Phase 18: optional blurb — richer input for "similar books" and the
              spoiler-light AI summary than title/author/genre alone. Auto-filled
              by ISBN lookup / title search when the source has one. */}
          <div>
            <label htmlFor="description" className={labelClass}>
              Description{' '}
              <span className="text-xs font-normal text-outline normal-case tracking-normal">
                (optional — helps AI features)
              </span>
            </label>
            <textarea
              name="description"
              id="description"
              value={formState.description}
              onChange={handleInputChange}
              rows={3}
              maxLength={2000}
              placeholder="A short blurb about the book..."
              className={`${inputClass} resize-none text-sm`}
            />
          </div>

          {/* Phase 03: ISBN field (pre-filled from lookup, or manual entry) */}
          <div>
            <label htmlFor="isbn" className={labelClass}>
              ISBN{' '}
              <span className="text-xs font-normal text-outline normal-case tracking-normal">
                (optional)
              </span>
            </label>
            <input
              type="text"
              name="isbn"
              id="isbn"
              value={formState.isbn}
              onChange={handleInputChange}
              placeholder="e.g. 9780743273565"
              className={`${inputClass} font-mono text-sm`}
            />
          </div>

          <div>
            <label className={`${labelClass} mb-2`}>Cover Image</label>
            <div className="flex items-start gap-4">
              <ImageUploadField
                currentUrl={formState.coverUrl}
                uploadFn={uploadBookCover}
                maxSizeMB={3}
                shape="square"
                size={72}
                onUploaded={(url) => setFormState((prev) => ({ ...prev, coverUrl: url }))}
              />
              <div className="flex-grow">
                <label htmlFor="coverUrl" className="block text-xs text-outline mb-1">
                  or paste an image URL
                </label>
                <input
                  type="url"
                  name="coverUrl"
                  id="coverUrl"
                  value={formState.coverUrl}
                  onChange={handleInputChange}
                  className={`${inputClass} !mt-0 py-2.5 text-sm`}
                />
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="status" className={labelClass}>
              Status
            </label>
            <select
              name="status"
              id="status"
              value={formState.status}
              onChange={handleInputChange}
              className={inputClass}
            >
              <option value="wantToRead">Want to Read</option>
              <option value="reading">Reading</option>
              <option value="completed">Completed</option>
              <option value="onHold">On Hold</option>
              <option value="dnf">Did Not Finish (DNF)</option>
            </select>
          </div>

          {/* Phase 04: Page tracking fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="totalPages" className={labelClass}>
                Total Pages{' '}
                <span className="text-xs font-normal text-outline normal-case tracking-normal">
                  (optional)
                </span>
              </label>
              <input
                type="number"
                name="totalPages"
                id="totalPages"
                value={formState.totalPages}
                onChange={handleInputChange}
                min="0"
                placeholder="e.g. 320"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="currentPage" className={labelClass}>
                Current Page{' '}
                <span className="text-xs font-normal text-outline normal-case tracking-normal">
                  (optional)
                </span>
              </label>
              <input
                type="number"
                name="currentPage"
                id="currentPage"
                value={formState.currentPage}
                onChange={handleInputChange}
                min="0"
                placeholder="e.g. 0"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-sm font-semibold text-on-surface bg-surface shadow-neu-xs hover:shadow-neu-inset-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 text-sm font-bold rounded-full text-on-primary bg-primary shadow-neu-md hover:shadow-neu-sm active:shadow-neu-inset transition-all"
            >
              <Save size={16} className="mr-2" />
              {editingBook ? 'Update Book' : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookFormModal;
