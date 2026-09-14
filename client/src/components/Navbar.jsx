import React, { useContext, useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BookOpen,
  Book,
  User,
  PenLine,
  Lock,
  Library,
  Target,
  Users,
  CreditCard,
  Sparkles,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getPinStatus } from '../services/diaryService';
import NotificationBell from './NotificationBell';

const NAV_ITEMS = [
  { to: '/', label: 'My Library', icon: Book },
  { to: '/shelves', label: 'Shelves', icon: Library },
  { to: '/dashboard', label: 'Dashboard', icon: Target },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/diary', label: 'My Diary', icon: PenLine, lockable: true },
  { to: '/profile', label: 'My Profile', icon: User },
  { to: '/billing', label: 'Billing', icon: CreditCard },
];

const Navbar = () => {
  const { user } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  const [diaryLocked, setDiaryLocked] = useState(false);
  // Phase 13 responsive fix: the 7-item nav had no mobile treatment at all —
  // it simply overflowed the viewport width, forcing the entire page to
  // scroll horizontally on any screen narrower than ~1000px. Below `md:` the
  // links move into this collapsible panel instead.
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    getPinStatus()
      .then(({ data }) => setDiaryLocked(data.diaryLockEnabled))
      .catch(() => {});
  }, [user]);

  // Close the mobile panel on every route change (NavLink click)
  useEffect(() => {
    setMobileOpen(false);
  }, []);

  const getNavLinkClass = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium rounded-md flex items-center ${
      isActive
        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`;

  const getMobileNavLinkClass = ({ isActive }) =>
    `px-3 py-2.5 text-sm font-medium rounded-md flex items-center w-full ${
      isActive
        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`;

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-transparent dark:border-gray-800 shadow-sm sticky top-0 z-20 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4 flex justify-between items-center gap-2">
          <div className="flex items-center min-w-0">
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center flex-shrink-0">
              <BookOpen className="w-8 h-8 text-indigo-600 mr-2" />
            </h1>
            {/* Full horizontal nav — md and up only */}
            <nav className="hidden md:flex flex-wrap gap-x-1 gap-y-1 ml-4">
              {NAV_ITEMS.map(({ to, label, icon: Icon, lockable }) => (
                <NavLink key={to} to={to} className={getNavLinkClass}>
                  <Icon size={16} className="inline mr-1" />
                  {label}
                  {lockable && diaryLocked && (
                    <Lock size={11} className="inline ml-1 text-indigo-400" />
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <NotificationBell />
            <div className="hidden lg:flex text-sm font-medium text-gray-600 dark:text-gray-300 items-center gap-1.5">
              Welcome, {user?.name || user?.email || 'User'}
              {user?.isPro && (
                <span
                  className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-white"
                  title="Library Pro"
                >
                  <Sparkles size={11} /> PRO
                </span>
              )}
            </div>
            {/* Hamburger — below md only */}
            <button
              onClick={() => setMobileOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile nav panel */}
        {mobileOpen && (
          <nav className="md:hidden pb-4 flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, lockable }) => (
              <NavLink
                key={to}
                to={to}
                className={getMobileNavLinkClass}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={16} className="inline mr-2" />
                {label}
                {lockable && diaryLocked && (
                  <Lock size={11} className="inline ml-1.5 text-indigo-400" />
                )}
              </NavLink>
            ))}
            <div className="lg:hidden px-3 pt-2 text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5 border-t dark:border-gray-800 mt-1">
              Welcome, {user?.name || user?.email || 'User'}
              {user?.isPro && (
                <span
                  className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-white"
                  title="Library Pro"
                >
                  <Sparkles size={11} /> PRO
                </span>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Navbar;
