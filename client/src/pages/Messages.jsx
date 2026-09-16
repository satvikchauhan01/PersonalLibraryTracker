import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Send, MessageCircle, ArrowLeft, Users, Loader2, Check, CheckCheck } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import PresenceDot from '../components/PresenceDot';
import {
  getConversations,
  getMessages,
  sendMessage,
  markConversationRead,
} from '../services/messageService';

const TYPING_IDLE_MS = 2000; // how long with no keystrokes before we tell them typing stopped
const TYPING_AUTO_CLEAR_MS = 4000; // defensive: clear "typing…" if a stop event is ever lost

const formatTime = (dateStr) =>
  new Date(dateStr).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

const formatDayLabel = (dateStr) => {
  const d = new Date(dateStr);
  const today = new Date();
  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (isSameDay(d, today)) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
};

const initialsOf = (name) => (name || '?').charAt(0).toUpperCase();

// Neumorphic redesign ("Tactile Bibliotheca"): a rounded-square initials
// tile (not a circle) with a presence dot, matching Stitch's own chat
// avatars exactly. `size` controls both the tile and the corner radius.
const Avatar = ({ name, isOnline, size = 'md' }) => {
  const dims = size === 'sm' ? 'w-8 h-8 rounded-full text-xs' : 'w-11 h-11 rounded-neu-lg text-sm';
  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${dims} bg-surface-container shadow-neu-sm flex items-center justify-center font-bold text-primary`}
      >
        {initialsOf(name)}
      </div>
      {isOnline !== undefined && (
        <span className="absolute -bottom-0.5 -right-0.5">
          <PresenceDot isOnline={isOnline} size={12} ringClass="ring-surface-container-low" />
        </span>
      )}
    </div>
  );
};

const Messages = () => {
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);

  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);

  const typingIdleTimer = useRef(null);
  const typingClearTimer = useRef(null);
  const isTypingSent = useRef(false);
  const messagesEndRef = useRef(null);
  const messagesTopRef = useRef(null);

  // ── Conversations list ──────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await getConversations();
      setConversations(data);
      return data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Deep-link support: /messages?friend=<id>, e.g. from the "Message" button
  // on the Friends page. Waits for conversations to load since that's where
  // we get the friend's name/avatar/online-status from (it always includes
  // every friend, even ones with no messages yet — see the server route).
  useEffect(() => {
    const friendId = searchParams.get('friend');
    if (!friendId || conversationsLoading) return;
    const row = conversations.find((c) => c.friend._id === friendId);
    if (row) setSelectedFriend(row.friend);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, conversationsLoading]);

  // ── Selecting a conversation ─────────────────────────────────────────────
  const openConversation = (friend) => {
    setSelectedFriend(friend);
    setSearchParams({ friend: friend._id });
    setFriendTyping(false);
  };

  const closeConversation = () => {
    setSelectedFriend(null);
    setSearchParams({});
  };

  const fetchMessages = useCallback(async (friendId, targetPage) => {
    const { data } = await getMessages(friendId, targetPage);
    return data;
  }, []);

  useEffect(() => {
    if (!selectedFriend) return;
    setMessagesLoading(true);
    setMessages([]);
    setPage(1);
    fetchMessages(selectedFriend._id, 1)
      .then((data) => {
        setMessages(data.messages);
        setHasMore(data.page < data.totalPages);
      })
      .catch((error) => console.error('Error fetching messages:', error))
      .finally(() => setMessagesLoading(false));

    // Opening a conversation marks it read server-side — reflect that locally
    // so the sidebar badge clears without waiting for a socket round-trip.
    setConversations((prev) =>
      prev.map((c) => (c.friend._id === selectedFriend._id ? { ...c, unreadCount: 0 } : c))
    );
  }, [selectedFriend, fetchMessages]);

  const handleLoadOlder = async () => {
    if (!selectedFriend || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await fetchMessages(selectedFriend._id, nextPage);
      setMessages((prev) => [...data.messages, ...prev]);
      setPage(nextPage);
      setHasMore(nextPage < data.totalPages);
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Scroll to the newest message whenever the thread grows from a new send
  // or a live incoming message — not on "load older" (that would yank the
  // view away from what was just revealed).
  const prevMessageCount = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    prevMessageCount.current = messages.length;
  }, [messages]);

  // ── Live updates ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      // Always keep the conversation list current, regardless of which
      // thread (if any) is open right now.
      setConversations((prev) => {
        const otherId = msg.from === user._id ? msg.to : msg.from;
        const idx = prev.findIndex((c) => c.friend._id === otherId);
        if (idx === -1) return prev; // a friend row always exists once fetched; ignore otherwise
        const isOpenThread = selectedFriend?._id === otherId;
        const updated = {
          ...prev[idx],
          lastMessage: { text: msg.text, createdAt: msg.createdAt, fromMe: msg.from === user._id },
          unreadCount:
            msg.from === user._id || isOpenThread
              ? prev[idx].unreadCount
              : prev[idx].unreadCount + 1,
        };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest];
      });

      // Append to the open thread if this message belongs to it. Dedupe by
      // _id — the sender's own POST response already added their own
      // message locally, and this socket echo (sent to the sender's own
      // room too, for multi-tab sync) would otherwise double it up.
      const otherId = msg.from === user._id ? msg.to : msg.from;
      if (selectedFriend && otherId === selectedFriend._id) {
        setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));

        // Bug fix: a message delivered live while its thread is already
        // open used to just sit in the DB as unread — nothing had called
        // GET /messages/:friendId (the only thing that marked it read)
        // since the thread was already open before this message existed.
        // That made the unread badge resurrect the "unread" count as soon
        // as the user navigated away and the sidebar/Navbar refetched,
        // even though they'd already seen it arrive. Tell the server
        // explicitly instead of pretending a read GET happened.
        if (msg.from !== user._id) {
          markConversationRead(otherId).catch(() => {});
        }
      }
    };

    const handleRead = ({ by, messageIds }) => {
      if (!selectedFriend || by !== selectedFriend._id) return;
      const idSet = new Set(messageIds.map(String));
      setMessages((prev) => prev.map((m) => (idSet.has(String(m._id)) ? { ...m, read: true } : m)));
    };

    const handleTyping = ({ from, isTyping }) => {
      if (!selectedFriend || from !== selectedFriend._id) return;
      setFriendTyping(isTyping);
      if (typingClearTimer.current) clearTimeout(typingClearTimer.current);
      if (isTyping) {
        typingClearTimer.current = setTimeout(() => setFriendTyping(false), TYPING_AUTO_CLEAR_MS);
      }
    };

    const handlePresence = ({ userId, isOnline }) => {
      setConversations((prev) =>
        prev.map((c) => (c.friend._id === userId ? { ...c, friend: { ...c.friend, isOnline } } : c))
      );
      setSelectedFriend((prev) => (prev && prev._id === userId ? { ...prev, isOnline } : prev));
    };

    socket.on('chat:new', handleNewMessage);
    socket.on('chat:read', handleRead);
    socket.on('chat:typing', handleTyping);
    socket.on('presence:update', handlePresence);
    return () => {
      socket.off('chat:new', handleNewMessage);
      socket.off('chat:read', handleRead);
      socket.off('chat:typing', handleTyping);
      socket.off('presence:update', handlePresence);
    };
  }, [socket, selectedFriend, user._id]);

  // ── Typing indicator (outgoing) ──────────────────────────────────────────
  const stopTyping = useCallback(() => {
    if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
    if (isTypingSent.current && socket && selectedFriend) {
      socket.emit('chat:typing', { to: selectedFriend._id, isTyping: false });
    }
    isTypingSent.current = false;
  }, [socket, selectedFriend]);

  const handleDraftChange = (e) => {
    setDraft(e.target.value);
    if (!socket || !selectedFriend) return;
    if (!isTypingSent.current) {
      socket.emit('chat:typing', { to: selectedFriend._id, isTyping: true });
      isTypingSent.current = true;
    }
    if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
    typingIdleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  // Stop signaling "typing" when the conversation changes or the page unmounts
  useEffect(() => stopTyping, [selectedFriend]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sending ──────────────────────────────────────────────────────────────
  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !selectedFriend || sending) return;

    stopTyping();
    setSending(true);
    setDraft('');
    try {
      const { data } = await sendMessage(selectedFriend._id, text);
      setMessages((prev) => (prev.some((m) => m._id === data._id) ? prev : [...prev, data]));
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.friend._id === selectedFriend._id);
        if (idx === -1) return prev;
        const updated = {
          ...prev[idx],
          lastMessage: { text: data.text, createdAt: data.createdAt, fromMe: true },
        };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest];
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setDraft(text); // give the text back so nothing typed is lost
    } finally {
      setSending(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const lastMine = [...messages].reverse().find((m) => m.from === user._id);
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="h-[calc(100vh-9rem)] min-h-[36rem] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="w-11 h-11 rounded-neu-lg bg-surface-container-low shadow-neu-md flex items-center justify-center text-primary shrink-0">
          <MessageCircle size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-xl text-on-surface font-bold">Messages</span>
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs shadow-neu-inset-xs">
                {totalUnread} Unread
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── Conversation list ── */}
        <aside
          className={`${selectedFriend ? 'hidden lg:flex' : 'flex'} lg:col-span-5 xl:col-span-4 flex-col min-h-0 bg-surface-container-low rounded-neu-xl shadow-neu-xl p-3`}
        >
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
            {conversationsLoading ? (
              <div className="flex items-center justify-center flex-1 text-on-surface-variant">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-on-surface-variant flex flex-col items-center gap-3">
                <Users size={28} className="text-outline" />
                No friends yet.
                <Link to="/friends" className="text-primary hover:underline font-semibold">
                  Find friends to message
                </Link>
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = selectedFriend?._id === c.friend._id;
                return (
                  <button
                    key={c.friend._id}
                    onClick={() => openConversation(c.friend)}
                    className={`flex items-start gap-3 p-3 rounded-neu-lg text-left transition-all ${
                      isActive
                        ? 'shadow-neu-inset bg-surface-container-low'
                        : 'shadow-neu hover:shadow-neu-inset'
                    }`}
                  >
                    <Avatar name={c.friend.name} isOnline={c.friend.isOnline} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-on-surface truncate">
                          {c.friend.name || 'Unnamed user'}
                        </p>
                        {c.lastMessage && (
                          <span className="text-[11px] text-on-surface-variant flex-shrink-0">
                            {formatTime(c.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant truncate">
                        {c.lastMessage
                          ? `${c.lastMessage.fromMe ? 'You: ' : ''}${c.lastMessage.text}`
                          : 'Say hello 👋'}
                      </p>
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center">
                        {c.unreadCount > 9 ? '9+' : c.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Active thread ── */}
        <div
          className={`${selectedFriend ? 'flex' : 'hidden lg:flex'} lg:col-span-7 xl:col-span-8 flex-col min-h-0 bg-surface-container-low rounded-neu-xl shadow-neu-xl p-4 lg:p-5`}
        >
          {!selectedFriend ? (
            <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant gap-2">
              <MessageCircle size={32} className="text-outline" />
              Pick a conversation to start chatting.
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/20 flex-shrink-0">
                <button
                  onClick={closeConversation}
                  className="lg:hidden w-8 h-8 rounded-full bg-surface-container-low shadow-neu-xs flex items-center justify-center text-on-surface-variant"
                >
                  <ArrowLeft size={16} />
                </button>
                <Avatar name={selectedFriend.name} isOnline={selectedFriend.isOnline} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">
                    {selectedFriend.name || 'Unnamed user'}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {friendTyping ? (
                      <span className="text-primary">typing…</span>
                    ) : selectedFriend.isOnline ? (
                      <span className="text-secondary">Online</span>
                    ) : (
                      'Offline'
                    )}
                  </p>
                </div>
              </div>

              {/* Message list */}
              <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-3" ref={messagesTopRef}>
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full text-on-surface-variant">
                    <Loader2 size={22} className="animate-spin" />
                  </div>
                ) : (
                  <>
                    {hasMore && (
                      <div className="flex justify-center mb-3">
                        <button
                          onClick={handleLoadOlder}
                          disabled={loadingMore}
                          className="text-xs text-primary hover:underline disabled:opacity-50 font-semibold"
                        >
                          {loadingMore ? 'Loading…' : 'Load earlier messages'}
                        </button>
                      </div>
                    )}
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-sm text-on-surface-variant">
                        No messages yet — say hello 👋
                      </div>
                    ) : (
                      messages.map((m, i) => {
                        const mine = m.from === user._id;
                        const prev = messages[i - 1];
                        const showDayLabel =
                          !prev || formatDayLabel(prev.createdAt) !== formatDayLabel(m.createdAt);
                        return (
                          <React.Fragment key={m._id}>
                            {showDayLabel && (
                              <div className="flex justify-center my-3">
                                <span className="text-[11px] font-medium text-on-surface-variant bg-surface-container px-3 py-1 rounded-full shadow-neu-inset-xs">
                                  {formatDayLabel(m.createdAt)}
                                </span>
                              </div>
                            )}
                            <div
                              className={`flex items-start gap-2 max-w-[85%] sm:max-w-[70%] ${mine ? 'ml-auto flex-row-reverse' : ''}`}
                            >
                              <div className="w-7 h-7 rounded-full bg-surface-container shadow-neu-xs flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                                {initialsOf(mine ? user.name : selectedFriend.name)}
                              </div>
                              <div
                                className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}
                              >
                                <div
                                  className={`px-3.5 py-2 text-sm break-words leading-relaxed ${
                                    mine
                                      ? 'rounded-2xl rounded-tr-sm bg-primary text-on-primary shadow-neu-sm'
                                      : 'rounded-2xl rounded-tl-sm bg-surface-container-low text-on-surface shadow-neu'
                                  }`}
                                >
                                  {m.text}
                                </div>
                                <span className="text-[10px] text-on-surface-variant px-1">
                                  {formatTime(m.createdAt)}
                                </span>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })
                    )}
                    {lastMine && (
                      <div className="flex justify-end pr-1">
                        <span className="text-[10px] text-on-surface-variant flex items-center gap-0.5 mt-0.5">
                          {lastMine.read ? (
                            <>
                              <CheckCheck size={12} className="text-primary" /> Seen
                            </>
                          ) : (
                            <>
                              <Check size={12} /> Sent
                            </>
                          )}
                        </span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Composer */}
              <form
                onSubmit={handleSend}
                className="flex items-center gap-2 pt-3 border-t border-outline-variant/20 flex-shrink-0"
              >
                <input
                  type="text"
                  value={draft}
                  onChange={handleDraftChange}
                  placeholder="Type a message…"
                  maxLength={2000}
                  className="flex-1 rounded-full border-none bg-surface-container-low text-sm text-on-surface placeholder:text-outline shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 px-4 py-3 transition-all"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="flex-shrink-0 w-12 h-12 rounded-neu-lg bg-primary text-on-primary shadow-neu-md hover:shadow-neu-sm active:shadow-neu-inset disabled:opacity-50 flex items-center justify-center transition-all"
                >
                  {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
