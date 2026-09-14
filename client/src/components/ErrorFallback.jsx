import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

// Phase 17: rendered by Sentry.ErrorBoundary (see index.js) in place of a
// crashed subtree — a client crash reports to Sentry (via the ErrorBoundary
// itself) *and* the user sees this instead of a blank white screen.
const ErrorFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-4">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Something went wrong
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        This has been reported automatically. Reloading usually fixes it — your data is safe.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
      >
        <RotateCcw size={16} /> Reload the page
      </button>
    </div>
  </div>
);

export default ErrorFallback;
