import React from 'react';
import { Settings, Edit, Trash2, Zap, BookMarked, Heart, MessageSquare } from 'lucide-react';
import StarRating from './StarRating';

// Phase 04: extended status map
const STATUS_MAP = {
  wantToRead: { label: 'Want to Read', color: 'bg-blue-100 text-blue-800' },
  reading: { label: 'Reading', color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  dnf: { label: 'DNF', color: 'bg-red-100 text-red-800' },
  onHold: { label: 'On Hold', color: 'bg-gray-100 text-gray-700' },
  // Legacy aliases (survive until all docs migrated)
  toRead: { label: 'Want to Read', color: 'bg-blue-100 text-blue-800' },
  currentlyReading: { label: 'Reading', color: 'bg-yellow-100 text-yellow-800' },
};

const BookCard = ({
  book,
  onToggleStatus,
  onEdit,
  onDelete,
  onGetInsights,
  onLogSession,
  onSetRating,
  onToggleFavorite,
  onOpenDetails,
}) => {
  const statusDisplay = STATUS_MAP[book.status] || {
    label: book.status,
    color: 'bg-gray-100 text-gray-700',
  };

  // Progress bar calculation
  const hasProgress = book.totalPages > 0;
  const progressPct = hasProgress
    ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))
    : 0;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col md:flex-row transform transition duration-300 hover:shadow-xl">
      <div className="relative w-full md:w-32 h-48 md:h-auto flex-shrink-0">
        <img
          src={book.coverUrl}
          alt={`Cover for ${book.title}`}
          className="w-full h-full object-cover object-center"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = 'https://placehold.co/128x192/475569/ffffff?text=No+Cover';
          }}
        />
        {/* Phase 05: Favorite toggle */}
        <button
          onClick={() => onToggleFavorite(book)}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm transition-colors"
          title={book.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart
            size={16}
            className={book.isFavorite ? 'text-red-500 fill-red-500' : 'text-gray-400'}
          />
        </button>
      </div>
      <div className="p-4 flex flex-col justify-between flex-grow">
        <div>
          <h3 className="text-xl font-bold text-gray-800 line-clamp-2">{book.title}</h3>
          <p className="text-sm text-gray-500 italic">by {book.author}</p>
          <p className="text-xs text-gray-400 mb-2">Genre: {book.genre || 'N/A'}</p>
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusDisplay.color}`}>
              {statusDisplay.label}
            </span>
            {/* Phase 05: Star rating */}
            <StarRating value={book.rating} onChange={(r) => onSetRating(book, r)} size={15} />
          </div>

          {/* Phase 05: Tag chips */}
          {book.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {book.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Phase 04: Progress bar */}
          {hasProgress && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>
                  {book.currentPage} / {book.totalPages} pages
                </span>
                <span className="font-semibold text-indigo-600">{progressPct}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progressPct >= 100
                      ? 'bg-green-500'
                      : progressPct > 50
                        ? 'bg-indigo-500'
                        : 'bg-indigo-400'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => onToggleStatus(book)}
            className="flex items-center justify-center p-2 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition duration-150 shadow-md"
            title="Toggle Status"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => onEdit(book)}
            className="flex items-center justify-center p-2 bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition duration-150 shadow-md"
            title="Edit Book"
          >
            <Edit size={18} />
          </button>
          {/* Phase 04: Log Session button */}
          <button
            onClick={() => onLogSession(book)}
            className="flex items-center justify-center p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition duration-150 shadow-md"
            title="Log Reading Session"
          >
            <BookMarked size={18} />
          </button>
          {/* Phase 05: Review / Notes / Quotes / Tags */}
          <button
            onClick={() => onOpenDetails(book)}
            className="flex items-center justify-center p-2 bg-teal-500 text-white rounded-full hover:bg-teal-600 transition duration-150 shadow-md"
            title="Review, Notes & Quotes"
          >
            <MessageSquare size={18} />
          </button>
          <button
            onClick={() => onGetInsights(book)}
            className="flex items-center justify-center p-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition duration-150 shadow-md"
            title="Get Book Insights (AI)"
          >
            <Zap size={18} />
          </button>
          <button
            onClick={() => onDelete(book)}
            className="flex items-center justify-center p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-150 shadow-md"
            title="Delete Book"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookCard;
