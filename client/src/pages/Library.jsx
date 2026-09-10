import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import BookCard from '../components/BookCard';
import BookFormModal from '../components/BookFormModal';
import DeleteModal from '../components/DeleteModal';
import InsightModal from '../components/InsightModal';
import StatCard from '../components/StatCard';
import { BookOpen, Book, CheckCircle, PlusCircle, Search } from 'lucide-react';

const STATUSES = [
  { id: 'all', label: 'All Books', icon: BookOpen, color: 'text-gray-600' },
  { id: 'toRead', label: 'To Read', icon: PlusCircle, color: 'text-blue-500' },
  { id: 'currentlyReading', label: 'Reading Now', icon: Book, color: 'text-yellow-500' },
  { id: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-500' },
];

const Library = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtering aur Search States
  const [activeFilter, setActiveFilter] = useState('all');
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [bookToDelete, setBookToDelete] = useState(null);
  const [insightModal, setInsightModal] = useState({ isOpen: false, book: null });

  // Backend API se books fetch karna
  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/books');
      setBooks(data);
    } catch (error) {
      console.error('Error fetching books:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // --- CRUD Operations ---

  const handleSaveBook = async (bookData) => {
    try {
      if (editingBook) {
        await api.put(`/books/${editingBook._id}`, bookData);
      } else {
        await api.post('/books', bookData);
      }
      fetchBooks(); // Re-fetch all books
      return true; // Success
    } catch (error) {
      // Re-throw so the modal can display the specific error (e.g. 409 conflict)
      throw error;
    }
  };

  const confirmDelete = async () => {
    if (!bookToDelete) return;
    try {
      await api.delete(`/books/${bookToDelete._id}`);
      setBookToDelete(null);
      fetchBooks(); // Sab books re-fetch karein
    } catch (error) {
      console.error('Error deleting book:', error);
    }
  };

  const handleToggleStatus = async (book) => {
    let newStatus;
    if (book.status === 'toRead') newStatus = 'currentlyReading';
    else if (book.status === 'currentlyReading') newStatus = 'completed';
    else newStatus = 'toRead';

    try {
      await api.put(`/books/${book._id}`, { status: newStatus });
      fetchBooks(); // Re-fetch
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // --- Modal Handlers ---

  const openAddModal = () => {
    setEditingBook(null);
    setIsModalOpen(true);
  };

  const openEditModal = (book) => {
    setEditingBook(book);
    setIsModalOpen(true);
  };

  const openDeleteModal = (book) => {
    setBookToDelete(book);
  };

  const openInsightModal = (book) => {
    setInsightModal({ isOpen: true, book });
  };

  // --- Filtering aur Stats ---

  const filteredBooks = useMemo(() => {
    const term = globalSearchTerm.toLowerCase();
    let list = books;
    if (activeFilter !== 'all') {
      list = books.filter((book) => book.status === activeFilter);
    }
    if (term) {
      list = list.filter(
        (book) =>
          book.title.toLowerCase().includes(term) ||
          book.author.toLowerCase().includes(term) ||
          (book.genre && book.genre.toLowerCase().includes(term))
      );
    }
    return list;
  }, [books, activeFilter, globalSearchTerm]);

  const stats = useMemo(
    () => ({
      total: books.length,
      toRead: books.filter((b) => b.status === 'toRead').length,
      currentlyReading: books.filter((b) => b.status === 'currentlyReading').length,
      completed: books.filter((b) => b.status === 'completed').length,
    }),
    [books]
  );

  if (loading && !books.length) {
    return <div className="text-xl font-semibold text-indigo-600">Loading Your Library...</div>;
  }

  return (
    <>
      {/* Profile Stats */}
      <div className="mb-12">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-6">My Reading Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Total Books"
            value={stats.total}
            icon={BookOpen}
            color="text-indigo-600"
          />
          <StatCard label="To Read" value={stats.toRead} icon={PlusCircle} color="text-blue-500" />
          <StatCard
            label="Reading Now"
            value={stats.currentlyReading}
            icon={Book}
            color="text-yellow-500"
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={CheckCircle}
            color="text-green-500"
          />
        </div>
      </div>

      {/* Status Filters aur Global Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b pb-4">
        <div className="flex flex-wrap gap-3">
          {STATUSES.map((status) => (
            <button
              key={status.id}
              onClick={() => setActiveFilter(status.id)}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-full transition duration-150 ${
                activeFilter === status.id
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
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

        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            placeholder="Search by Title, Author, or Genre..."
            value={globalSearchTerm}
            onChange={(e) => setGlobalSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:ring-indigo-500 focus:border-indigo-500"
          />
          <Search
            size={18}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          />
        </div>
      </div>

      {/* Book List */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {STATUSES.find((s) => s.id === activeFilter)?.label}
        </h2>
        <button
          onClick={openAddModal}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
        >
          <PlusCircle size={18} className="mr-2" />
          Add New Book
        </button>
      </div>

      {filteredBooks.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow-md">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto" />
          <p className="mt-4 text-xl font-medium text-gray-500">No books matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBooks.map((book) => (
            <BookCard
              key={book._id}
              book={book}
              onToggleStatus={handleToggleStatus}
              onEdit={openEditModal}
              onDelete={openDeleteModal}
              onGetInsights={openInsightModal}
            />
          ))}
        </div>
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
    </>
  );
};

export default Library;
