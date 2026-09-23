import React, { useContext, useState, useEffect, useCallback } from 'react';
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
  MessageCircle,
  CreditCard,
  Sparkles,
  Sun,
  Moon,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { getPinStatus } from '../services/diaryService';
import { getConversations } from '../services/messageService';
import NotificationBell from './NotificationBell';

// Diary lives on its own in the top bar (see JSX below) — everything else
// lives behind the hamburger, in the slide-out sidebar.
const SIDEBAR_ITEMS = [
  { to: '/', label: 'My Library', icon: Book },
  { to: '/shelves', label: 'Shelves', icon: Library },
  { to: '/dashboard', label: 'Dashboard', icon: Target },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/messages', label: 'Messages', icon: MessageCircle, badge: 'chat' },
  { to: '/profile', label: 'My Profile', icon: User },
  { to: '/billing', label: 'Billing', icon: CreditCard },
];

const ADMIN_ITEM = { to: '/admin', label: 'Admin Panel', icon: ShieldCheck };

const Navbar = () => {
  const { user } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  const { socket } = useSocket();
  const [diaryLocked, setDiaryLocked] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  // Standard-app pattern: the nav is hidden by default and only appears as a
  // slide-out sidebar when the hamburger is clicked — never shown inline.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    getPinStatus()
      .then(({ data }) => setDiaryLocked(data.diaryLockEnabled))
      .catch(() => {});
  }, [user]);

  // Chat: total unread count across every conversation, for the sidebar badge.
  // Refetched (not incrementally tracked) on any live chat event — same
  // "just refetch, don't hand-roll incremental state" approach NotificationBell
  // already uses for its own badge.
  const fetchChatUnread = useCallback(() => {
    if (!user) return;
    getConversations()
      .then(({ data }) => setChatUnread(data.reduce((sum, c) => sum + c.unreadCount, 0)))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetchChatUnread();
  }, [fetchChatUnread]);

  useEffect(() => {
    if (!socket) return;
    socket.on('chat:new', fetchChatUnread);
    socket.on('chat:read', fetchChatUnread);
    return () => {
      socket.off('chat:new', fetchChatUnread);
      socket.off('chat:read', fetchChatUnread);
    };
  }, [socket, fetchChatUnread]);

  // Close the sidebar with Escape, same as clicking the backdrop
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (e) => e.key === 'Escape' && setSidebarOpen(false);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  // Lock page scroll while the sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const getDiaryLinkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-full font-medium text-sm whitespace-nowrap flex items-center gap-1.5 transition-all ${
      isActive
        ? 'shadow-neu-inset text-primary font-bold'
        : 'text-on-surface-variant hover:text-on-surface shadow-neu'
    }`;

  const getSidebarLinkClass = ({ isActive }) =>
    `px-4 py-3 rounded-neu-lg font-medium text-sm flex items-center gap-3 w-full transition-all ${
      isActive
        ? 'shadow-neu-inset text-primary font-bold'
        : 'text-on-surface-variant hover:text-on-surface hover:shadow-neu-xs'
    }`;

  const sidebarItems = user?.role === 'admin' ? [...SIDEBAR_ITEMS, ADMIN_ITEM] : SIDEBAR_ITEMS;

  const initials = (user?.name || user?.email || 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 px-3 lg:px-8 pt-2 bg-neu-background">
        <div className="h-20 max-w-7xl mx-auto bg-surface-container-low rounded-neu-xl shadow-neu-lg px-3 sm:px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            {/* Hamburger — opens the sidebar, always */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 rounded-full bg-surface-container-low shadow-neu-xs hover:shadow-neu-inset-sm flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all shrink-0"
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
            >
              <Menu size={18} />
            </button>
            <BookOpen className="w-7 h-7 text-primary shrink-0" />
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <span className="font-display text-lg font-bold text-on-surface tracking-tight truncate">
                Library Tracker
              </span>
              {user?.isPro && (
                <span
                  className="px-2 py-0.5 rounded-full bg-surface-container text-secondary text-[11px] font-bold shadow-neu-inset-xs flex items-center gap-1 shrink-0"
                  title="Library Pro"
                >
                  <Sparkles size={11} /> Library Pro
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Diary stays in the top bar, per its own PIN-lock significance */}
            <NavLink to="/diary" className={getDiaryLinkClass}>
              <PenLine size={15} />
              <span className="hidden sm:inline">My Diary</span>
              {diaryLocked && <Lock size={11} className="text-tertiary" />}
            </NavLink>
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full bg-surface-container-low shadow-neu-xs hover:shadow-neu-inset-sm flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <NotificationBell />
            <NavLink
              to="/profile"
              className="hidden md:flex items-center gap-2 pl-2 rounded-full transition-all group"
              title="View profile"
            >
              <div className="relative shrink-0">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-cover shadow-neu-xs group-hover:shadow-neu-inset-sm transition-all"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container text-xs font-bold flex items-center justify-center shadow-neu-xs group-hover:shadow-neu-inset-sm transition-all">
                    {initials}
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-secondary ring-2 ring-surface-container-low" />
              </div>
              <div className="flex flex-col text-left leading-none">
                <span className="text-[11px] text-on-surface-variant">Welcome,</span>
                <span className="text-sm font-bold text-on-surface group-hover:text-primary truncate max-w-[8rem] transition-colors">
                  {user?.name || user?.email || 'User'}
                </span>
              </div>
            </NavLink>
          </div>
        </div>
      </header>

      {/* Backdrop */}
      <div
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Sidebar drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-surface-container-low shadow-neu-xl flex flex-col transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!sidebarOpen}
      >
        <div className="h-20 px-4 flex items-center justify-between shrink-0 border-b border-outline-variant/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="w-7 h-7 text-primary shrink-0" />
            <span className="font-display text-lg font-bold text-on-surface tracking-tight truncate">
              Library Tracker
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-9 h-9 rounded-full bg-surface-container-low shadow-neu-xs hover:shadow-neu-inset-sm flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all shrink-0"
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-1">
          {sidebarItems.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={getSidebarLinkClass}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {badge === 'chat' && chatUnread > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-neu-error text-on-neu-error text-[11px] font-bold flex items-center justify-center">
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-outline-variant/20 shrink-0">
          <NavLink
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2.5 rounded-neu-lg p-1.5 -m-1.5 hover:shadow-neu-inset-sm transition-all group"
          >
            <div className="relative shrink-0">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Profile"
                  className="w-9 h-9 rounded-full object-cover shadow-neu-xs"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container text-xs font-bold flex items-center justify-center shadow-neu-xs">
                  {initials}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-secondary ring-2 ring-surface-container-low" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-on-surface group-hover:text-primary truncate transition-colors">
                {user?.name || user?.email || 'User'}
              </p>
              {user?.isPro && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary">
                  <Sparkles size={10} /> Library Pro
                </span>
              )}
            </div>
          </NavLink>
        </div>
      </aside>
    </>
  );
};

export default Navbar;
