import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getGoalsProgress, createGoal, deleteGoal } from '../services/goalService';
import { getOverview } from '../services/analyticsService';
import { getHabitInsights } from '../services/aiService'; // Phase 18
import { useTheme } from '../context/ThemeContext';
import {
  Target,
  Plus,
  Trash2,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Star,
  Sparkles,
  Loader2,
  CalendarDays,
} from 'lucide-react';

// Phase 07: fixed categorical order, validated for CVD-safety with
// scripts/validate_palette.js from the dataviz skill (PASS on separation,
// WARN on surface contrast — mitigated by always pairing a slice with a
// visible legend/tooltip label, never color alone). Left untouched by the
// neumorphic redesign — deliberately vivid/saturated against the muted
// shell so categories stay distinguishable, unlike the token palette.
const GENRE_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#0ea5e9', // sky
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [currentYear, currentYear - 1, currentYear - 2];

// Phase 13: Recharts renders to SVG with inline style props, not Tailwind
// classes — so unlike everything else on this page, its axis/grid/bar
// colors have to be picked in JS based on the active theme. Neumorphic
// redesign: these are now the exact --neu-* token hex values (see
// index.css) instead of the old raw indigo/sky Tailwind palette, so the
// charts read as part of the same "Tactile Bibliotheca" system.
const NEU_HEX = {
  light: {
    primary: '#4648d4',
    secondary: '#376758',
    tertiary: '#6b38d4',
    onSurfaceVariant: '#464554',
    outlineVariant: '#c7c4d7',
  },
  dark: {
    primary: '#c0c1ff',
    secondary: '#9ed1be',
    tertiary: '#d0bcff',
    onSurfaceVariant: '#c5c4d1',
    outlineVariant: '#45454f',
  },
};
const CHART_AXIS_PROPS = {
  light: {
    tick: { fill: NEU_HEX.light.onSurfaceVariant, fontSize: 12 },
    axisLine: { stroke: NEU_HEX.light.outlineVariant },
    tickLine: false,
  },
  dark: {
    tick: { fill: NEU_HEX.dark.onSurfaceVariant, fontSize: 12 },
    axisLine: { stroke: NEU_HEX.dark.outlineVariant },
    tickLine: false,
  },
};
const GRID_STROKE = { light: NEU_HEX.light.outlineVariant, dark: NEU_HEX.dark.outlineVariant };
const CURSOR_FILL = {
  light: {
    indigo: 'rgba(70,72,212,0.08)',
    sky: 'rgba(55,103,88,0.08)',
    amber: 'rgba(245,158,11,0.1)',
  },
  dark: {
    indigo: 'rgba(192,193,255,0.1)',
    sky: 'rgba(158,209,190,0.1)',
    amber: 'rgba(245,158,11,0.15)',
  },
};

