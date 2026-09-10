import React, { useState, useEffect } from 'react';
import { X, Save, Search, Loader, Hash, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import { lookupIsbn } from '../services/isbnService';

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
    status: 'toRead',
    coverUrl: '',
    isbn: '',
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
      });
    } else {
      resetAll();
    }
  }, [editingBook, isOpen]);

  const resetAll = () => {
    setFormState({ title: '', author: '', genre: '', status: 'toRead', coverUrl: '', isbn: '' });
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
    const digits = raw.replace(/[\s\-]/g, '');
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
        status: 'toRead',
        isbn: book.isbn || digits,
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
      status: 'toRead',
      isbn: '',
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

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">
          {editingBook ? 'Edit Book Details' : 'Add New Book'}
        </h3>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition duration-150"
        >
          <X size={24} />
        </button>

        {/* ── Lookup Section (add mode only) ────────────────────────────── */}
        {!editingBook && (
          <div className="mb-6 pb-4 border-b">
            {/* Tab switcher */}
            <div className="flex space-x-1 mb-4 bg-gray-100 rounded-lg p-1">
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
                  className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition duration-150 ${
                    activeTab === tab.id
                      ? 'bg-white text-indigo-700 shadow'
                      : 'text-gray-500 hover:text-gray-700'
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
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Enter ISBN-10 or ISBN-13
                </label>
                <div className="flex space-x-2">
                  <div className="relative flex-grow">
                    <Hash
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
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
                      className="w-full pl-9 pr-4 py-2.5 rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleIsbnLookup}
                    disabled={isbnLooking || !isbnQuery.trim()}
                    className="flex-shrink-0 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition duration-150"
                  >
                    {isbnLooking ? <Loader size={16} className="animate-spin" /> : 'Look up'}
                  </button>
                </div>

                {/* Success / Error feedback */}
                {isbnSuccess && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-green-600">
                    <CheckCircle2 size={15} />
                    Book found! Form filled — review and save.
                  </p>
                )}
                {isbnError && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-600">
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
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Search for Book (Google Books API)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    id="bookSearch"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title or author..."
                    className="flex-grow rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={isSearching || searchQuery.length < 3}
                    className="flex-shrink-0 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition duration-150"
                  >
                    {isSearching ? (
                      <Loader size={18} className="animate-spin" />
                    ) : (
                      <Search size={18} />
                    )}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-3 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
                    {searchResults.map((book) => (
                      <div
                        key={book.id}
                        onClick={() => handleSelectBook(book)}
                        className="p-2 border-b last:border-b-0 hover:bg-indigo-50 cursor-pointer rounded-md transition duration-150"
                      >
                        <p className="text-sm font-semibold text-gray-800">{book.title}</p>
                        <p className="text-xs text-gray-500 italic">by {book.author}</p>
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
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* ── Book Form ─────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              id="title"
              value={formState.title}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
            />
          </div>
          <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-700">
              Author <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="author"
              id="author"
              value={formState.author}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
            />
          </div>
          <div>
            <label htmlFor="genre" className="block text-sm font-medium text-gray-700">
              Genre
            </label>
            <input
              type="text"
              name="genre"
              id="genre"
              value={formState.genre}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
            />
          </div>

          {/* Phase 03: ISBN field (pre-filled from lookup, or manual entry) */}
          <div>
            <label htmlFor="isbn" className="block text-sm font-medium text-gray-700">
              ISBN <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              name="isbn"
              id="isbn"
              value={formState.isbn}
              onChange={handleInputChange}
              placeholder="e.g. 9780743273565"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border font-mono text-sm"
            />
          </div>

          <div>
            <label htmlFor="coverUrl" className="block text-sm font-medium text-gray-700">
              Cover Image URL
            </label>
            <input
              type="url"
              name="coverUrl"
              id="coverUrl"
              value={formState.coverUrl}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border"
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              name="status"
              id="status"
              value={formState.status}
              onChange={handleInputChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 border bg-white"
            >
              <option value="toRead">To Read</option>
              <option value="currentlyReading">Currently Reading</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
            >
              <Save size={18} className="mr-2" />
              {editingBook ? 'Update Book' : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookFormModal;
