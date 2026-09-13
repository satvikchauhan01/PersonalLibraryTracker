import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, UserPlus, UserCheck, Clock, UserMinus } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import PresenceDot from '../components/PresenceDot';
import {
  searchUsers,
  getFriends,
  sendFriendRequest,
  acceptFriendRequest,
  unfriend,
} from '../services/friendService';

const Friends = () => {
  const { socket } = useSocket();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const fetchFriends = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getFriends();
      setFriends(data);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Phase 08: live presence — flip a friend's dot without a refresh
  useEffect(() => {
    if (!socket) return;
    const handlePresence = ({ userId, isOnline }) => {
      setFriends((prev) => prev.map((f) => (f._id === userId ? { ...f, isOnline } : f)));
    };
    socket.on('presence:update', handlePresence);
    return () => socket.off('presence:update', handlePresence);
  }, [socket]);

  const refreshSearch = useCallback(async () => {
    if (query.trim().length < 2) return;
    try {
      const { data } = await searchUsers(query.trim());
      setResults(data);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  }, [query]);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      await refreshSearch();
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Phase 08 fix: a friend_request/friend_accepted notification changes this
  // page's own data (the friends list, and a search result's relation label)
  // but nothing here was listening for it — the toast fired while the list
  // underneath it stayed stale until a manual reload. Refresh both live.
  useEffect(() => {
    if (!socket) return;
    const handleNotification = () => {
      fetchFriends();
      refreshSearch();
    };
    socket.on('notification:new', handleNotification);
    return () => socket.off('notification:new', handleNotification);
  }, [socket, fetchFriends, refreshSearch]);

  const handleSendRequest = async (userId) => {
    try {
      await sendFriendRequest(userId);
      setResults((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, relation: 'pending_sent' } : u))
      );
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  const handleAcceptFromSearch = async (user) => {
    try {
      await acceptFriendRequest(user.requestId);
      setResults((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, relation: 'friends' } : u))
      );
      fetchFriends();
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleUnfriend = async (userId) => {
    try {
      await unfriend(userId);
      setFriends((prev) => prev.filter((f) => f._id !== userId));
    } catch (error) {
      console.error('Error unfriending:', error);
    }
  };

  return (
    <>
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <Users className="text-indigo-600" /> Friends
      </h2>

      {/* Search */}
      <div className="relative mb-3 max-w-md">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find friends by name or email..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-full focus:ring-indigo-500 focus:border-indigo-500"
        />
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>

      {query.trim().length >= 2 && (
        <div className="mb-10 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y dark:divide-gray-700 max-w-md">
          {searching ? (
            <p className="px-4 py-4 text-sm text-gray-400">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-400">No users found.</p>
          ) : (
            results.map((u) => (
              <div key={u._id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {u.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                {u.relation === 'friends' && (
                  <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                    <UserCheck size={14} /> Friends
                  </span>
                )}
                {u.relation === 'pending_sent' && (
                  <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
                    <Clock size={14} /> Pending
                  </span>
                )}
                {u.relation === 'pending_received' && (
                  <button
                    onClick={() => handleAcceptFromSearch(u)}
                    className="text-xs font-medium px-3 py-1.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Accept
                  </button>
                )}
                {u.relation === 'none' && (
                  <button
                    onClick={() => handleSendRequest(u._id)}
                    className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900"
                  >
                    <UserPlus size={13} /> Add
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Friends list */}
      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
        My Friends <span className="text-base font-normal text-gray-400">({friends.length})</span>
      </h3>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : friends.length === 0 ? (
        <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-gray-400">
          No friends yet — search above to find people to connect with.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {friends.map((f) => (
            <div
              key={f._id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3"
            >
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold">
                  {f.name.charAt(0).toUpperCase()}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5">
                  <PresenceDot isOnline={f.isOnline} />
                </span>
              </div>
              <div className="min-w-0 flex-grow">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {f.name}
                </p>
                <p className="text-xs text-gray-400">{f.isOnline ? 'Online' : 'Offline'}</p>
              </div>
              <button
                onClick={() => handleUnfriend(f._id)}
                className="flex-shrink-0 text-gray-300 hover:text-red-500"
                title="Unfriend"
              >
                <UserMinus size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default Friends;
