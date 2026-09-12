import React, { useState } from 'react';
import { Star } from 'lucide-react';

// Phase 05: 5-star rating, half-star increments. With a mouse, click the left
// half of a star for X.5, the right half for X. Keyboard/screen-reader users
// get whole-star buttons (Tab between them, Enter/Space to set) — e.detail
// is 0 for a keyboard-triggered click, so that case skips the pointer-position
// math that would otherwise always resolve to "left half". Read-only when
// `onChange` is omitted.
const StarRating = ({ value = 0, onChange, size = 20 }) => {
  const [hover, setHover] = useState(null);
  const readOnly = !onChange;
  const display = hover !== null ? hover : value || 0;

  const resolveValue = (starIndex, e) => {
    if (e.detail === 0) return starIndex; // keyboard activation — no pointer position to read
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - left < width / 2;
    return isLeftHalf ? starIndex - 0.5 : starIndex;
  };

  const handleClick = (starIndex, e) => {
    if (readOnly) return;
    const newValue = resolveValue(starIndex, e);
    onChange(newValue === value ? null : newValue); // clicking the current value clears it
  };

  const handleMouseMove = (starIndex, e) => {
    if (readOnly) return;
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = e.clientX - left < width / 2;
    setHover(isLeftHalf ? starIndex - 0.5 : starIndex);
  };

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${readOnly ? '' : 'cursor-pointer'}`}
      onMouseLeave={() => setHover(null)}
      role={readOnly ? undefined : 'radiogroup'}
      aria-label={readOnly ? `Rated ${value ?? 0} out of 5 stars` : 'Star rating'}
    >
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const fillPct = Math.max(0, Math.min(1, display - (starIndex - 1))) * 100;
        const star = (
          <span
            className="relative inline-block pointer-events-none"
            style={{ width: size, height: size }}
          >
            <Star size={size} className="absolute inset-0 text-gray-300" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPct}%` }}>
              <Star size={size} className="text-amber-400 fill-amber-400" />
            </span>
          </span>
        );

        if (readOnly) {
          return <span key={starIndex}>{star}</span>;
        }

        return (
          <button
            key={starIndex}
            type="button"
            role="radio"
            aria-checked={value === starIndex}
            aria-label={`Rate ${starIndex} out of 5 stars`}
            className="p-0 border-0 bg-transparent leading-none"
            onClick={(e) => handleClick(starIndex, e)}
            onMouseMove={(e) => handleMouseMove(starIndex, e)}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;
