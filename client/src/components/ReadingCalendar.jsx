import React, { useState, useEffect, useCallback } from 'react';
import { getStreak, getCalendar } from '../services/readingService';
import { Flame, TrendingUp, Calendar } from 'lucide-react';

// Generate the last N days as YYYY-MM-DD strings in local time
const buildDateRange = (days = 365) => {
  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const localStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    result.push(localStr);
  }
  return result;
};

// Color intensity based on pages read
const getColor = (pages) => {
  if (!pages || pages === 0) return 'bg-gray-100';
  if (pages < 20) return 'bg-emerald-200';
  if (pages < 50) return 'bg-emerald-400';
  if (pages < 100) return 'bg-emerald-600';
  return 'bg-emerald-800';
};

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ReadingCalendar = ({ refreshTrigger }) => {
  const [calendar, setCalendar] = useState({});
  const [streakData, setStreakData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState(null); // { date, pages, x, y }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [calRes, streakRes] = await Promise.all([getCalendar(), getStreak()]);
      setCalendar(calRes.data);
      setStreakData(streakRes.data);
    } catch {
      // silently fail — feature is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const dates = buildDateRange(365);

  // Pad the start so week rows align correctly (week starts Sunday)
  const firstDate = new Date(dates[0]);
  const startPadding = firstDate.getDay(); // 0=Sun … 6=Sat
  const cells = [...Array(startPadding).fill(null), ...dates];

  // Build 52-column grid (cols = weeks)
  const numCols = Math.ceil(cells.length / 7);

  // Build month label positions
  const monthLabels = [];
  let lastMonth = -1;
  dates.forEach((d, idx) => {
    const month = new Date(d).getMonth();
    const col = Math.floor((startPadding + idx) / 7);
    if (month !== lastMonth) {
      monthLabels.push({ month, col });
      lastMonth = month;
    }
  });

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-48 mb-4" />
        <div className="h-32 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-6 mb-5">
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-800">Reading Activity</h3>
        </div>
        {streakData && (
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 bg-orange-50 rounded-xl px-3 py-1.5">
              <Flame size={16} className="text-orange-500" />
              <span className="text-sm font-bold text-orange-700">{streakData.streak}</span>
              <span className="text-xs text-orange-500">day streak</span>
            </div>
            <div className="flex items-center gap-1.5 bg-purple-50 rounded-xl px-3 py-1.5">
              <TrendingUp size={16} className="text-purple-500" />
              <span className="text-sm font-bold text-purple-700">{streakData.longestStreak}</span>
              <span className="text-xs text-purple-500">best streak</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 rounded-xl px-3 py-1.5">
              <span className="text-sm font-bold text-emerald-700">
                {streakData.totalPages.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-500">pages this year</span>
            </div>
            <div className="flex items-center gap-1.5 bg-blue-50 rounded-xl px-3 py-1.5">
              <span className="text-sm font-bold text-blue-700">{streakData.totalSessions}</span>
              <span className="text-xs text-blue-500">sessions</span>
            </div>
          </div>
        )}
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-max">
          {/* Month labels */}
          <div className="flex mb-1 ml-8">
            {Array.from({ length: numCols }, (_, colIdx) => {
              const label = monthLabels.find((m) => m.col === colIdx);
              return (
                <div key={colIdx} className="w-3.5 mr-0.5 text-xs text-gray-400 text-center">
                  {label ? MONTH_LABELS[label.month] : ''}
                </div>
              );
            })}
          </div>

          <div className="flex gap-0.5">
            {/* Day-of-week labels */}
            <div className="flex flex-col gap-0.5 mr-1">
              {DAY_LABELS.map((day, i) => (
                <div key={day} className="h-3.5 w-6 flex items-center">
                  {i % 2 === 1 && <span className="text-xs text-gray-400 leading-none">{day}</span>}
                </div>
              ))}
            </div>

            {/* Grid columns (weeks) */}
            {Array.from({ length: numCols }, (_, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-0.5">
                {Array.from({ length: 7 }, (__, rowIdx) => {
                  const cellIdx = colIdx * 7 + rowIdx;
                  const date = cells[cellIdx];
                  if (!date) {
                    return <div key={rowIdx} className="w-3.5 h-3.5" />;
                  }
                  const pages = calendar[date]?.pages || 0;
                  const sessions = calendar[date]?.sessions || 0;
                  return (
                    <div
                      key={rowIdx}
                      className={`w-3.5 h-3.5 rounded-sm cursor-pointer transition-transform hover:scale-125 ${getColor(pages)}`}
                      onMouseEnter={(e) => {
                        const rect = e.target.getBoundingClientRect();
                        setTooltip({ date, pages, sessions, x: rect.left, y: rect.top });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1 mt-2 ml-8">
            <span className="text-xs text-gray-400 mr-1">Less</span>
            {[
              'bg-gray-100',
              'bg-emerald-200',
              'bg-emerald-400',
              'bg-emerald-600',
              'bg-emerald-800',
            ].map((c) => (
              <div key={c} className={`w-3.5 h-3.5 rounded-sm ${c}`} />
            ))}
            <span className="text-xs text-gray-400 ml-1">More</span>
          </div>
        </div>
      </div>

      {/* Tooltip portal-ish (fixed position) */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 pointer-events-none shadow-xl"
          style={{ left: tooltip.x + 20, top: tooltip.y - 10 }}
        >
          <div className="font-semibold">{tooltip.date}</div>
          {tooltip.pages > 0 ? (
            <>
              <div>{tooltip.pages} pages read</div>
              <div>
                {tooltip.sessions} session{tooltip.sessions !== 1 ? 's' : ''}
              </div>
            </>
          ) : (
            <div className="text-gray-400">No reading logged</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReadingCalendar;
