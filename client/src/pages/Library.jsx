import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import BookCard from '../components/BookCard';
import BookFormModal from '../components/BookFormModal';
import DeleteModal from '../components/DeleteModal';
import InsightModal from '../components/InsightModal';
import StatCard from '../components/StatCard';
import LogSessionModal from '../components/LogSessionModal';
import ReadingCalendar from '../components/ReadingCalendar';
import BookDetailModal from '../components/BookDetailModal';
import ActivityFeed from '../components/ActivityFeed';
import ImportExportModal from '../components/ImportExportModal';
import Pagination from '../components/Pagination';
import { setRating, toggleFavorite } from '../services/organizationService';
import { aiSearch } from '../services/aiService'; // Phase 18
import {
  BookOpen,
  Book,
  CheckCircle,
  PlusCircle,
  Search,
  Clock,
  XCircle,
  PauseCircle,
  SlidersHorizontal,
  ArrowLeftRight,
  Sparkles,
  Loader2,
} from 'lucide-react';

// Phase 04: extended status list
const STATUSES = [
  { id: 'all', label: 'All Books', icon: BookOpen, color: 'text-gray-600' },
  { id: 'wantToRead', label: 'Want to Read', icon: PlusCircle, color: 'text-blue-500' },
  { id: 'reading', label: 'Reading', icon: Book, color: 'text-yellow-500' },
  { id: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-500' },
  { id: 'onHold', label: 'On Hold', icon: PauseCircle, color: 'text-gray-500' },
  { id: 'dnf', label: 'DNF', icon: XCircle, color: 'text-red-400' },
];

// Toggle cycles only the 3 "active" statuses; dnf/onHold set via Edit modal
const TOGGLE_CYCLE = { wantToRead: 'reading', reading: 'completed', completed: 'wantToRead' };

// Phase 06: sort options map straight onto the server's sortBy/sortDir params
const SORT_OPTIONS = [
  { id: 'createdAt:desc', label: 'Recently Added', sortBy: 'createdAt', sortDir: 'desc' },
  { id: 'createdAt:asc', label: 'Oldest Added', sortBy: 'createdAt', sortDir: 'asc' },
  { id: 'title:asc', label: 'Title (A–Z)', sortBy: 'title', sortDir: 'asc' },
  { id: 'author:asc', label: 'Author (A–Z)', sortBy: 'author', sortDir: 'asc' },
  { id: 'rating:desc', label: 'Highest Rated', sortBy: 'rating', sortDir: 'desc' },
];

const PAGE_SIZE = 12;

const Library = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Phase 06: filters, search, sort & pagination — all server-driven
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [minRating, setMinRating] = useState('');
  const [tagFilter, setTagFilter] = useState(''); // Phase 18: only settable via AI search today
  const [sortOption, setSortOption] = useState(SORT_OPTIONS[0].id);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Phase 18: natural-language search
  const [showAiSearch, setShowAiSearch] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiSearchError, setAiSearchError] = useState('');

  // Stats reflect the whole library regardless of the current filters —
  // fetched separately so paging/searching never distorts the counts.
  const [stats, setStats] = useState({
    total: 0,
    wantToRead: 0,
    reading: 0,
    completed: 0,
    onHold: 0,
  });

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [bookToDelete, setBookToDelete] = useState(null);
  const [insightModal, setInsightModal] = useState({ isOpen: false, book: null });
  const [sessionBook, setSessionBook] = useState(null); // Phase 04: log-session modal
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const [detailBook, setDetailBook] = useState(null); // Phase 05: review/notes/quotes/tags modal
  const [showImportExport, setShowImportExport] = useState(false); // Phase 13

  // Debounce the search box so every keystroke doesn't fire a request
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 whenever a filter/search/sort actually changes
  useEffect(() => {
    setPage(1);
  }, [activeFilter, debouncedSearch, genreFilter, minRating, tagFilter, sortOption]);

  const sortConfig = SORT_OPTIONS.find((o) => o.id === sortOption) || SORT_OPTIONS[0];

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/books', {
        params: {
          page,
          limit: PAGE_SIZE,
          status: activeFilter !== 'all' ? activeFilter : undefined,
          q: debouncedSearch || undefined,
          genre: genreFilter || undefined,
          minRating: minRating || undefined,
          tag: tagFilter || undefined, // Phase 18
          sortBy: sortConfig.sortBy,
          sortDir: sortConfig.sortDir,
        },
      });
      setBooks(data.books);
      setPagination({ total: data.total, totalPages: data.totalPages });
    } catch (error) {
      console.error('Error fetching books:', error);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeFilter, debouncedSearch, genreFilter, minRating, tagFilter, sortOption]);

  // Independent of filters — always the true per-status counts across the library
  const fetchStats = useCallback(async () => {
    try {
      const [all, wantToRead, reading, completed, onHold] = await Promise.all([
        api.get('/books', { params: { limit: 1 } }),
        api.get('/books', { params: { limit: 1, status: 'wantToRead' } }),
        api.get('/books', { params: { limit: 1, status: 'reading' } }),
        api.get('/books', { params: { limit: 1, status: 'completed' } }),
        api.get('/books', { params: { limit: 1, status: 'onHold' } }),
      ]);
      setStats({
        total: all.data.total,
        wantToRead: wantToRead.data.total,
        reading: reading.data.total,
        completed: completed.data.total,
        onHold: onHold.data.total,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const handleSaveBook = async (bookData) => {
    try {
      if (editingBook) {
        await api.put(`/books/${editingBook._id}`, bookData);
      } else {
        await api.post('/books', bookData);
      }
      fetchBooks();
      fetchStats();
      return true;
    } catch (error) {
      throw error; // Let modal display the specific error (e.g. 409 conflict)
    }
  };

  const confirmDelete = async () => {
    if (!bookToDelete) return;
    try {
      await api.delete(`/books/${bookToDelete._id}`);
      setBookToDelete(null);
      fetchBooks();
      fetchStats();
    } catch (error) {
      console.error('Error deleting book:', error);
    }
  };

  // Phase 04: cycles wantToRead → reading → completed → wantToRead only
  const handleToggleStatus = async (book) => {
    const newStatus = TOGGLE_CYCLE[book.status] || 'wantToRead';
    try {
      await api.put(`/books/${book._id}`, { status: newStatus });
      fetchBooks();
      fetchStats();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Phase 05: rating & favorite — optimistic local update, revert on failure
  const handleSetRating = async (book, rating) => {
    setBooks((prev) => prev.map((b) => (b._id === book._id ? { ...b, rating } : b)));
    try {
      await setRating(book._id, rating);
    } catch (error) {
      console.error('Error setting rating:', error);
      fetchBooks();
    }
  };

  const handleToggleFavorite = async (book) => {
    setBooks((prev) =>
      prev.map((b) => (b._id === book._id ? { ...b, isFavorite: !b.isFavorite } : b))
    );
    try {
      await toggleFavorite(book._id);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      fetchBooks();
    }
  };

  // ── Phase 18: natural-language search ───────────────────────────────────
  const handleAiSearch = async (e) => {
    e.preventDefault();
    if (!aiQuery.trim() || aiSearchLoading) return;
    setAiSearchLoading(true);
    setAiSearchError('');
    try {
      const { data } = await aiSearch(aiQuery.trim());
      const { filters } = data;

      // A fresh AI search replaces the current filter set rather than
      // merging with it — otherwise a leftover manual filter could silently
      // narrow (or contradict) what was just asked for.
      setActiveFilter(filters.status || 'all');
      setSearchInput(filters.q || '');
      setGenreFilter(filters.genre || '');
      setTagFilter(filters.tag || '');
      setMinRating(filters.minRating != null ? String(filters.minRating) : '');

      const matchedSort = SORT_OPTIONS.find(
        (o) => o.sortBy === filters.sortBy && o.sortDir === (filters.sortDir || 'desc')
      );
      setSortOption(matchedSort ? matchedSort.id : SORT_OPTIONS[0].id);

      // Surface the applied genre/rating/tag filters in the "more filters"
      // panel so the AI-derived search isn't invisible/confusing.
      if (filters.genre || filters.minRating != null || filters.tag) {
        setShowMoreFilters(true);
      }
      setShowAiSearch(false);
      setAiQuery('');
    } catch (err) {
      if (err.response?.status === 402) {
        setAiSearchError("You've used all your free AI calls this month. Upgrade to Library Pro.");
      } else if (err.response?.status === 503) {
        setAiSearchError('AI features are not configured on this server yet.');
      } else {
        setAiSearchError(err.response?.data?.message || 'Could not interpret that search.');
      }
    } finally {
      setAiSearchLoading(false);
    }
  };

  // ── MODAL HANDLERS ────────────────────────────────────────────────────────

  const openAddModal = () => {
    setEditingBook(null);
    setIsModalOpen(true);
  };
  const openEditModal = (book) => {
    setEditingBook(book);
    setIsModalOpen(true);
  };
  const openDeleteModal = (book) => setBookToDelete(book);
  const openInsightModal = (book) => setInsightModal({ isOpen: true, book });
  const openSessionModal = (book) => setSessionBook(book); // Phase 04
  const openDetailModal = (book) => setDetailBook(book); // Phase 05

  if (loading && !books.length && page === 1) {
    return <div className="text-xl font-semibold text-primary">Loading Your Library...</div>;
  }

  return (
    <>
      {/* Reading stats */}
      <div className="mb-8">
        <h2 className="font-display text-3xl font-extrabold text-on-surface mb-6">
          My Reading Stats
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Books"
            value={stats.total}
            icon={BookOpen}
            color="text-primary"
            caption="in library"
            captionColor="text-secondary"
          />
          <StatCard
            label="Want to Read"
            value={stats.wantToRead}
            icon={PlusCircle}
            color="text-primary-container"
            caption="curated"
          />
          <StatCard
            label="Reading"
            value={stats.reading}
            icon={Book}
            color="text-tertiary"
            caption="in flow"
            valueColor="text-tertiary"
            captionColor="text-tertiary"
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={CheckCircle}
            color="text-secondary"
            caption="finished"
            captionColor="text-secondary"
          />
          <StatCard
            label="On Hold"
            value={stats.onHold}
            icon={Clock}
            color="text-outline"
            caption="paused"
          />
        </div>
      </div>

      {/* Phase 04: Reading Activity Calendar · Phase 08: Friend Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2">
          <ReadingCalendar refreshTrigger={calendarRefresh} />
        </div>
        <ActivityFeed />
      </div>

      {/* Status filters & search */}
      <div className="bg-surface rounded-neu-xl shadow-neu-lg p-4 lg:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
          {STATUSES.map((status) => (
            <button
              key={status.id}
              onClick={() => setActiveFilter(status.id)}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-full transition-all shrink-0 ${
                activeFilter === status.id
                  ? 'bg-surface shadow-neu-inset text-primary font-bold'
                  : 'bg-surface shadow-neu hover:shadow-neu-inset text-on-surface-variant'
              }`}
            >
              <status.icon
                size={16}
                className={`mr-2 ${activeFilter === status.id ? 'text-primary' : status.color}`}
              />
              {status.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full xl:w-auto">
          <div className="relative flex-1 xl:w-72">
            <div className="h-11 w-full rounded-full bg-surface shadow-neu-inset-lg flex items-center px-4 gap-2 transition-shadow focus-within:shadow-neu-inset-focus">
              <Search size={18} className="text-outline shrink-0" />
              <input
                type="text"
                placeholder="Search by title or author..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-on-surface placeholder:text-outline w-full leading-none focus:ring-0 p-0"
              />
            </div>
          </div>
          <button
            onClick={() => setShowMoreFilters((prev) => !prev)}
            className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              showMoreFilters || genreFilter || minRating || tagFilter
                ? 'bg-surface shadow-neu-inset text-primary'
                : 'bg-surface shadow-neu hover:shadow-neu-inset text-on-surface-variant hover:text-on-surface'
            }`}
            title="More filters"
          >
            <SlidersHorizontal size={18} />
          </button>
          {/* Phase 18: natural-language search */}
          <button
            onClick={() => setShowAiSearch((prev) => !prev)}
            className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              showAiSearch
                ? 'bg-surface shadow-neu-inset text-tertiary'
                : 'bg-surface shadow-neu hover:shadow-neu-inset text-tertiary'
            }`}
            title="Ask in plain English"
          >
            <Sparkles size={18} />
          </button>
          <button
            onClick={() => setShowImportExport(true)}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-surface shadow-neu hover:shadow-neu-inset flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all"
            title="Import / Export"
          >
            <ArrowLeftRight size={18} />
          </button>
        </div>
      </div>

      {/* Phase 18: natural-language search panel */}
      {showAiSearch && (
        <div className="mb-6 p-4 bg-surface rounded-neu-xl shadow-neu-inset">
          <form onSubmit={handleAiSearch} className="flex gap-2">
            <input
              type="text"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              placeholder="e.g. short fantasy books I rated highly last year"
              autoFocus
              className="flex-grow rounded-full border-none bg-surface shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 text-sm px-4 py-2 text-on-surface placeholder:text-outline"
            />
            <button
              type="submit"
              disabled={aiSearchLoading || !aiQuery.trim()}
              className="flex-shrink-0 inline-flex items-center px-4 py-2 rounded-full bg-surface shadow-neu hover:shadow-neu-inset text-tertiary text-sm font-bold disabled:opacity-50 transition-all"
            >
              {aiSearchLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
            </button>
          </form>
          {aiSearchError && <p className="mt-2 text-sm text-neu-error">{aiSearchError}</p>}
        </div>
      )}

      {/* Phase 06: Genre / rating / sort filters */}
      {showMoreFilters && (
        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-surface rounded-neu-xl shadow-neu-lg">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Genre</label>
            <input
              type="text"
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              placeholder="e.g. Fantasy"
              className="rounded-neu border-none bg-surface shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 text-sm px-3 py-1.5 text-on-surface placeholder:text-outline"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">
              Min. Rating
            </label>
            <select
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="rounded-neu border-none bg-surface shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 text-sm px-3 py-1.5 text-on-surface"
            >
              <option value="">Any</option>
              {[4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {r}+ stars
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">Tag</label>
            <input
              type="text"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              placeholder="e.g. cozy"
              className="rounded-neu border-none bg-surface shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 text-sm px-3 py-1.5 text-on-surface placeholder:text-outline"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1">
              Sort by
            </label>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="rounded-neu border-none bg-surface shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 text-sm px-3 py-1.5 text-on-surface"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {(genreFilter || minRating || tagFilter) && (
            <button
              onClick={() => {
                setGenreFilter('');
                setMinRating('');
                setTagFilter('');
              }}
              className="text-sm text-outline hover:text-on-surface pb-1.5 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Book list */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="font-display text-2xl font-bold text-on-surface tracking-tight">
          {STATUSES.find((s) => s.id === activeFilter)?.label}
          <span className="text-base font-normal text-on-surface-variant ml-2">
            {pagination.total} book{pagination.total === 1 ? '' : 's'}
          </span>
        </h2>
        <button
          onClick={openAddModal}
          className="inline-flex items-center px-5 py-2.5 rounded-full bg-surface shadow-neu-md hover:shadow-neu-inset text-primary font-bold text-sm transition-all self-start sm:self-auto"
        >
          <PlusCircle size={18} className="mr-2" />
          Add New Book
        </button>
      </div>

      {books.length === 0 ? (
        <div className="text-center py-10 bg-surface rounded-neu-xl shadow-neu-lg">
          <BookOpen className="w-12 h-12 text-outline mx-auto" />
          <p className="mt-4 text-xl font-medium text-on-surface-variant">
            No books matching your criteria.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {books.map((book) => (
            <BookCard
              key={book._id}
              book={book}
              onToggleStatus={handleToggleStatus}
              onEdit={openEditModal}
              onDelete={openDeleteModal}
              onGetInsights={openInsightModal}
              onLogSession={openSessionModal} // Phase 04
              onSetRating={handleSetRating} // Phase 05
              onToggleFavorite={handleToggleFavorite} // Phase 05
              onOpenDetails={openDetailModal} // Phase 05
            />
          ))}
        </div>
      )}

      {/* Phase 06/13: Pagination */}
      <Pagination
        page={page}
        totalPages={pagination.totalPages}
        onChange={setPage}
        className="mt-8"
      />

      {showImportExport && (
        <ImportExportModal
          onClose={() => setShowImportExport(false)}
          onImported={() => {
            fetchBooks();
            fetchStats();
          }}
        />
      )}

      {/* Modals */}
      {isModalOpen && (
        <BookFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveBook}
          editingBook={editingBook}
        />
      )}

      {bookToDelete && (
        <DeleteModal
          isOpen={!!bookToDelete}
          onClose={() => setBookToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      {insightModal.isOpen && (
        <InsightModal
          isOpen={insightModal.isOpen}
          onClose={() => setInsightModal({ isOpen: false, book: null })}
          book={insightModal.book}
        />
      )}

      {/* Phase 04: Log Session Modal */}
      {sessionBook && (
        <LogSessionModal
          book={sessionBook}
          onClose={() => setSessionBook(null)}
          onSaved={() => {
            fetchBooks();
            setCalendarRefresh((prev) => prev + 1);
          }}
        />
      )}

      {/* Phase 05: Review / Notes / Quotes / Tags */}
      {detailBook && (
        <BookDetailModal
          book={detailBook}
          onClose={() => setDetailBook(null)}
          onUpdated={() => {
            fetchBooks();
            fetchStats();
          }}
        />
      )}
    </>
  );
};

export default Library;
