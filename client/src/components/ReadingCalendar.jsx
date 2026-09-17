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

// Color intensity based on pages read — uses dedicated heatmap CSS tokens
// (explicit rgba per level) so Tailwind opacity modifiers are not needed.
// Tokens are defined in index.css and adapt automatically to .dark.
const getColor = (pages) => {
  if (!pages || pages === 0) return 'bg-heatmap-0';
  if (pages < 20) return 'bg-heatmap-1';
  if (pages < 50) return 'bg-heatmap-2';
  if (pages < 100) return 'bg-heatmap-3';
  return 'bg-heatmap-4';
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
      <div className="bg-surface rounded-neu-xl shadow-neu-lg p-6 animate-pulse">
        <div className="h-5 bg-surface-container-high rounded w-48 mb-4" />
        <div className="h-32 bg-surface-container-low rounded-neu" />
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-neu-xl shadow-neu-lg p-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-6 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-neu bg-surface shadow-neu-inset-sm flex items-center justify-center text-primary">
            <Calendar size={18} />
          </div>
          <h3 className="font-display text-lg font-bold text-on-surface">Reading Activity</h3>
        </div>
        {streakData && (
          <div className="flex gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-surface shadow-neu-xs rounded-full px-3 py-1.5">
              <Flame size={14} className="text-tertiary" />
              <span className="text-sm font-bold text-tertiary">{streakData.streak}</span>
              <span className="text-xs text-tertiary">day streak</span>
            </div>
            <div className="flex items-center gap-1.5 bg-surface shadow-neu-xs rounded-full px-3 py-1.5">
              <TrendingUp size={14} className="text-on-surface-variant" />
              <span className="text-sm font-bold text-on-surface-variant">
                {streakData.longestStreak}
              </span>
              <span className="text-xs text-on-surface-variant">best streak</span>
            </div>
            <div className="flex items-center gap-1.5 bg-surface shadow-neu-xs rounded-full px-3 py-1.5">
              <span className="text-sm font-bold text-secondary">
                {streakData.totalPages.toLocaleString()}
              </span>
              <span className="text-xs text-secondary">pages this year</span>
            </div>
            <div className="flex items-center gap-1.5 bg-surface shadow-neu-xs rounded-full px-3 py-1.5">
              <span className="text-sm font-bold text-on-surface-variant">
                {streakData.totalSessions}
              </span>
              <span className="text-xs text-on-surface-variant">sessions</span>
            </div>
          </div>
        )}
      </div>

      {/* Heatmap — recessed into a debossed panel */}
      <div className="overflow-x-auto rounded-neu bg-surface-container-low/60 shadow-neu-inset p-3">
        <div className="inline-block min-w-max">
          {/* Month labels */}
          <div className="flex mb-1 ml-8">
            {Array.from({ length: numCols }, (_, colIdx) => {
              const label = monthLabels.find((m) => m.col === colIdx);
              return (
                <div
                  key={colIdx}
                  className="w-3.5 mr-0.5 text-xs text-on-surface-variant text-center"
                >
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
                  {i % 2 === 1 && (
                    <span className="text-xs text-on-surface-variant leading-none">{day}</span>
                  )}
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
            <span className="text-xs text-on-surface-variant mr-1">Less</span>
            {['bg-heatmap-0', 'bg-heatmap-1', 'bg-heatmap-2', 'bg-heatmap-3', 'bg-heatmap-4'].map(
              (c) => (
                <div key={c} className={`w-3.5 h-3.5 rounded-sm ${c}`} />
              )
            )}
            <span className="text-xs text-on-surface-variant ml-1">More</span>
          </div>
        </div>
      </div>

      {/* Tooltip portal-ish (fixed position) */}
      {tooltip && (
        <div
          className="fixed z-50 bg-inverse-surface text-inverse-on-surface text-xs rounded-neu px-3 py-2 pointer-events-none shadow-neu-lg"
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
            <div className="opacity-70">No reading logged</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReadingCalendar;