const GoalProgressCard = ({ goal, onDelete }) => {
  const label =
    goal.period === 'yearly'
      ? `${goal.year}`
      : new Date(goal.year, goal.month - 1).toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        });

  const isDone = goal.percent >= 100;

  return (
    <div className="relative bg-surface rounded-neu-xl p-4 shadow-neu-lg hover:shadow-neu-lg-hover transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="px-2 py-1 rounded-full bg-surface shadow-neu-inset-sm text-xs text-primary font-semibold">
            {goal.period === 'yearly' ? 'Annual Milestone' : 'Monthly Milestone'}
          </span>
          <button
            onClick={() => onDelete(goal._id)}
            className="w-7 h-7 rounded-full bg-surface shadow-neu-xs hover:shadow-neu-inset-sm text-outline hover:text-neu-error flex items-center justify-center transition-all"
            title="Delete goal"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <h3 className="font-display text-lg text-on-surface font-semibold mt-2">{label}</h3>
        <p className="text-xs text-on-surface-variant mt-0.5">
          {goal.target} {goal.metric === 'books' ? 'books' : 'pages'} targeted
        </p>
      </div>
      <div className="mt-4 space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="font-bold text-on-surface text-lg">
            {goal.actual}{' '}
            <span className="font-normal text-on-surface-variant text-xs">/ {goal.target}</span>
          </span>
          <span className={`font-bold ${isDone ? 'text-secondary' : 'text-primary'}`}>
            {goal.percent}%
          </span>
        </div>
        <div className="h-3 w-full bg-surface rounded-full shadow-neu-inset-sm p-0.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isDone ? 'bg-secondary' : 'bg-gradient-to-r from-primary-container to-primary'
            }`}
            style={{ width: `${Math.min(100, goal.percent)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const ChartCard = ({ icon: Icon, eyebrow, title, badge, children, empty }) => (
  <div className="bg-surface rounded-neu-xl p-4 shadow-neu-lg flex flex-col justify-between gap-4">
    <div className="flex items-center justify-between gap-2">
      <div>
        <span className="text-xs text-primary font-semibold tracking-wide uppercase flex items-center gap-1.5">
          <Icon size={13} /> {eyebrow}
        </span>
        <h4 className="font-display text-base text-on-surface font-semibold mt-0.5">{title}</h4>
      </div>
      {badge && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-surface shadow-neu-inset-sm shrink-0">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs font-bold text-on-surface">{badge}</span>
        </div>
      )}
    </div>
    {empty ? (
      <div className="h-56 flex items-center justify-center text-sm text-on-surface-variant">
        Nothing here yet — start logging progress and rating books.
      </div>
    ) : (
      <div className="h-56">{children}</div>
    )}
  </div>
);

