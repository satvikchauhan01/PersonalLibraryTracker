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
import { Library, Plus, Trash2, X, BookOpen } from 'lucide-react';

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
      const { data } = await api.get('/books');
      setAllBooks(data);
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

  if (loading) {
    return <div className="text-xl font-semibold text-indigo-600">Loading your shelves...</div>;
  }

  return (
    <>
      <h2 className="text-3xl font-extrabold text-gray-900 mb-6 flex items-center gap-2">
        <Library className="text-indigo-600" /> My Shelves
      </h2>

      {/* Create shelf */}
      <form onSubmit={handleCreateShelf} className="flex gap-2 mb-8 max-w-md">
        <input
          type="text"
          value={newShelfName}
          onChange={(e) => setNewShelfName(e.target.value)}
          placeholder="e.g. Re-read someday"
          className="flex-grow rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          disabled={creating || !newShelfName.trim()}
          className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus size={16} className="mr-1" /> New Shelf
        </button>
      </form>
      {createError && <p className="text-sm text-red-600 -mt-6 mb-6">{createError}</p>}

      {shelves.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg shadow-md">
          <Library className="w-12 h-12 text-gray-400 mx-auto" />
          <p className="mt-4 text-xl font-medium text-gray-500">
            No shelves yet — create your first custom collection above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {shelves.map((shelf) => (
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
              className={`bg-white rounded-xl shadow-md p-5 cursor-pointer border-2 transition-colors ${
                activeShelf?._id === shelf._id ? 'border-indigo-500' : 'border-transparent'
              } hover:border-indigo-300`}
            >
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-gray-800">{shelf.name}</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteShelf(shelf);
                  }}
                  className="text-gray-300 hover:text-red-500"
                  title="Delete shelf"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {shelf.books.length} book{shelf.books.length === 1 ? '' : 's'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Active shelf detail */}
      {activeShelf && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">{activeShelf.name}</h3>
            <div className="flex gap-2">
              <button
                onClick={openAddBooks}
                className="inline-flex items-center px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100"
              >
                <Plus size={14} className="mr-1" /> Add Book
              </button>
              <button
                onClick={() => setActiveShelf(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {activeShelf.books.length === 0 ? (
            <p className="text-gray-400 text-sm py-6 text-center">
              This shelf is empty — add a book from your library.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {activeShelf.books.map((book) => (
                <div key={book._id} className="relative group">
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-full h-36 object-cover rounded-lg shadow"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://placehold.co/128x192/475569/ffffff?text=No+Cover';
                    }}
                  />
                  <p className="text-xs font-medium text-gray-700 mt-1 line-clamp-1">
                    {book.title}
                  </p>
                  <button
                    onClick={() => handleRemoveBook(book._id)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-500"
                    title="Remove from shelf"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add-book picker */}
      {showAddBooks && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[75vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <h4 className="font-bold text-gray-800">Add to "{activeShelf.name}"</h4>
              <button
                onClick={() => setShowAddBooks(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-1">
              {allBooks.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
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
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                        onShelf ? 'opacity-40 cursor-default' : 'hover:bg-indigo-50'
                      }`}
                    >
                      <img
                        src={book.coverUrl}
                        alt=""
                        className="w-8 h-12 object-cover rounded flex-shrink-0"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://placehold.co/128x192/475569/ffffff?text=No+Cover';
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 line-clamp-1">
                          {book.title}
                        </p>
                        <p className="text-xs text-gray-400">
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
