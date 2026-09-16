import React from 'react';

// Phase 08: small online/offline indicator, meant to overlay an avatar corner.
// Neumorphic redesign: ring color matches whatever card surface it's sitting
// on (`ringClass` — the ring is really just "cut a notch out of the parent's
// bg", so it must match, not the dot itself), and online uses the secondary
// (sage) token rather than a raw green per Stitch's own presence dots.
const PresenceDot = ({ isOnline, size = 10, ringClass = 'ring-surface' }) => (
  <span
    className={`inline-block rounded-full ring-2 ${ringClass} ${
      isOnline ? 'bg-secondary shadow-[0_0_6px_rgba(55,103,88,0.7)]' : 'bg-outline-variant'
    }`}
    style={{ width: size, height: size }}
    title={isOnline ? 'Online' : 'Offline'}
  />
);

export default PresenceDot;
