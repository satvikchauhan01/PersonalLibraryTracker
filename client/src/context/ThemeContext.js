import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

const STORAGE_KEY = 'theme'; // 'light' | 'dark'

// Phase 13: resolves the starting theme — a previously saved explicit choice
// wins, otherwise fall back to the OS preference so a first-time visitor
// gets a sensible default without having to find the toggle.
const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // localStorage can throw in some contexts (private mode, etc.) — fall through
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // non-fatal — theme just won't persist across reloads in this browser
    }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