const Dashboard = () => {
  const { theme } = useTheme();
  const axisProps = CHART_AXIS_PROPS[theme];
  const gridStroke = GRID_STROKE[theme];
  const cursorFill = CURSOR_FILL[theme];
  const neuHex = NEU_HEX[theme];

  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({
    period: 'yearly',
    year: currentYear,
    month: 1,
    metric: 'books',
    target: '',
  });
  const [goalError, setGoalError] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [year, setYear] = useState(currentYear);

  // Phase 18: reading-habits AI insight — fetched on click, not on page
  // load, so just opening the Dashboard never spends AI quota.
  const [habitInsight, setHabitInsight] = useState(null);
  const [habitLoading, setHabitLoading] = useState(false);
  const [habitError, setHabitError] = useState('');

  const fetchGoals = useCallback(async () => {
    setGoalsLoading(true);
    try {
      const { data } = await getGoalsProgress();
      setGoals(data);
    } catch (error) {
      console.error('Error fetching goals:', error);
    }
    setGoalsLoading(false);
  }, []);

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const { data } = await getOverview(year);
      setOverview(data);
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
    }
    setOverviewLoading(false);
  }, [year]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Stale insight for a different year shouldn't linger once the year changes
  useEffect(() => {
    setHabitInsight(null);
    setHabitError('');
  }, [year]);

  const handleGetInsight = async () => {
    setHabitLoading(true);
    setHabitError('');
    try {
      const { data } = await getHabitInsights(year);
      setHabitInsight(data);
    } catch (err) {
      if (err.response?.status === 402) {
        setHabitError("You've used all your free AI calls this month. Upgrade to Library Pro.");
      } else if (err.response?.status === 503) {
        setHabitError('AI features are not configured on this server yet.');
      } else {
        setHabitError('Could not generate an insight right now.');
      }
    } finally {
      setHabitLoading(false);
    }
  };

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    setGoalError('');
    const target = Number(goalForm.target);
    if (!target || target < 1) {
      setGoalError('Target must be a positive number.');
      return;
    }
    setSavingGoal(true);
    try {
      await createGoal({
        year: Number(goalForm.year),
        period: goalForm.period,
        month: goalForm.period === 'monthly' ? Number(goalForm.month) : undefined,
        metric: goalForm.metric,
        target,
      });
      setShowGoalForm(false);
      setGoalForm({ period: 'yearly', year: currentYear, month: 1, metric: 'books', target: '' });
      fetchGoals();
    } catch (error) {
      setGoalError(error.response?.data?.message || 'Failed to create goal.');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    try {
      await deleteGoal(goalId);
      setGoals((prev) => prev.filter((g) => g._id !== goalId));
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const hasBooksActivity = overview?.booksPerMonth.some((m) => m.count > 0);
  const hasPagesActivity = overview?.pagesPerMonth.some((m) => m.pages > 0);
  const hasGenres = overview?.genreBreakdown.length > 0;
  const hasRatings = overview?.ratingDistribution.length > 0;
  const totalBooksThisYear = overview?.booksPerMonth.reduce((s, m) => s + m.count, 0) || 0;
  const totalPagesThisYear = overview?.pagesPerMonth.reduce((s, m) => s + m.pages, 0) || 0;

  const selectClass =
    'rounded-neu border-none text-sm px-3 py-1.5 bg-surface shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 text-on-surface';

  return (
    <>
      {/* ── Goals ────────────────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary shadow-neu-xs" />
              <span className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold">
                Active Targets
              </span>
            </div>
            <h2 className="font-display text-2xl text-on-surface tracking-tight font-bold flex items-center gap-2 mt-0.5">
              <Target className="text-primary" size={22} /> Reading Goals
            </h2>
          </div>
          <button
            onClick={() => setShowGoalForm((prev) => !prev)}
            className="px-4 py-2.5 rounded-full bg-surface shadow-neu-md hover:shadow-neu active:shadow-neu-inset text-primary text-sm font-semibold flex items-center gap-1.5 transition-all"
          >
            <Plus size={16} /> New Goal
          </button>
        </div>

        {showGoalForm && (
          <form
            onSubmit={handleCreateGoal}
            className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-surface rounded-neu-xl shadow-neu-lg"
          >
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">
                Period
              </label>
              <select
                value={goalForm.period}
                onChange={(e) => setGoalForm((f) => ({ ...f, period: e.target.value }))}
                className={selectClass}
              >
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Year</label>
              <select
                value={goalForm.year}
                onChange={(e) => setGoalForm((f) => ({ ...f, year: e.target.value }))}
                className={selectClass}
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            {goalForm.period === 'monthly' && (
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1">
                  Month
                </label>
                <select
                  value={goalForm.month}
                  onChange={(e) => setGoalForm((f) => ({ ...f, month: e.target.value }))}
                  className={selectClass}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">
                Metric
              </label>
              <select
                value={goalForm.metric}
                onChange={(e) => setGoalForm((f) => ({ ...f, metric: e.target.value }))}
                className={selectClass}
              >
                <option value="books">Books</option>
                <option value="pages">Pages</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">
                Target
              </label>
              <input
                type="number"
                min="1"
                value={goalForm.target}
                onChange={(e) => setGoalForm((f) => ({ ...f, target: e.target.value }))}
                placeholder="e.g. 24"
                className="w-24 rounded-neu border-none text-sm px-3 py-1.5 bg-surface shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 text-on-surface"
              />
            </div>
            <button
              type="submit"
              disabled={savingGoal}
              className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-bold shadow-neu-sm hover:shadow-neu-xs active:shadow-neu-inset disabled:opacity-60 transition-all"
            >
              {savingGoal ? 'Saving…' : 'Create'}
            </button>
            {goalError && <p className="text-sm text-neu-error w-full">{goalError}</p>}
          </form>
        )}

        {!goalsLoading && goals.length === 0 ? (
          <div className="text-center py-8 bg-surface rounded-neu-xl shadow-neu-lg text-on-surface-variant text-sm">
            No goals yet — set one to track your progress.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {goals.map((goal) => (
              <GoalProgressCard key={goal._id} goal={goal} onDelete={handleDeleteGoal} />
            ))}
          </div>
        )}
      </div>

      {/* ── AI habit insight ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-neu-xl bg-surface shadow-neu-xl p-4 lg:p-6 mb-10">
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-tertiary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 shrink-0 rounded-neu-lg bg-surface shadow-neu-md flex items-center justify-center text-tertiary">
              <Sparkles size={20} />
            </div>
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider text-tertiary font-bold">
                AI Reading Habit Insight
              </span>
              {!habitInsight && !habitLoading && !habitError && (
                <p className="text-sm text-on-surface">
                  Get a plain-language read on your {year} reading habits.
                </p>
              )}
              {habitLoading && (
                <p className="text-sm text-on-surface-variant flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin" /> Thinking…
                </p>
              )}
              {habitError && <p className="text-sm text-neu-error">{habitError}</p>}
              {habitInsight && (
                <p className="text-sm text-on-surface leading-relaxed max-w-3xl">
                  {habitInsight.insight}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleGetInsight}
            disabled={habitLoading}
            className="shrink-0 px-4 py-2.5 rounded-full bg-surface shadow-neu-md hover:shadow-neu active:shadow-neu-inset text-on-surface text-sm font-medium flex items-center gap-1.5 transition-all disabled:opacity-60"
          >
            <Sparkles size={15} className="text-tertiary" />
            {habitInsight ? 'Refresh Insight' : 'Get My Insight'}
          </button>
        </div>
      </div>

      {/* ── Analytics ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary shadow-neu-xs" />
            <span className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold">
              Archival Statistics
            </span>
          </div>
          <h2 className="font-display text-2xl text-on-surface tracking-tight font-bold mt-0.5">
            Reading Analytics
          </h2>
        </div>
        <div className="h-10 px-4 rounded-full bg-surface shadow-neu-inset-lg flex items-center gap-2 text-on-surface">
          <CalendarDays size={17} className="text-outline" />
          <select
            aria-label="Analytics Year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-transparent text-sm text-on-surface font-semibold focus:outline-none cursor-pointer"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {overviewLoading ? (
        <div className="text-on-surface-variant text-sm py-8 text-center">Loading analytics…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            icon={BarChart3}
            eyebrow="Volume Completed"
            title={`Books Completed — ${year}`}
            badge={hasBooksActivity ? `${totalBooksThisYear} Books` : null}
            empty={!hasBooksActivity}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overview.booksPerMonth}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={gridStroke} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip cursor={{ fill: cursorFill.indigo }} formatter={(v) => [v, 'Books']} />
                <Bar dataKey="count" fill={neuHex.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            icon={TrendingUp}
            eyebrow="Pages Immersed"
            title={`Pages Read — ${year}`}
            badge={hasPagesActivity ? `${totalPagesThisYear} Pages` : null}
            empty={!hasPagesActivity}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overview.pagesPerMonth}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={gridStroke} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip cursor={{ fill: cursorFill.sky }} formatter={(v) => [v, 'Pages']} />
                <Bar dataKey="pages" fill={neuHex.secondary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            icon={PieIcon}
            eyebrow="Taxonomy"
            title="Genres Read (All Time)"
            empty={!hasGenres}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overview.genreBreakdown}
                  dataKey="count"
                  nameKey="genre"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {overview?.genreBreakdown.map((_, i) => (
                    <Cell key={i} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
                <Legend wrapperStyle={{ fontSize: 12, color: neuHex.onSurfaceVariant }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            icon={Star}
            eyebrow="Critique Ledger"
            title="Rating Distribution (All Time)"
            empty={!hasRatings}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overview.ratingDistribution}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={gridStroke} />
                <XAxis dataKey="rating" {...axisProps} tickFormatter={(r) => `${r}★`} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip cursor={{ fill: cursorFill.amber }} formatter={(v) => [v, 'Books']} />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </>
  );
};

export default Dashboard;
