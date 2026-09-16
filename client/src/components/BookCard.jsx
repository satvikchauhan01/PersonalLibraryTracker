import React from 'react';
import { Settings, Edit, Trash2, Zap, BookMarked, Heart, MessageSquare } from 'lucide-react';
import StarRating from './StarRating';

// Neumorphic redesign ("Tactile Bibliotheca"), matched line-for-line against
// Stitch's own generated markup: status reads as a small dot + bold
// uppercase label (not a solid pill), and — deliberately, per the mock —
// Reading breaks from the primary/secondary/tertiary token set to use raw
// amber, matching the "amber glow" callout in Stitch's own comments.
const STATUS_MAP = {
  wantToRead: { label: 'Want to Read', text: 'text-primary', dot: 'bg-primary' },
  reading: {
    label: 'Reading',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  completed: { label: 'Completed', text: 'text-secondary', dot: 'bg-secondary' },
  dnf: { label: 'DNF', text: 'text-neu-error', dot: 'bg-neu-error' },
  onHold: { label: 'On Hold', text: 'text-on-surface-variant', dot: 'bg-outline' },
  // Legacy aliases (survive until all docs migrated)
  toRead: { label: 'Want to Read', text: 'text-primary', dot: 'bg-primary' },
  currentlyReading: {
    label: 'Reading',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
};

// The 6 action buttons deliberately don't each get their own unique hue —
// the design system leans on color restraint (see UI_CONTEXT's "AI-powered
// elements" callout for the one accent that *is* semantically meaningful:
// purple/tertiary marks AI). Only Toggle Status/Log Session/AI/Delete carry
// color; Edit and Review stay neutral.
const ACTIONS = [
  { key: 'status', icon: Settings, title: 'Toggle Status', color: 'hover:text-primary' },
  { key: 'edit', icon: Edit, title: 'Edit Book', color: 'hover:text-primary' },
  { key: 'session', icon: BookMarked, title: 'Log Reading Session', color: 'hover:text-secondary' },
  {
    key: 'details',
    icon: MessageSquare,
    title: 'Review, Notes & Quotes',
    color: 'hover:text-primary',
  },
  { key: 'insights', icon: Zap, title: 'Get Book Insights (AI)', color: 'hover:text-tertiary' },
  { key: 'delete', icon: Trash2, title: 'Delete Book', color: 'hover:text-neu-error' },
];

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
    text: 'text-on-surface-variant',
    dot: 'bg-outline',
  };

  // Progress bar calculation
  const hasProgress = book.totalPages > 0;
  const progressPct = hasProgress
    ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))
    : 0;

  const handlers = {
    status: () => onToggleStatus(book),
    edit: () => onEdit(book),
    session: () => onLogSession(book),
    details: () => onOpenDetails(book),
    insights: () => onGetInsights(book),
    delete: () => onDelete(book),
  };

  return (
    <article className="bg-surface rounded-neu-xl p-4 lg:p-6 shadow-neu-xl hover:shadow-neu-xl-hover transition-all duration-300 flex flex-col md:flex-row items-start md:items-center gap-4">
      {/* Recessed "archival niche" frame around the cover art */}
      <div className="relative w-28 sm:w-32 md:w-36 aspect-[2/3] rounded-neu-lg bg-surface-container-low p-1.5 shadow-neu-inset shrink-0">
        <img
          src={book.coverUrl}
          alt={`Cover for ${book.title}`}
          className="w-full h-full object-cover object-center rounded-neu shadow-sm"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = 'https://placehold.co/288x432/475569/ffffff?text=No+Cover';
          }}
        />
      </div>

      {/* Book details & meta */}
      <div className="flex-1 min-w-0 space-y-1.5 w-full">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status: small dot + bold uppercase label, not a solid pill */}
          <span
            className={`px-2 py-1 rounded-full bg-surface shadow-neu-xs text-[0.6875rem] font-bold tracking-wide flex items-center gap-1.5 ${statusDisplay.text}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusDisplay.dot}`} />
            {statusDisplay.label.toUpperCase()}
          </span>
          {book.genre && (
            <span className="px-2 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant text-xs shadow-neu-inset-xs">
              {book.genre}
            </span>
          )}
        </div>

        <div>
          <h3 className="font-display text-xl font-bold text-on-surface truncate">{book.title}</h3>
          <p className="text-sm text-on-surface-variant italic">by {book.author}</p>
        </div>

        {/* Rating & stars */}
        <div className="flex items-center gap-2 pt-0.5">
          <StarRating value={book.rating} onChange={(r) => onSetRating(book, r)} size={18} />
          {book.rating > 0 && (
            <span className="text-xs font-bold text-on-surface">{book.rating.toFixed(1)}</span>
          )}
        </div>

        {/* Tag chips — small extruded "stamped" pills */}
        {book.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {book.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-medium text-secondary bg-surface shadow-neu-xs px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Progress bar — embossed channel, sage→indigo fill */}
        {hasProgress && (
          <div className="space-y-1.5 pt-1 w-full max-w-xl">
            <div className="flex justify-between text-xs text-on-surface-variant">
              <span
                className={`font-semibold ${progressPct >= 100 ? 'text-secondary' : 'text-primary'}`}
              >
                {progressPct}% completed
              </span>
              <span>
                {book.currentPage} / {book.totalPages} pages
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-surface shadow-neu-inset-sm overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full shadow-sm transition-all duration-500 ${
                  progressPct >= 100
                    ? 'bg-secondary'
                    : 'bg-gradient-to-r from-secondary to-primary-container'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action column: favorite + 6 mini circular action buttons */}
      <div className="flex md:flex-col items-center justify-between md:justify-center gap-3 shrink-0 w-full md:w-auto pt-2 md:pt-0">
        <button
          onClick={() => onToggleFavorite(book)}
          className="w-10 h-10 rounded-full bg-surface shadow-neu-sm hover:shadow-neu-inset-sm flex items-center justify-center transition-all"
          title={book.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart
            size={18}
            className={
              book.isFavorite ? 'text-neu-error fill-neu-error' : 'text-on-surface-variant'
            }
          />
        </button>
        <div className="grid grid-cols-6 md:grid-cols-3 gap-1.5">
          {ACTIONS.map(({ key, icon: Icon, title, color }) => (
            <button
              key={key}
              onClick={handlers[key]}
              className={`w-8 h-8 rounded-full bg-surface shadow-neu-xs hover:shadow-neu-inset-sm flex items-center justify-center text-on-surface-variant transition-all ${color}`}
              title={title}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>
    </article>
  );
};

export default BookCard;
