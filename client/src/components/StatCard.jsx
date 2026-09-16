import React from 'react';

// Neumorphic redesign ("Tactile Bibliotheca"): extruded convex card, icon in
// its own small extruded badge, lifts further on hover. `color` tints the
// icon badge; `valueColor`/`captionColor` default to plain ink but the
// Stitch mock deliberately colors the "Reading" card's whole stat (value +
// caption, not just the icon) to make it the visual hero of the row.
const StatCard = ({
  label,
  value,
  icon: Icon,
  color,
  caption,
  valueColor = 'text-on-surface',
  captionColor = 'text-on-surface-variant',
}) => (
  <div className="bg-surface rounded-neu-xl p-5 shadow-neu-lg hover:shadow-neu-lg-hover transition-all duration-300 flex flex-col justify-between">
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm font-medium text-on-surface-variant">{label}</p>
      <div
        className={`w-9 h-9 rounded-neu-lg bg-surface shadow-neu-sm flex items-center justify-center ${color}`}
      >
        <Icon size={20} />
      </div>
    </div>
    <div className="flex items-baseline gap-1.5">
      <p className={`font-display text-3xl font-bold leading-none ${valueColor}`}>{value}</p>
      {caption && <span className={`text-xs font-medium ${captionColor}`}>{caption}</span>}
    </div>
  </div>
);

export default StatCard;
