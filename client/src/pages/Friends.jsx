import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, UserPlus, UserCheck, Clock, UserMinus, MessageCircle } from 'lucide-react';
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

  const onlineCount = friends.filter((f) => f.isOnline).length;

  const initials = (name) =>
    (name || '?')
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <>
      {/* Screen title */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
          <span className="text-xs uppercase tracking-widest text-secondary font-semibold">
            Sanctuary Fellowship
          </span>
        </div>
        <h1 className="font-display text-3xl font-bold text-on-surface tracking-tight flex items-center gap-2">
          <Users className="text-primary" /> Curator Circle &amp; Fellow Readers
        </h1>
        <p className="text-sm text-on-surface-variant max-w-2xl mt-1">
          Connect with fellow readers, keep tabs on who's online, and jump straight into a
          conversation.
        </p>
      </div>

      {/* Quick stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 max-w-lg">
        <div className="p-4 rounded-neu-xl bg-surface-container-low shadow-neu-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-on-surface-variant font-medium">My Friends</span>
            <div className="font-display text-3xl text-on-surface font-bold">{friends.length}</div>
          </div>
          <div className="w-11 h-11 rounded-neu-lg bg-surface-container flex items-center justify-center shadow-neu-inset-sm text-primary">
            <Users size={20} />
          </div>
        </div>
        <div className="p-4 rounded-neu-xl bg-surface-container-low shadow-neu-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-on-surface-variant font-medium">Online Now</span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-3xl text-secondary font-bold">{onlineCount}</span>
              <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(55,103,88,0.8)] animate-pulse" />
            </div>
          </div>
          <div className="w-11 h-11 rounded-neu-lg bg-surface-container flex items-center justify-center shadow-neu-inset-sm text-secondary">
            <UserCheck size={20} />
          </div>
        </div>
      </div>

      {/* Search & filter bar */}
      <div className="p-4 lg:p-5 rounded-neu-xl bg-surface-container-low shadow-neu-lg mb-8 max-w-md">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find friends by name or email..."
            className="w-full pl-11 pr-4 py-3 rounded-full bg-surface-container border-none text-sm text-on-surface placeholder:text-on-surface-variant shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 transition-all"
          />
        </div>

        {query.trim().length >= 2 && (
          <div className="mt-3 space-y-2">
            {searching ? (
              <p className="text-sm text-on-surface-variant px-1 py-2">Searching…</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-on-surface-variant px-1 py-2">No users found.</p>
            ) : (
              results.map((u) => (
                <div
                  key={u._id}
                  className="p-3 rounded-neu-lg bg-surface-container shadow-neu-inset-sm flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container text-xs font-bold flex items-center justify-center shrink-0 shadow-neu-xs">
                      {initials(u.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">
                        {u.name || 'Unnamed user'}
                      </p>
                      <p className="text-xs text-on-surface-variant truncate">{u.email}</p>
                    </div>
                  </div>
                  {u.relation === 'friends' && (
                    <span className="text-xs font-semibold text-secondary flex items-center gap-1 shrink-0">
                      <UserCheck size={14} /> Friends
                    </span>
                  )}
                  {u.relation === 'pending_sent' && (
                    <span className="text-xs font-semibold text-on-surface-variant flex items-center gap-1 shrink-0">
                      <Clock size={14} /> Pending
                    </span>
                  )}
                  {u.relation === 'pending_received' && (
                    <button
                      onClick={() => handleAcceptFromSearch(u)}
                      className="text-xs font-bold px-3.5 py-1.5 rounded-full bg-primary text-on-primary shadow-neu-sm hover:shadow-neu-xs active:shadow-neu-inset transition-all shrink-0"
                    >
                      Accept
                    </button>
                  )}
                  {u.relation === 'none' && (
                    <button
                      onClick={() => handleSendRequest(u._id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-3.5 py-1.5 rounded-full bg-surface-container-low text-primary shadow-neu-xs hover:shadow-neu-inset-sm transition-all shrink-0"
                    >
                      <UserPlus size={13} /> Add
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Friends list */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-xl font-bold text-on-surface">My Curators Circle</h2>
        <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs shadow-neu-inset-xs">
          {friends.length} Reader{friends.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading…</p>
      ) : friends.length === 0 ? (
        <div className="text-center py-10 bg-surface rounded-neu-xl shadow-neu-lg text-on-surface-variant">
          No friends yet — search above to find people to connect with.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {friends.map((f) => (
            <div
              key={f._id}
              className="p-4 rounded-neu-xl bg-surface-container-low shadow-neu-lg hover:shadow-neu-lg-hover hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  {f.avatarUrl ? (
                    <img
                      src={f.avatarUrl}
                      alt={f.name}
                      className="w-12 h-12 rounded-neu-lg object-cover shadow-neu-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-neu-lg bg-primary-container text-on-primary-container flex items-center justify-center font-bold shadow-neu-sm">
                      {initials(f.name)}
                    </div>
                  )}
                  <span className="absolute -top-1 -right-1">
                    <PresenceDot
                      isOnline={f.isOnline}
                      size={14}
                      ringClass="ring-surface-container-low"
                    />
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">
                    {f.name || 'Unnamed user'}
                  </p>
                  <p
                    className={`text-xs font-medium flex items-center gap-1 ${f.isOnline ? 'text-secondary' : 'text-on-surface-variant'}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${f.isOnline ? 'bg-secondary' : 'bg-outline-variant'}`}
                    />
                    {f.isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Link
                  to={`/messages?friend=${f._id}`}
                  className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-primary shadow-neu-xs hover:shadow-neu-inset-sm transition-all"
                  title="Message"
                >
                  <MessageCircle size={15} />
                </Link>
                <button
                  onClick={() => handleUnfriend(f._id)}
                  className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-neu-error shadow-neu-xs hover:shadow-neu-inset-sm transition-all"
                  title="Unfriend"
                >
                  <UserMinus size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default Friends;
