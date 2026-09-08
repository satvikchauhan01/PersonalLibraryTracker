import React, { useContext, useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, Book, User, PenLine, Lock } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { getPinStatus } from '../services/diaryService';

const Navbar = () => {
  const { user } = useContext(AuthContext);
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
        ? 'bg-indigo-100 text-indigo-700'
        : 'text-gray-500 hover:bg-gray-100'
    }`;

  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center">
            <BookOpen className="w-8 h-8 text-indigo-600 mr-2" />
          </h1>
          <nav className="flex space-x-2">
            <NavLink to="/" className={getNavLinkClass}>
              <Book size={16} className="inline mr-1" />
              My Library
            </NavLink>
            <NavLink to="/diary" className={getNavLinkClass}>
              <PenLine size={16} className="inline mr-1" />
              My Diary
              {diaryLocked && (
                <Lock size={11} className="inline ml-1 text-indigo-400" />
              )}
            </NavLink>
            <NavLink to="/profile" className={getNavLinkClass}>
              <User size={16} className="inline mr-1" />
              My Profile
            </NavLink>
          </nav>
        </div>
        
        <div className="text-sm font-medium text-gray-600">
           Welcome, {user?.name || user?.email || 'User'}
        </div>
      </div>
    </header>
  );
};

export default Navbar;

