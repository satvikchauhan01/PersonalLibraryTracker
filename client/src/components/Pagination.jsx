import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Phase 13: one pagination control, reused everywhere a list is paged
// server-side (Library, the friend activity feed, the notification inbox)
// instead of each screen reinventing its own prev/next buttons.
// Neumorphic redesign ("Tactile Bibliotheca"): extruded pill buttons that
// press into an inset/debossed state instead of flattening to a filled bg.
const Pagination = ({ page, totalPages, onChange, size = 'md', className = '' }) => {
  if (totalPages <= 1) return null;

  const compact = size === 'sm';
  const btnClass = `inline-flex items-center rounded-full bg-surface shadow-neu hover:shadow-neu-inset active:shadow-neu-inset font-medium text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:hover:shadow-neu disabled:cursor-not-allowed transition-all ${
    compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
  }`;

  return (
    <div
      className={`flex items-center justify-center gap-3 ${compact ? 'gap-2' : 'gap-4'} ${className}`}
    >
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className={btnClass}
      >
        <ChevronLeft size={compact ? 13 : 16} className="mr-1" /> Prev
      </button>
      <span className={`text-on-surface-variant ${compact ? 'text-xs' : 'text-sm'}`}>
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className={btnClass}
      >
        Next <ChevronRight size={compact ? 13 : 16} className="ml-1" />
      </button>
    </div>
  );
};

export default Pagination;
