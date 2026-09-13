import React, { useState, useEffect, useCallback } from 'react';
import { BookPlus, CheckCircle2, Star, Flame, Users, Sparkles } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { getActivityFeed } from '../services/activityService';
import Pagination from './Pagination'; // Phase 13

const EVENT_ICON = {
  book_added: { icon: BookPlus, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/50' },
  book_completed: { icon: CheckCircle2, color: 'text-green-500 bg-green-50 dark:bg-green-950/50' },
  book_rated: { icon: Star, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/50' },
  reading_streak: { icon: Flame, color: 'text-orange-500 bg-orange-50 dark:bg-orange-950/50' },
};

const describeEvent = (event) => {
  const name = event.user?.name || 'Someone';
  switch (event.type) {
    case 'book_added':
      return `${name} added "${event.book?.title || 'a book'}" to their library`;
    case 'book_completed':
      return `${name} finished reading "${event.book?.title || 'a book'}"`;
    case 'book_rated':
      return `${name} rated "${event.book?.title || 'a book'}" ${event.metadata?.rating}★`;
    case 'reading_streak':
      return `${name} hit a ${event.metadata?.streakDays}-day reading streak 🔥`;
    default:
      return `${name} did something`;
  }
};

const timeAgo = (dateStr) => {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const ActivityFeed = () => {
  const { socket } = useSocket();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1); // Phase 13: standardized pagination
  const [totalPages, setTotalPages] = useState(1);

  const fetchFeed = useCallback(async (targetPage) => {
    setLoading(true);
    try {
      const { data } = await getActivityFeed(targetPage);
      setEvents(data.events);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Error fetching activity feed:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFeed(page);
  }, [fetchFeed, page]);

  // Phase 08: prepend live events as they arrive — only on page 1, where
  // "newest first" actually means the top of what's currently shown.
  useEffect(() => {
    if (!socket) return;
    const handleNewActivity = (event) => {
      if (page !== 1) return;
      setEvents((prev) => [event, ...prev].slice(0, 20));
    };
    socket.on('activity:new', handleNewActivity);
    return () => socket.off('activity:new', handleNewActivity);
  }, [socket, page]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
      <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-4">
        <Users size={16} className="text-indigo-500" /> Friend Activity
      </h3>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          Nothing yet — add friends to see their reading activity here.
        </p>
      ) : (
        <ul className="space-y-3 max-h-80 overflow-y-auto">
          {events.map((event) => {
            const { icon: Icon, color } = EVENT_ICON[event.type] || EVENT_ICON.book_added;
            return (
              <li key={event._id} className="flex items-start gap-3">
                <span className={`flex-shrink-0 p-1.5 rounded-full ${color}`}>
                  <Icon size={14} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{describeEvent(event)}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    {timeAgo(event.createdAt)}
                    {event.user?.isPro && (
                      <span className="inline-flex items-center text-amber-500" title="Library Pro">
                        <Sparkles size={10} />
                      </span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={setPage}
        size="sm"
        className="mt-4"
      />
    </div>
  );
};

export default ActivityFeed;
