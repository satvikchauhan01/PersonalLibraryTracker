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
  const [sortOption, setSortOption] = useState(SORT_OPTIONS[0].id);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

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
  }, [activeFilter, debouncedSearch, genreFilter, minRating, sortOption]);

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
  }, [page, activeFilter, debouncedSearch, genreFilter, minRating, sortOption]);

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
    return <div className="text-xl font-semibold text-indigo-600">Loading Your Library...</div>;
  }

  return (
    <>
      {/* Reading stats */}
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6">
          My Reading Stats
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Books"
            value={stats.total}
            icon={BookOpen}
            color="text-indigo-600"
          />
          <StatCard
            label="Want to Read"
            value={stats.wantToRead}
            icon={PlusCircle}
            color="text-blue-500"
          />
          <StatCard label="Reading" value={stats.reading} icon={Book} color="text-yellow-500" />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={CheckCircle}
            color="text-green-500"
          />
          <StatCard label="On Hold" value={stats.onHold} icon={Clock} color="text-gray-500" />
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b dark:border-gray-800 pb-4">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <button
              key={status.id}
              onClick={() => setActiveFilter(status.id)}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-full transition duration-150 ${
                activeFilter === status.id
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700'
              }`}
            >
              <status.icon
                size={16}
                className={`mr-2 ${activeFilter !== status.id ? status.color : 'text-white'}`}
              />
              {status.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search by title or author..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-full focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search
              size={18}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
          </div>
          <button
            onClick={() => setShowMoreFilters((prev) => !prev)}
            className={`flex-shrink-0 inline-flex items-center px-3 py-2 rounded-full border text-sm font-medium transition-colors ${
              showMoreFilters || genreFilter || minRating
                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title="More filters"
          >
            <SlidersHorizontal size={16} />
          </button>
          <button
            onClick={() => setShowImportExport(true)}
            className="flex-shrink-0 inline-flex items-center px-3 py-2 rounded-full border text-sm font-medium bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Import / Export"
          >
            <ArrowLeftRight size={16} />
          </button>
        </div>
      </div>

      {/* Phase 06: Genre / rating / sort filters */}
      {showMoreFilters && (
        <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Genre
            </label>
            <input
              type="text"
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              placeholder="e.g. Fantasy"
              className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm text-sm px-3 py-1.5 border focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Min. Rating
            </label>
            <select
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm text-sm px-3 py-1.5 border bg-white dark:bg-gray-700 dark:text-gray-100 focus:border-indigo-500 focus:ring-indigo-500"
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
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Sort by
            </label>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm text-sm px-3 py-1.5 border bg-white dark:bg-gray-700 dark:text-gray-100 focus:border-indigo-500 focus:ring-indigo-500"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {(genreFilter || minRating) && (
            <button
              onClick={() => {
                setGenreFilter('');
                setMinRating('');
              }}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 pb-1.5"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Book list */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {STATUSES.find((s) => s.id === activeFilter)?.label}
          <span className="text-base font-normal text-gray-400 ml-2">
            {pagination.total} book{pagination.total === 1 ? '' : 's'}
          </span>
        </h2>
        <button
          onClick={openAddModal}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
        >
          <PlusCircle size={18} className="mr-2" />
          Add New Book
        </button>
      </div>

      {books.length === 0 ? (
        <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto" />
          <p className="mt-4 text-xl font-medium text-gray-500 dark:text-gray-400">
            No books matching your criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
