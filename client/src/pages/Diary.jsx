import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import {
  getEntries,
  getEntryByDate,
  saveEntry,
  deleteEntry,
  getDiaryStats,
  getWritingPrompt,
  lockDiary,
  getPinStatus,
  getDiaryToken,
} from '../services/diaryService';
import DiaryPinModal from '../components/DiaryPinModal';
import {
  BookOpen,
  Lock,
  Unlock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Save,
  Shield,
  ShieldOff,
  Calendar,
  BarChart3,
  Flame,
  FileText,
  Tag,
  BookMarked,
  AlertCircle,
  CheckCircle,
  PenLine,
  Loader2,
} from 'lucide-react';

// ─── Mood Configuration ────────────────────────────────────────────────────
const MOODS = [
  { id: 'happy',      emoji: '😊', label: 'Joyful',     color: 'text-yellow-400',  bg: 'bg-yellow-400/20 border-yellow-400/40' },
  { id: 'peaceful',   emoji: '😌', label: 'Peaceful',   color: 'text-teal-400',    bg: 'bg-teal-400/20 border-teal-400/40' },
  { id: 'inspired',   emoji: '💡', label: 'Inspired',   color: 'text-purple-400',  bg: 'bg-purple-400/20 border-purple-400/40' },
  { id: 'productive', emoji: '⚡', label: 'Productive', color: 'text-blue-400',    bg: 'bg-blue-400/20 border-blue-400/40' },
  { id: 'neutral',    emoji: '😐', label: 'Neutral',    color: 'text-gray-400',    bg: 'bg-gray-400/20 border-gray-400/40' },
  { id: 'stressed',   emoji: '😟', label: 'Stressed',   color: 'text-orange-400',  bg: 'bg-orange-400/20 border-orange-400/40' },
  { id: 'sad',        emoji: '😔', label: 'Down',       color: 'text-indigo-400',  bg: 'bg-indigo-400/20 border-indigo-400/40' },
];

const getMoodConfig = (id) => MOODS.find((m) => m.id === id) || MOODS[4];

// ─── Date Utilities ────────────────────────────────────────────────────────
const toDateStr = (date) => date.toISOString().split('T')[0];
const todayStr = () => toDateStr(new Date());
const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
};
const offsetDate = (dateStr, offset) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + offset);
  return toDateStr(dt);
};

