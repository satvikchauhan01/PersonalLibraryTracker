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
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getPinStatus } from '../services/diaryService';
import NotificationBell from './NotificationBell';

const Navbar = () => {
  const { user } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  const [diaryLocked, setDiaryLocked] = useState(false);

  useEffect(() => {
    if (!user) return;
    getPinStatus()
      .then(({ data }) => setDiaryLocked(data.diaryLockEnabled))
      .catch(() => {});
  }, [user]);

  const getNavLinkClass = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium rounded-md flex items-center ${
      isActive
        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`;

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-transparent dark:border-gray-800 shadow-sm sticky top-0 z-10 transition-colors">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center">
            <BookOpen className="w-8 h-8 text-indigo-600 mr-2" />
          </h1>
          <nav className="flex space-x-2">
            <NavLink to="/" className={getNavLinkClass}>
              <Book size={16} className="inline mr-1" />
              My Library
            </NavLink>
            <NavLink to="/shelves" className={getNavLinkClass}>
              <Library size={16} className="inline mr-1" />
              Shelves
            </NavLink>
            <NavLink to="/dashboard" className={getNavLinkClass}>
              <Target size={16} className="inline mr-1" />
              Dashboard
            </NavLink>
            <NavLink to="/friends" className={getNavLinkClass}>
              <Users size={16} className="inline mr-1" />
              Friends
            </NavLink>
            <NavLink to="/diary" className={getNavLinkClass}>
              <PenLine size={16} className="inline mr-1" />
              My Diary
              {diaryLocked && <Lock size={11} className="inline ml-1 text-indigo-400" />}
            </NavLink>
            <NavLink to="/profile" className={getNavLinkClass}>
              <User size={16} className="inline mr-1" />
              My Profile
            </NavLink>
            <NavLink to="/billing" className={getNavLinkClass}>
              <CreditCard size={16} className="inline mr-1" />
              Billing
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <NotificationBell />
          <div className="text-sm font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
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
        </div>
      </div>
    </header>
  );
};

export default Navbar;
