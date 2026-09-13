import React from 'react';

// Phase 08: small online/offline indicator, meant to overlay an avatar corner.
const PresenceDot = ({ isOnline, size = 10 }) => (
  <span
    className={`inline-block rounded-full border-2 border-white dark:border-gray-800 ${
      isOnline ? 'bg-green-500' : 'bg-gray-300'
    }`}
    style={{ width: size, height: size }}
    title={isOnline ? 'Online' : 'Offline'}
  />
);

export default PresenceDot;
