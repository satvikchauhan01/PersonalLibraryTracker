import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import Sentry, { initSentry } from './config/sentry.js'; // Phase 17
import ErrorFallback from './components/ErrorFallback';

initSentry();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* Phase 17: catches any render/lifecycle crash beneath it, reports it
        to Sentry, and shows ErrorFallback instead of an unmounted, blank
        white page — a no-op wrapper (renders children, catches nothing
        specially) when Sentry isn't initialized. */}
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <SocketProvider>
              <App />
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
