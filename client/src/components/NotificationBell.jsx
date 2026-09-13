import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Check, X, BookOpen, Target, Flame, CheckCheck } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import {
  getPendingRequests,
  acceptFriendRequest,
  declineFriendRequest,
} from '../services/friendService';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notificationService';
import Pagination from './Pagination'; // Phase 13

// Phase 11: icon + copy for each persisted notification type. Friend
// requests/accepts stay a separate concept (handled below) since they carry
// their own accept/decline actions rather than a plain read/unread state.
const NOTIF_ICONS = {
  reading_reminder: <BookOpen size={15} className="text-indigo-500" />,
  continue_reading: <BookOpen size={15} className="text-amber-500" />,
  goal_reminder: <Target size={15} className="text-purple-500" />,
  streak_milestone: <Flame size={15} className="text-orange-500" />,
};

const NOTIF_PAGE_SIZE = 8; // Phase 13: small enough that the dropdown's Prev/Next is meaningful

const NotificationBell = () => {
  const { socket } = useSocket();
  const [incoming, setIncoming] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPage, setNotifPage] = useState(1);
  const [notifTotalPages, setNotifTotalPages] = useState(1);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const menuRef = useRef(null);

  const fetchRequests = useCallback(async () => {
    try {
      const { data } = await getPendingRequests();
      setIncoming(data.incoming);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  }, []);

  const fetchNotifications = useCallback(async (page = 1) => {
    try {
      const { data } = await getNotifications({ page, limit: NOTIF_PAGE_SIZE });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setNotifTotalPages(data.totalPages);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Covers both the initial load (notifPage starts at 1) and page changes.
  useEffect(() => {
    fetchNotifications(notifPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifPage]);

  // Live badge/list update — refetch on any incoming socket notification,
  // plus a brief toast so the update is visible, not just the number changing.
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (payload) => {
      if (payload.type === 'friend_request' || payload.type === 'friend_accepted') {
        fetchRequests();
      } else if (notifPage === 1) {
        fetchNotifications(1);
      } else {
        // A new item landed ahead of the page being viewed — just refresh
        // the unread count, don't yank the user back to page 1.
        fetchNotifications(notifPage);
      }

      const id = Date.now();
      const message =
        payload.type === 'friend_request'
          ? `${payload.from.name} sent you a friend request`
          : payload.type === 'friend_accepted'
            ? `${payload.from.name} accepted your friend request`
            : payload.message || 'New notification';
      setToasts((prev) => [...prev, { id, message }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };

    socket.on('notification:new', handleNotification);
    return () => socket.off('notification:new', handleNotification);
  }, [socket, fetchRequests, fetchNotifications, notifPage]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAccept = async (requestId) => {
    try {
      await acceptFriendRequest(requestId);
      fetchRequests();
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleDecline = async (requestId) => {
    try {
      await declineFriendRequest(requestId);
      fetchRequests();
    } catch (error) {
      console.error('Error declining request:', error);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (notif.read) return;
    setNotifications((prev) => prev.map((n) => (n._id === notif._id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationRead(notif._id);
    } catch (error) {
      console.error('Error marking notification read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch (error) {
      console.error('Error marking all notifications read:', error);
    }
  };

  const badgeCount = incoming.length + unreadCount;

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="relative p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Notifications"
        >
          <Bell size={20} />
          {badgeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 z-20 max-h-[28rem] overflow-y-auto">
            <div className="px-4 py-3 border-b dark:border-gray-800 font-semibold text-sm text-gray-700 dark:text-gray-200">
              Friend Requests
            </div>
            {incoming.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400 text-center">No pending requests.</p>
            ) : (
              incoming.map((req) => (
                <div
                  key={req._id}
                  className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-800 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {req.from.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{req.from.email}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(req._id)}
                      className="p-1.5 rounded-full bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900"
                      title="Accept"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={() => handleDecline(req._id)}
                      className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-500"
                      title="Decline"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}

            <div className="px-4 py-3 border-b dark:border-gray-800 border-t dark:border-t-gray-800 flex items-center justify-between">
              <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">
                Notifications
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">You're all caught up.</p>
            ) : (
              <>
                {notifications.map((notif) => (
                  <button
                    key={notif._id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left flex items-start gap-2.5 px-4 py-3 border-b dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      notif.read
                        ? 'bg-white dark:bg-gray-900'
                        : 'bg-indigo-50/60 dark:bg-indigo-950/30'
                    }`}
                  >
                    <span className="mt-0.5 flex-shrink-0">
                      {NOTIF_ICONS[notif.type] || <Bell size={15} className="text-gray-400" />}
                    </span>
                    <span className="min-w-0">
                      <p
                        className={`text-sm ${notif.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100 font-medium'}`}
                      >
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(notif.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </span>
                    {!notif.read && (
                      <span className="ml-auto mt-1.5 w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
                <Pagination
                  page={notifPage}
                  totalPages={notifTotalPages}
                  onChange={setNotifPage}
                  size="sm"
                  className="py-3"
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg"
          >
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
};

export default NotificationBell;