// ─── Auto-save debounce ────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Main Component ────────────────────────────────────────────────────────
const Diary = () => {
  // Lock / PIN state
  const [lockEnabled, setLockEnabled] = useState(false);
  const [pinModal, setPinModal] = useState(null); // null | 'unlock' | 'setup' | 'disable'
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [lockLoading, setLockLoading] = useState(true);

  // Date navigation
  const [selectedDate, setSelectedDate] = useState(todayStr());

  // Entry state
  const [entry, setEntry] = useState({ title: '', content: '', mood: 'neutral', tags: [], gratitude: ['', '', ''], linkedBook: null });
  const [entryLoading, setEntryLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle'|'saving'|'saved'|'error'

  // All entries (for calendar dots and sidebar)
  const [allEntries, setAllEntries] = useState([]);

  // Stats
  const [stats, setStats] = useState(null);

  // Books from library (for linking)
  const [books, setBooks] = useState([]);

  // AI Prompt
  const [aiPrompt, setAiPrompt] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);

  // Tag input
  const [tagInput, setTagInput] = useState('');

  // UI
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'calendar' | 'stats'
  const [toast, setToast] = useState(null);

  const saveTimeoutRef = useRef(null);
  const inactivityTimerRef = useRef(null);

  // ── Init: check lock status ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLockLoading(true);
      try {
        const { data } = await getPinStatus();
        setLockEnabled(data.diaryLockEnabled);
        if (!data.diaryLockEnabled) {
          setIsUnlocked(true);
        } else {
          // Check if we already have a valid diary token in sessionStorage
          const existingToken = getDiaryToken();
          setIsUnlocked(!!existingToken);
          if (!existingToken) {
            setPinModal('unlock');
          }
        }
      } catch {
        setIsUnlocked(true); // fallback if API unavailable
      } finally {
        setLockLoading(false);
      }
    };
    init();
  }, []);

  // ── Load data once unlocked ─────────────────────────────────────────────
  useEffect(() => {
    if (!isUnlocked) return;
    fetchAllEntries();
    fetchStats();
    fetchBooks();
  }, [isUnlocked]);

  // ── Load entry when date changes ────────────────────────────────────────
  useEffect(() => {
    if (!isUnlocked) return;
    fetchEntry(selectedDate);
  }, [selectedDate, isUnlocked]);

  // ── Auto-lock on inactivity (10 min) ───────────────────────────────────
  const resetInactivityTimer = useCallback(() => {
    if (!lockEnabled) return;
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      handleLockNow();
      showToast('Diary auto-locked due to inactivity.', 'info');
    }, 10 * 60 * 1000);
  }, [lockEnabled]);

  useEffect(() => {
    if (!isUnlocked || !lockEnabled) return;
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [isUnlocked, lockEnabled, resetInactivityTimer]);

  // ── Fetch helpers ───────────────────────────────────────────────────────
  const fetchAllEntries = async () => {
    try {
      const { data } = await getEntries();
      setAllEntries(data);
    } catch {}
  };

  const fetchStats = async () => {
    try {
      const { data } = await getDiaryStats();
      setStats(data);
    } catch {}
  };

  const fetchBooks = async () => {
    try {
      const { data } = await api.get('/books');
      setBooks(data);
    } catch {}
  };

  const fetchEntry = async (date) => {
    setEntryLoading(true);
    setSaveStatus('idle');
    try {
      const { data } = await getEntryByDate(date);
      setEntry({
        title: data.title || '',
        content: data.content || '',
        mood: data.mood || 'neutral',
        tags: data.tags || [],
        gratitude: data.gratitude?.length
          ? [...data.gratitude, '', '', ''].slice(0, 3)
          : ['', '', ''],
        linkedBook: data.linkedBook?._id || data.linkedBook || null,
      });
    } catch (err) {
      if (err.response?.status === 404) {
        setEntry({ title: '', content: '', mood: 'neutral', tags: [], gratitude: ['', '', ''], linkedBook: null });
      }
    } finally {
      setEntryLoading(false);
    }
  };

  // ── Auto-save ───────────────────────────────────────────────────────────
  const debouncedContent = useDebounce(entry.content, 1500);

  useEffect(() => {
    if (!isUnlocked || entryLoading) return;
    if (debouncedContent === '' && !entry.title) return; // Don't save empty
    triggerSave();
  }, [debouncedContent]);

  const triggerSave = async () => {
    setSaveStatus('saving');
    try {
      await saveEntry(selectedDate, {
        title: entry.title,
        content: entry.content,
        mood: entry.mood,
        tags: entry.tags,
        gratitude: entry.gratitude.filter(Boolean),
        linkedBook: entry.linkedBook || null,
      });
      setSaveStatus('saved');
      fetchAllEntries();
      fetchStats();
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleManualSave = () => triggerSave();

  // ── Lock helpers ────────────────────────────────────────────────────────
  const handleLockNow = () => {
    lockDiary();
    setIsUnlocked(false);
    setPinModal('unlock');
  };

  const handlePinSuccess = () => {
    setPinModal(null);
    setIsUnlocked(true);
    // Re-fetch pin status to update UI
    getPinStatus().then(({ data }) => {
      setLockEnabled(data.diaryLockEnabled);
    });
    showToast('Diary unlocked successfully! 🔓', 'success');
  };

  const handleSetupPinSuccess = () => {
    setPinModal(null);
    setLockEnabled(true);
    showToast('Diary lock enabled! Your diary is now protected. 🔒', 'success');
  };

  const handleDisablePinSuccess = () => {
    setPinModal(null);
    setLockEnabled(false);
    showToast('Diary lock disabled.', 'info');
  };

  // ── Toast ───────────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── AI Prompt ───────────────────────────────────────────────────────────
  const fetchAiPrompt = async () => {
    setPromptLoading(true);
    try {
      const { data } = await getWritingPrompt();
      setAiPrompt(data.prompt);
    } catch {
      setAiPrompt('What is one small thing that made you smile today?');
    } finally {
      setPromptLoading(false);
    }
  };

  // ── Entry field helpers ─────────────────────────────────────────────────
  const updateField = (field, value) => {
    setEntry((prev) => ({ ...prev, [field]: value }));
    setSaveStatus('idle');
  };

  const handleAddTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !entry.tags.includes(t) && entry.tags.length < 8) {
      updateField('tags', [...entry.tags, t]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag) => {
    updateField('tags', entry.tags.filter((t) => t !== tag));
  };

  const handleGratitudeChange = (i, val) => {
    const g = [...entry.gratitude];
    g[i] = val;
    updateField('gratitude', g);
  };

  // ── Delete entry ────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm('Delete this diary entry? This cannot be undone.')) return;
    try {
      await deleteEntry(selectedDate);
      setEntry({ title: '', content: '', mood: 'neutral', tags: [], gratitude: ['', '', ''], linkedBook: null });
      fetchAllEntries();
      fetchStats();
      showToast('Entry deleted.', 'info');
    } catch {
      showToast('Failed to delete entry.', 'error');
    }
  };

  // ── Calendar helpers ────────────────────────────────────────────────────
  const entryDateSet = new Set(allEntries.map((e) => e.date));
  const entryMoodMap = {};
  allEntries.forEach((e) => { entryMoodMap[e.date] = e.mood; });

  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const getDaysInMonth = (year, month) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const { firstDay, daysInMonth } = getDaysInMonth(calMonth.year, calMonth.month);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (lockLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  const selectedMood = getMoodConfig(entry.mood);
  const hasEntryToday = entryDateSet.has(selectedDate);
  const wordCount = entry.content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="min-h-screen text-gray-100" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── PIN Modal ── */}
      {pinModal && (
        <DiaryPinModal
          mode={pinModal}
          onSuccess={
            pinModal === 'unlock'
              ? handlePinSuccess
              : pinModal === 'setup'
              ? handleSetupPinSuccess
              : handleDisablePinSuccess
          }
          onClose={pinModal === 'unlock' ? null : () => setPinModal(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
          ${toast.type === 'success' ? 'bg-emerald-700 text-white' :
            toast.type === 'error' ? 'bg-red-700 text-white' :
            'bg-gray-700 text-gray-100'}`}>
          {toast.type === 'success' && <CheckCircle size={16} />}
          {toast.type === 'error' && <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* ── Header Bar ── */}
      <div className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-xl border border-indigo-500/30">
            <PenLine size={22} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Personal Diary</h1>
            <p className="text-xs text-gray-400">Your private journal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Save status */}
          <div className="text-xs text-gray-400">
            {saveStatus === 'saving' && <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Saving…</span>}
            {saveStatus === 'saved' && <span className="flex items-center gap-1 text-emerald-400"><CheckCircle size={12} /> Saved</span>}
            {saveStatus === 'error' && <span className="text-red-400">Save failed</span>}
          </div>

          {/* Lock Toggle */}
          {lockEnabled ? (
            <div className="flex gap-2">
              <button
                onClick={handleLockNow}
                title="Lock diary now"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 border border-red-500/40 text-red-400 text-xs rounded-lg hover:bg-red-600/30 transition-colors"
              >
                <Lock size={14} /> Lock Now
              </button>
              <button
                onClick={() => setPinModal('disable')}
                title="Disable diary lock"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-400 text-xs rounded-lg hover:bg-gray-700 transition-colors"
              >
                <ShieldOff size={14} /> Disable Lock
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPinModal('setup')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 text-xs rounded-lg hover:bg-indigo-600/30 transition-colors"
            >
              <Shield size={14} /> Enable Lock
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="flex flex-col gap-4">

          {/* Stats Card */}
          {stats && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-400" /> Your Stats
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="flex items-center justify-center gap-1 text-orange-400 text-lg font-bold">
                    <Flame size={16} /> {stats.streak}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Day Streak</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-indigo-400 text-lg font-bold">{stats.totalEntries}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Entries</div>
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <div className="text-teal-400 text-lg font-bold">{stats.totalWords.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Words</div>
                </div>
              </div>
              {/* Mood distribution */}
              {stats.moodCounts && Object.keys(stats.moodCounts).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {MOODS.filter((m) => stats.moodCounts[m.id]).map((m) => (
                    <span key={m.id} className={`text-xs px-2 py-0.5 rounded-full border ${m.bg} ${m.color}`}>
                      {m.emoji} {stats.moodCounts[m.id]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recent Entries List */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-2 max-h-80 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2 sticky top-0 bg-gray-900 pb-1">
              <FileText size={16} className="text-purple-400" /> Recent Entries
            </h3>
            {allEntries.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No entries yet. Start writing!</p>
            ) : (
              allEntries.slice(0, 20).map((e) => {
                const m = getMoodConfig(e.mood);
                return (
                  <button
                    key={e.date}
                    onClick={() => setSelectedDate(e.date)}
                    className={`w-full text-left px-3 py-2 rounded-xl transition-colors text-xs flex items-center gap-2 group
                      ${selectedDate === e.date ? 'bg-indigo-700/40 border border-indigo-500/50' : 'hover:bg-gray-800 border border-transparent'}`}
                  >
                    <span className="text-base">{m.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-200 truncate">{e.title || 'Untitled Entry'}</div>
                      <div className="text-gray-500">{e.date} · {e.wordCount} words</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Mini Calendar */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setCalMonth((p) => {
                const d = new Date(p.year, p.month - 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })} className="p-1 hover:bg-gray-700 rounded-lg text-gray-400"><ChevronLeft size={16} /></button>
              <span className="text-sm font-semibold text-gray-200">
                {new Date(calMonth.year, calMonth.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => setCalMonth((p) => {
                const d = new Date(p.year, p.month + 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })} className="p-1 hover:bg-gray-700 rounded-lg text-gray-400"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-gray-500 mb-1">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {Array(firstDay).fill(null).map((_, i) => <div key={'e'+i} />)}
              {Array(daysInMonth).fill(null).map((_, i) => {
                const day = i + 1;
                const ds = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasEntry = entryDateSet.has(ds);
                const mood = entryMoodMap[ds];
                const moodCfg = mood ? getMoodConfig(mood) : null;
                const isSelected = ds === selectedDate;
                const isToday = ds === todayStr();
                return (
                  <button
                    key={ds}
                    onClick={() => setSelectedDate(ds)}
                    className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center relative transition-all
                      ${isSelected ? 'bg-indigo-600 text-white font-bold' :
                        isToday ? 'border border-indigo-500 text-indigo-400' :
                        'hover:bg-gray-800 text-gray-400'}`}
                  >
                    {day}
                    {hasEntry && !isSelected && (
                      <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${moodCfg?.color.replace('text-', 'bg-') || 'bg-indigo-400'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── MAIN EDITOR AREA ── */}
        <main className="flex flex-col gap-4">

          {/* Date Navigation Bar */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 flex items-center justify-between">
            <button
              onClick={() => setSelectedDate(offsetDate(selectedDate, -1))}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-gray-400 text-sm rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft size={16} /> Previous
            </button>

            <div className="text-center">
              <div className="text-lg font-bold text-white">{formatDisplayDate(selectedDate)}</div>
              {selectedDate !== todayStr() && (
                <button
                  onClick={() => setSelectedDate(todayStr())}
                  className="text-xs text-indigo-400 hover:underline mt-0.5"
                >
                  ← Back to Today
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedDate(offsetDate(selectedDate, 1))}
              disabled={selectedDate >= todayStr()}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 text-gray-400 text-sm rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-30"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>

          {entryLoading ? (
            <div className="flex items-center justify-center h-60">
              <Loader2 size={30} className="animate-spin text-indigo-500" />
            </div>
          ) : (
            <>
              {/* AI Prompt Banner */}
              {aiPrompt && (
                <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-700/40 rounded-2xl px-5 py-3 flex items-start gap-3">
                  <Sparkles size={18} className="text-purple-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-200">Daily Spark ✨</p>
                    <p className="text-sm text-gray-300 mt-0.5 italic">"{aiPrompt}"</p>
                  </div>
                  <button onClick={() => setAiPrompt('')} className="text-gray-500 hover:text-gray-300 text-xs mt-0.5">✕</button>
                </div>
              )}

              {/* Editor Card */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-5">
                {/* Toolbar Row */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  {/* Mood Selector */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {MOODS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => { updateField('mood', m.id); setTimeout(triggerSave, 100); }}
                        title={m.label}
                        className={`text-xl px-2 py-1 rounded-lg border transition-all duration-150
                          ${entry.mood === m.id ? m.bg + ' scale-110' : 'border-transparent hover:bg-gray-800'}`}
                      >
                        {m.emoji}
                      </button>
                    ))}
                    <span className={`text-xs ml-1 ${selectedMood.color}`}>{selectedMood.label}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Word count */}
                    <span className="text-xs text-gray-500">{wordCount} words</span>

                    {/* AI Prompt Button */}
                    <button
                      onClick={fetchAiPrompt}
                      disabled={promptLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700/30 border border-purple-600/40 text-purple-300 text-xs rounded-lg hover:bg-purple-700/40 transition-colors disabled:opacity-50"
                    >
                      {promptLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      Daily Spark
                    </button>

                    {/* Manual Save */}
                    <button
                      onClick={handleManualSave}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs rounded-lg hover:bg-indigo-600/40 transition-colors"
                    >
                      <Save size={12} /> Save
                    </button>

                    {/* Delete */}
                    {hasEntryToday || entryDateSet.has(selectedDate) ? (
                      <button
                        onClick={handleDelete}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700/20 border border-red-600/30 text-red-400 text-xs rounded-lg hover:bg-red-700/30 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Title Input */}
                <input
                  type="text"
                  placeholder="Title (optional)"
                  value={entry.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full bg-transparent text-2xl font-bold text-white placeholder-gray-600 outline-none border-b border-gray-800 pb-2 focus:border-indigo-500 transition-colors"
                />

                {/* Content Textarea */}
                <textarea
                  placeholder="What's on your mind today? Start writing…"
                  value={entry.content}
                  onChange={(e) => updateField('content', e.target.value)}
                  rows={12}
                  className="w-full bg-transparent text-gray-200 placeholder-gray-600 outline-none resize-none text-base leading-relaxed"
                />
              </div>

              {/* Bottom Section: Gratitude + Tags + Book Link */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Gratitude / Highlights */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                    ✨ Today's Gratitudes
                  </h3>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-5">{i + 1}.</span>
                      <input
                        type="text"
                        placeholder={`Gratitude #${i + 1}`}
                        value={entry.gratitude[i] || ''}
                        onChange={(e) => handleGratitudeChange(i, e.target.value)}
                        onBlur={triggerSave}
                        className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  ))}
                </div>

                {/* Tags + Book Link */}
                <div className="flex flex-col gap-4">
                  {/* Tags */}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <Tag size={14} className="text-teal-400" /> Tags
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a tag…"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                        className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-600 text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500 transition-colors"
                      />
                      <button
                        onClick={handleAddTag}
                        className="px-3 py-2 bg-teal-700/30 border border-teal-600/40 text-teal-300 text-xs rounded-lg hover:bg-teal-700/40 transition-colors"
                      >Add</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 text-xs bg-teal-900/40 border border-teal-700/40 text-teal-300 px-2.5 py-1 rounded-full"
                        >
                          #{tag}
                          <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-400 transition-colors">✕</button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Book Link */}
                  <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                      <BookMarked size={14} className="text-orange-400" /> Reading Reflection
                    </h3>
                    <select
                      value={entry.linkedBook || ''}
                      onChange={(e) => { updateField('linkedBook', e.target.value || null); setTimeout(triggerSave, 100); }}
                      className="w-full bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="">— No book linked —</option>
                      {books.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.title} — {b.author}
                        </option>
                      ))}
                    </select>
                    {entry.linkedBook && (
                      <p className="text-xs text-orange-300">📖 Reflecting on a book from your library</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Diary;
