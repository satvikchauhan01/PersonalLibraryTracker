import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  getShelves,
  getShelf,
  createShelf,
  deleteShelf,
  addBookToShelf,
  removeBookFromShelf,
} from '../services/shelfService';
import {
  Library,
  Plus,
  Trash2,
  X,
  BookOpen,
  Check,
  BookmarkPlus,
  MoreHorizontal,
} from 'lucide-react';

// Neumorphic redesign ("Tactile Bibliotheca"): each shelf card rotates
// through the three semantic accents (primary/secondary/tertiary) purely
// for visual rhythm — Stitch's own mock gives each shelf a distinct icon
// tint the same way, and we have no per-shelf color field to key off.
const SHELF_ACCENTS = ['text-primary', 'text-secondary', 'text-tertiary'];

const Shelves = () => {
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newShelfName, setNewShelfName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [activeShelf, setActiveShelf] = useState(null); // populated shelf being viewed
  const [allBooks, setAllBooks] = useState([]);
  const [showAddBooks, setShowAddBooks] = useState(false);

  const fetchShelves = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getShelves();
      setShelves(data);
    } catch (error) {
      console.error('Error fetching shelves:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchShelves();
  }, [fetchShelves]);

  const handleCreateShelf = async (e) => {
    e.preventDefault();
    if (!newShelfName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      await createShelf(newShelfName.trim());
      setNewShelfName('');
      fetchShelves();
    } catch (error) {
      setCreateError(error.response?.data?.message || 'Failed to create shelf.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteShelf = async (shelf) => {
    try {
      await deleteShelf(shelf._id);
      if (activeShelf?._id === shelf._id) setActiveShelf(null);
      fetchShelves();
    } catch (error) {
      console.error('Error deleting shelf:', error);
    }
  };

  const openShelf = async (shelf) => {
    try {
      const { data } = await getShelf(shelf._id);
      setActiveShelf(data);
    } catch (error) {
      console.error('Error loading shelf:', error);
    }
  };

  const handleRemoveBook = async (bookId) => {
    try {
      // The API response's `books` array is un-populated ObjectIds, not full
      // book docs, so just filter the already-populated local copy instead.
      await removeBookFromShelf(activeShelf._id, bookId);
      setActiveShelf((prev) => ({
        ...prev,
        books: prev.books.filter((b) => b._id !== bookId),
      }));
      fetchShelves(); // book counts on the shelf list may change
    } catch (error) {
      console.error('Error removing book from shelf:', error);
    }
  };

  const openAddBooks = async () => {
    try {
      // Phase 06: /books now returns { books, page, ... } — the picker wants
      // the whole library, so ask for a generously high limit.
      const { data } = await api.get('/books', { params: { limit: 200 } });
      setAllBooks(data.books);
      setShowAddBooks(true);
    } catch (error) {
      console.error('Error fetching books:', error);
    }
  };

  const handleAddBook = async (bookId) => {
    try {
      await addBookToShelf(activeShelf._id, bookId);
      const { data } = await getShelf(activeShelf._id);
      setActiveShelf(data);
      fetchShelves(); // book counts on the shelf list may change
    } catch (error) {
      console.error('Error adding book to shelf:', error);
    }
  };

  const onShelfList = new Set((activeShelf?.books || []).map((b) => b._id));
  const totalVolumes = shelves.reduce((sum, s) => sum + s.books.length, 0);

  if (loading) {
    return <div className="text-xl font-semibold text-primary">Loading your shelves...</div>;
  }

  return (
    <>
      {/* Breadcrumb & curatorial context header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center shadow-neu-xs text-primary">
            <Library size={15} />
          </div>
          <span className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
            Curated Collections
          </span>
          <span className="text-sm text-outline-variant">/</span>
          <span className="text-sm font-semibold text-primary">Shelves &amp; Archival Cases</span>
        </div>
        <div className="flex items-center gap-2 text-on-surface-variant text-xs">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface shadow-neu-inset-sm text-secondary font-medium">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            {shelves.length} Custom Collection{shelves.length === 1 ? '' : 's'}
          </span>
          <span className="px-3 py-1 rounded-full bg-surface shadow-neu-inset-sm">
            {totalVolumes} Total Volume{totalVolumes === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Create shelf */}
      <section className="p-4 lg:p-6 rounded-neu-xl bg-surface shadow-neu-lg mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl text-on-surface font-bold tracking-tight flex items-center gap-2">
              Form a New Collection
              <Plus size={16} className="text-primary" />
            </h2>
            <p className="text-sm text-on-surface-variant">
              Designate an archival niche to group your reading by theme, mood, or project.
            </p>
          </div>
          <form
            onSubmit={handleCreateShelf}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto lg:min-w-[420px]"
          >
            <div className="relative flex-1">
              <BookmarkPlus
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant pointer-events-none"
              />
              <input
                type="text"
                value={newShelfName}
                onChange={(e) => setNewShelfName(e.target.value)}
                placeholder="Enter shelf name (e.g. Cozy Autumn Reads)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-surface border-none text-sm text-on-surface placeholder:text-outline-variant shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newShelfName.trim()}
              className="shrink-0 px-5 py-2.5 rounded-full bg-surface text-primary text-sm font-bold shadow-neu-md hover:shadow-neu active:shadow-neu-inset flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Plus size={16} /> New Shelf
            </button>
          </form>
        </div>
        {createError && <p className="text-sm text-neu-error mt-3">{createError}</p>}
      </section>

      {shelves.length === 0 ? (
        <div className="text-center py-10 bg-surface rounded-neu-xl shadow-neu-lg mb-10">
          <Library className="w-12 h-12 text-outline mx-auto" />
          <p className="mt-4 text-xl font-medium text-on-surface-variant">
            No shelves yet — create your first custom collection above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-10">
          {shelves.map((shelf, i) => {
            const isActive = activeShelf?._id === shelf._id;
            const accent = SHELF_ACCENTS[i % SHELF_ACCENTS.length];
            return (
              <div
                key={shelf._id}
                role="button"
                tabIndex={0}
                onClick={() => openShelf(shelf)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openShelf(shelf);
                  }
                }}
                className={`relative p-4 lg:p-6 rounded-neu-xl bg-surface transition-all cursor-pointer flex flex-col justify-between ${
                  isActive ? 'shadow-neu-inset' : 'shadow-neu-xl hover:shadow-neu-xl-hover'
                }`}
              >
                {isActive && (
                  <div className="absolute -top-2.5 right-6 px-2 py-0.5 rounded-full bg-primary text-on-primary text-[0.6875rem] font-bold tracking-wide shadow-neu-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-on-primary" />
                    CURRENT VIEW
                  </div>
                )}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`w-11 h-11 rounded-neu-lg bg-surface-container flex items-center justify-center shadow-neu-inset-sm ${accent}`}
                    >
                      <Library size={20} />
                    </div>
                    {isActive ? (
                      <div className="w-8 h-8 rounded-full bg-surface flex items-center justify-center shadow-neu-xs text-primary">
                        <Check size={15} />
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteShelf(shelf);
                        }}
                        className="w-8 h-8 rounded-full bg-surface flex items-center justify-center shadow-neu-xs hover:shadow-neu-inset-sm text-on-surface-variant hover:text-neu-error transition-all"
                        title="Delete shelf"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="mt-4">
                    <h3
                      className={`font-display text-lg font-bold tracking-tight ${isActive ? 'text-primary' : 'text-on-surface'}`}
                    >
                      {shelf.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-on-surface-variant text-sm">
                      <BookOpen size={13} className="text-secondary" />
                      <span className="font-semibold text-on-surface">
                        {shelf.books.length}
                      </span>{' '}
                      book{shelf.books.length === 1 ? '' : 's'} cataloged
                    </div>
                  </div>
                </div>
                {/* Tactile spine indicator strip — decorative only */}
                <div className="mt-4 pt-1 flex items-center gap-1.5">
                  <div
                    className={`h-2 flex-1 rounded-full ${isActive ? 'bg-primary' : 'bg-surface-container-high shadow-neu-inset-xs'}`}
                  />
                  <div className="h-2 w-3 rounded-full bg-primary-container" />
                  <div className="h-2 w-3 rounded-full bg-secondary-container" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active shelf detail */}
      {activeShelf && (
        <section className="p-4 lg:p-6 rounded-neu-xl bg-surface shadow-neu-xl flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-neu-lg bg-surface flex items-center justify-center shadow-neu-md text-primary">
                <Library size={24} />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-on-surface tracking-tight">
                  {activeShelf.name}
                </h2>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  {activeShelf.books.length} book{activeShelf.books.length === 1 ? '' : 's'}{' '}
                  assigned
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={openAddBooks}
                className="px-4 py-2.5 rounded-full bg-primary text-on-primary text-sm font-bold shadow-neu-md hover:shadow-neu-sm active:shadow-neu-inset flex items-center gap-1.5 transition-all"
              >
                <BookmarkPlus size={16} /> Add Book to Shelf
              </button>
              <button
                className="w-10 h-10 rounded-full bg-surface flex items-center justify-center shadow-neu-xs hover:shadow-neu-inset-sm text-on-surface-variant transition-all"
                title="Shelf options"
              >
                <MoreHorizontal size={17} />
              </button>
              <button
                onClick={() => setActiveShelf(null)}
                className="w-10 h-10 rounded-full bg-surface flex items-center justify-center shadow-neu-xs hover:shadow-neu-inset-sm text-on-surface-variant transition-all"
                title="Close"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {activeShelf.books.length === 0 ? (
            <p className="text-on-surface-variant text-sm py-6 text-center">
              This shelf is empty — add a book from your library.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
              {activeShelf.books.map((book) => (
                <div
                  key={book._id}
                  className="group relative rounded-neu-lg bg-surface p-3 shadow-neu-lg hover:shadow-neu-lg-hover transition-all flex flex-col justify-between"
                >
                  <div className="relative">
                    <div className="w-full aspect-[2/3] rounded-neu overflow-hidden shadow-neu-inset p-1.5 bg-surface-container">
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="w-full h-full object-cover rounded-neu shadow-sm"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://placehold.co/288x432/475569/ffffff?text=No+Cover';
                        }}
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveBook(book._id)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-surface/90 backdrop-blur text-on-surface-variant hover:text-neu-error opacity-0 group-hover:opacity-100 shadow-neu-xs flex items-center justify-center transition-all"
                      title="Remove from this shelf"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="mt-3">
                    {book.genre && (
                      <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
                        {book.genre}
                      </span>
                    )}
                    <h4 className="font-display text-sm font-bold text-on-surface mt-0.5 truncate group-hover:text-primary transition-colors">
                      {book.title}
                    </h4>
                    <p className="text-xs text-on-surface-variant truncate">{book.author}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Add-book picker */}
      {showAddBooks && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-neu-xl shadow-neu-xl w-full max-w-md max-h-[75vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-5 py-4 border-b border-outline-variant/20">
              <h4 className="font-display font-bold text-on-surface">
                Add to "{activeShelf.name}"
              </h4>
              <button
                onClick={() => setShowAddBooks(false)}
                className="w-8 h-8 rounded-full bg-surface flex items-center justify-center shadow-neu-xs hover:shadow-neu-inset-sm text-on-surface-variant transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-1">
              {allBooks.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-6">
                  <BookOpen className="mx-auto mb-2" /> No books in your library yet.
                </p>
              ) : (
                allBooks.map((book) => {
                  const onShelf = onShelfList.has(book._id);
                  return (
                    <button
                      key={book._id}
                      onClick={() => !onShelf && handleAddBook(book._id)}
                      disabled={onShelf}
                      className={`w-full flex items-center gap-3 p-2 rounded-neu-lg text-left transition-all ${
                        onShelf ? 'opacity-40 cursor-default' : 'hover:shadow-neu-inset-sm'
                      }`}
                    >
                      <img
                        src={book.coverUrl}
                        alt=""
                        className="w-8 h-12 object-cover rounded-neu flex-shrink-0 shadow-sm"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://placehold.co/128x192/475569/ffffff?text=No+Cover';
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-on-surface line-clamp-1">
                          {book.title}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {onShelf ? 'Already on shelf' : book.author}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Shelves;
