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
import { useTheme } from '../context/ThemeContext';
import {
  Target,
  Plus,
  Trash2,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  Star,
} from 'lucide-react';

// Phase 07: fixed categorical order, validated for CVD-safety with
// scripts/validate_palette.js from the dataviz skill (PASS on separation,
// WARN on surface contrast — mitigated by always pairing a slice with a
// visible legend/tooltip label, never color alone).
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
// classes — so unlike everything else on this page, its axis/grid colors
// have to be picked in JS based on the active theme, not with a dark: variant.
const CHART_AXIS_PROPS = {
  light: {
    tick: { fill: '#9ca3af', fontSize: 12 },
    axisLine: { stroke: '#e5e7eb' },
    tickLine: false,
  },
  dark: {
    tick: { fill: '#6b7280', fontSize: 12 },
    axisLine: { stroke: '#374151' },
    tickLine: false,
  },
};
const GRID_STROKE = { light: '#f3f4f6', dark: '#1f2937' };
const CURSOR_FILL = {
  light: { indigo: '#f5f3ff', sky: '#ecfeff', amber: '#fffbeb' },
  dark: { indigo: '#312e81', sky: '#164e63', amber: '#451a03' },
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
          <h3 className="font-bold text-gray-800 dark:text-gray-100">
            {goal.target} {goal.metric === 'books' ? 'books' : 'pages'}
          </h3>
        </div>
        <button
          onClick={() => onDelete(goal._id)}
          className="text-gray-300 hover:text-red-500"
          title="Delete goal"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>
          {goal.actual} / {goal.target}
        </span>
        <span
          className={`font-semibold ${isDone ? 'text-green-600 dark:text-green-400' : 'text-indigo-600 dark:text-indigo-400'}`}
        >
          {goal.percent}%
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isDone ? 'bg-green-500' : 'bg-indigo-500'}`}
          style={{ width: `${goal.percent}%` }}
        />
      </div>
    </div>
  );
};

const ChartCard = ({ icon: Icon, title, children, empty }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
    <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-4">
      <Icon size={16} className="text-indigo-500" /> {title}
    </h3>
    {empty ? (
      <div className="h-56 flex items-center justify-center text-sm text-gray-400">
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

  return (
    <>
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <Target className="text-indigo-600" /> Reading Dashboard
      </h2>

      {/* ── Goals ────────────────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Goals</h3>
          <button
            onClick={() => setShowGoalForm((prev) => !prev)}
            className="inline-flex items-center px-3 py-1.5 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            <Plus size={15} className="mr-1" /> New Goal
          </button>
        </div>

        {showGoalForm && (
          <form
            onSubmit={handleCreateGoal}
            className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Period
              </label>
              <select
                value={goalForm.period}
                onChange={(e) => setGoalForm((f) => ({ ...f, period: e.target.value }))}
                className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm text-sm px-3 py-1.5 border bg-white dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Year
              </label>
              <select
                value={goalForm.year}
                onChange={(e) => setGoalForm((f) => ({ ...f, year: e.target.value }))}
                className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm text-sm px-3 py-1.5 border bg-white dark:bg-gray-700 dark:text-gray-100"
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Month
                </label>
                <select
                  value={goalForm.month}
                  onChange={(e) => setGoalForm((f) => ({ ...f, month: e.target.value }))}
                  className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm text-sm px-3 py-1.5 border bg-white dark:bg-gray-700 dark:text-gray-100"
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
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Metric
              </label>
              <select
                value={goalForm.metric}
                onChange={(e) => setGoalForm((f) => ({ ...f, metric: e.target.value }))}
                className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm text-sm px-3 py-1.5 border bg-white dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="books">Books</option>
                <option value="pages">Pages</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Target
              </label>
              <input
                type="number"
                min="1"
                value={goalForm.target}
                onChange={(e) => setGoalForm((f) => ({ ...f, target: e.target.value }))}
                placeholder="e.g. 24"
                className="w-24 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 shadow-sm text-sm px-3 py-1.5 border"
              />
            </div>
            <button
              type="submit"
              disabled={savingGoal}
              className="px-4 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {savingGoal ? 'Saving…' : 'Create'}
            </button>
            {goalError && <p className="text-sm text-red-600 w-full">{goalError}</p>}
          </form>
        )}

        {!goalsLoading && goals.length === 0 ? (
          <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-gray-400 text-sm">
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

      {/* ── Analytics ────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Analytics</h3>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-md border-gray-300 dark:border-gray-600 shadow-sm text-sm px-3 py-1.5 border bg-white dark:bg-gray-700 dark:text-gray-100"
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {overviewLoading ? (
        <div className="text-gray-400 text-sm py-8 text-center">Loading analytics…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard icon={BarChart3} title={`Books Completed — ${year}`} empty={!hasBooksActivity}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overview.booksPerMonth}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={gridStroke} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip cursor={{ fill: cursorFill.indigo }} formatter={(v) => [v, 'Books']} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard icon={TrendingUp} title={`Pages Read — ${year}`} empty={!hasPagesActivity}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overview.pagesPerMonth}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke={gridStroke} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip cursor={{ fill: cursorFill.sky }} formatter={(v) => [v, 'Pages']} />
                <Bar dataKey="pages" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard icon={PieIcon} title="Genres Read (All Time)" empty={!hasGenres}>
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
                <Legend
                  wrapperStyle={{ fontSize: 12, color: theme === 'dark' ? '#d1d5db' : '#374151' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard icon={Star} title="Rating Distribution (All Time)" empty={!hasRatings}>
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
