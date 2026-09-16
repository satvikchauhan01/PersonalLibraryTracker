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
import { uploadDiaryImage } from '../services/uploadService'; // Phase 10
import { askDiary } from '../services/aiService'; // Phase 18
import {
  Lock,
  Unlock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Save,
  Shield,
  ShieldOff,
  BarChart3,
  Flame,
  FileText,
  Tag,
  BookMarked,
  AlertCircle,
  CheckCircle,
  Loader2,
  Plus,
  MessageCircle,
  Send,
  Shuffle,
  Sprout,
  X,
} from 'lucide-react';

// ─── Mood Configuration ────────────────────────────────────────────────────
// Neumorphic redesign: each mood keeps its own raw accent (not the
// primary/secondary/tertiary token set — moods are personal, not brand
// semantics) with a light/dark pair for contrast against the neu surface.
const MOODS = [
  { id: 'happy', emoji: '😊', label: 'Joyful', color: 'text-amber-600 dark:text-amber-400' },
  { id: 'peaceful', emoji: '😌', label: 'Peaceful', color: 'text-teal-600 dark:text-teal-400' },
  { id: 'inspired', emoji: '💡', label: 'Inspired', color: 'text-purple-600 dark:text-purple-400' },
  { id: 'productive', emoji: '⚡', label: 'Productive', color: 'text-blue-600 dark:text-blue-400' },
  { id: 'neutral', emoji: '😐', label: 'Neutral', color: 'text-on-surface-variant' },
  { id: 'stressed', emoji: '😟', label: 'Stressed', color: 'text-orange-600 dark:text-orange-400' },
  { id: 'sad', emoji: '😔', label: 'Down', color: 'text-indigo-600 dark:text-indigo-400' },
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
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
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
  const [entry, setEntry] = useState({
    title: '',
    content: '',
    mood: 'neutral',
    tags: [],
    gratitude: ['', '', ''],
    linkedBook: null,
    images: [],
  });
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

  // Phase 18: Ask Your Diary (RAG)
  const [askQuestion, setAskQuestion] = useState('');
  const [askAnswer, setAskAnswer] = useState(null); // { answer, sources }
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState('');

  // Tag input
  const [tagInput, setTagInput] = useState('');

  // UI
  const [toast, setToast] = useState(null);

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
    inactivityTimerRef.current = setTimeout(
      () => {
        handleLockNow();
        showToast('Diary auto-locked due to inactivity.', 'info');
      },
      10 * 60 * 1000
    );
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
      // Phase 06: /books now returns { books, page, ... } — this dropdown
      // just needs the whole library, so ask for a generously high limit.
      const { data } = await api.get('/books', { params: { limit: 200 } });
      setBooks(data.books);
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
        images: data.images || [],
      });
    } catch (err) {
      if (err.response?.status === 404) {
        setEntry({
          title: '',
          content: '',
          mood: 'neutral',
          tags: [],
          gratitude: ['', '', ''],
          linkedBook: null,
          images: [],
        });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        images: entry.images,
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

  // ── Ask Your Diary (Phase 18) ───────────────────────────────────────────
  const handleAskDiary = async (e) => {
    e.preventDefault();
    if (!askQuestion.trim() || askLoading) return;
    setAskLoading(true);
    setAskError('');
    setAskAnswer(null);
    try {
      const { data } = await askDiary(askQuestion.trim());
      setAskAnswer(data);
    } catch (err) {
      if (err.response?.status === 402) {
        setAskError("You've used all your free AI calls this month. Upgrade to Library Pro.");
      } else if (err.response?.status === 503) {
        setAskError('AI features are not configured on this server yet.');
      } else {
        setAskError(err.response?.data?.message || 'Could not answer that right now.');
      }
    } finally {
      setAskLoading(false);
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
    updateField(
      'tags',
      entry.tags.filter((t) => t !== tag)
    );
  };

  const handleGratitudeChange = (i, val) => {
    const g = [...entry.gratitude];
    g[i] = val;
    updateField('gratitude', g);
  };

  // ── Images (Phase 10) ───────────────────────────────────────────────────
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const MAX_DIARY_IMAGES = 4;
  const MAX_IMAGE_MB = 3;

  const handleAddImage = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImageError('');

    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setImageError(`Image must be under ${MAX_IMAGE_MB}MB.`);
      return;
    }
    if (entry.images.length >= MAX_DIARY_IMAGES) {
      setImageError(`You can attach up to ${MAX_DIARY_IMAGES} images.`);
      return;
    }

    setImageUploading(true);
    try {
      const url = await uploadDiaryImage(file);
      updateField('images', [...entry.images, url]);
      setTimeout(triggerSave, 100);
    } catch (err) {
      setImageError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setImageUploading(false);
    }
  };

  const handleRemoveImage = (url) => {
    updateField(
      'images',
      entry.images.filter((i) => i !== url)
    );
    setTimeout(triggerSave, 100);
  };

  // ── Delete entry ────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm('Delete this diary entry? This cannot be undone.')) return;
    try {
      await deleteEntry(selectedDate);
      setEntry({
        title: '',
        content: '',
        mood: 'neutral',
        tags: [],
        gratitude: ['', '', ''],
        linkedBook: null,
        images: [],
      });
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
  allEntries.forEach((e) => {
    entryMoodMap[e.date] = e.mood;
  });

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
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    );
  }

  const selectedMood = getMoodConfig(entry.mood);
  const hasEntryToday = entryDateSet.has(selectedDate);
  const wordCount = entry.content.trim().split(/\s+/).filter(Boolean).length;

  const inputInsetClass =
    'bg-surface-container-low border-none text-sm text-on-surface placeholder:text-outline shadow-neu-inset-sm focus:shadow-neu-inset-focus focus:ring-0 rounded-neu-lg px-3 py-2.5 transition-all';

  return (
    <div className="max-w-[1520px] mx-auto w-full flex flex-col gap-4">
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
        <div
          className={`fixed top-4 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-neu-lg shadow-neu-xl text-sm font-medium bg-surface transition-all
          ${toast.type === 'success' ? 'text-secondary' : toast.type === 'error' ? 'text-neu-error' : 'text-on-surface-variant'}`}
        >
          {toast.type === 'success' && <CheckCircle size={16} />}
          {toast.type === 'error' && <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* ── Status / security breadcrumb bar ── */}
      <div className="w-full bg-surface-container-low rounded-neu-xl shadow-neu-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-surface-container shadow-neu-inset-sm flex items-center justify-center text-secondary">
            <Unlock size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-base text-on-surface font-semibold">
                Diary Unlocked
              </span>
              <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(55,103,88,0.7)] animate-pulse" />
            </div>
            <span className="text-xs text-on-surface-variant">Private, PIN-protected journal</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lockEnabled ? (
            <>
              <button
                onClick={handleLockNow}
                title="Lock diary now"
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface-container-low text-neu-error text-xs font-semibold shadow-neu-xs hover:shadow-neu-inset-sm transition-all"
              >
                <Lock size={13} /> Lock Now
              </button>
              <button
                onClick={() => setPinModal('disable')}
                title="Disable diary lock"
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface-container-low text-on-surface-variant text-xs font-semibold shadow-neu-xs hover:shadow-neu-inset-sm transition-all"
              >
                <ShieldOff size={13} /> Disable Lock
              </button>
            </>
          ) : (
            <button
              onClick={() => setPinModal('setup')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface-container-low text-primary text-xs font-semibold shadow-neu-xs hover:shadow-neu-inset-sm transition-all"
            >
              <Shield size={13} /> Enable Lock
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* ================= LEFT: JOURNAL EDITOR (8 cols) ================= */}
        <div className="xl:col-span-8 flex flex-col gap-4">
          {/* Date navigation */}
          <div className="w-full bg-surface-container-low rounded-neu-xl shadow-neu-lg p-2 flex items-center justify-between">
            <button
              onClick={() => setSelectedDate(offsetDate(selectedDate, -1))}
              aria-label="Previous day"
              className="w-10 h-10 rounded-full bg-surface-container-low shadow-neu-xs hover:shadow-neu-inset-sm active:shadow-neu-inset flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all"
            >
              <ChevronLeft size={19} />
            </button>
            <div className="text-center">
              <div className="text-sm sm:text-base font-bold text-on-surface">
                {formatDisplayDate(selectedDate)}
              </div>
              {selectedDate !== todayStr() && (
                <button
                  onClick={() => setSelectedDate(todayStr())}
                  className="text-xs text-primary hover:underline mt-0.5 font-semibold"
                >
                  ← Back to Today
                </button>
              )}
            </div>
            <button
              onClick={() => setSelectedDate(offsetDate(selectedDate, 1))}
              disabled={selectedDate >= todayStr()}
              aria-label="Next day"
              className="w-10 h-10 rounded-full bg-surface-container-low shadow-neu-xs hover:shadow-neu-inset-sm active:shadow-neu-inset flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all disabled:opacity-30"
            >
              <ChevronRight size={19} />
            </button>
          </div>

          {entryLoading ? (
            <div className="flex items-center justify-center h-60">
              <Loader2 size={30} className="animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Mood selector */}
              <div className="w-full bg-surface-container-low rounded-neu-xl shadow-neu-lg p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">
                    How are you feeling?
                  </span>
                  <span className={`text-xs font-medium ${selectedMood.color}`}>
                    Selected: {selectedMood.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                  {MOODS.map((m) => {
                    const active = entry.mood === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          updateField('mood', m.id);
                          setTimeout(triggerSave, 100);
                        }}
                        title={m.label}
                        className={`px-2.5 py-3 rounded-neu-lg flex flex-col items-center gap-1 transition-all ${
                          active
                            ? `shadow-neu-inset font-semibold ${m.color}`
                            : 'bg-surface-container-low text-on-surface shadow-neu-xs hover:shadow-neu-sm'
                        }`}
                      >
                        <span className="text-xl leading-none">{m.emoji}</span>
                        <span className="text-[11px]">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AI writing prompt */}
              <div className="w-full bg-surface-container-low rounded-neu-xl shadow-neu-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-container/40 flex items-center justify-center text-primary shrink-0 shadow-neu-inset-xs">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <span className="text-xs text-primary font-bold uppercase tracking-wider block">
                      Daily Spark
                    </span>
                    {aiPrompt ? (
                      <p className="text-sm text-on-surface font-medium leading-relaxed italic">
                        "{aiPrompt}"
                      </p>
                    ) : (
                      <p className="text-sm text-on-surface-variant">
                        Get a gentle prompt to kick-start today's entry.
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={fetchAiPrompt}
                  disabled={promptLoading}
                  className="shrink-0 px-3 py-1.5 rounded-full bg-surface-container-low text-primary text-xs font-semibold shadow-neu-xs hover:shadow-neu-inset-sm transition-all flex items-center gap-1 disabled:opacity-50"
                >
                  {promptLoading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Shuffle size={13} />
                  )}
                  {aiPrompt ? 'New Prompt' : 'Get Prompt'}
                </button>
              </div>

              {/* Manuscript editor */}
              <div className="w-full bg-surface-container-low rounded-neu-xl shadow-neu-lg p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
                  <span className="text-xs text-on-surface-variant font-semibold tracking-wider uppercase">
                    Entry
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-on-surface-variant">{wordCount} words</span>
                    <span className="text-xs text-on-surface-variant">
                      {saveStatus === 'saving' && (
                        <span className="flex items-center gap-1">
                          <Loader2 size={11} className="animate-spin" /> Saving…
                        </span>
                      )}
                      {saveStatus === 'saved' && (
                        <span className="flex items-center gap-1 text-secondary">
                          <CheckCircle size={11} /> Saved
                        </span>
                      )}
                      {saveStatus === 'error' && (
                        <span className="text-neu-error">Save failed</span>
                      )}
                    </span>
                    <button
                      onClick={handleManualSave}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low text-primary text-xs font-semibold shadow-neu-xs hover:shadow-neu-inset-sm transition-all"
                    >
                      <Save size={11} /> Save
                    </button>
                    {hasEntryToday && (
                      <button
                        onClick={handleDelete}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low text-neu-error text-xs font-semibold shadow-neu-xs hover:shadow-neu-inset-sm transition-all"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="w-full rounded-neu-lg bg-surface-container-low shadow-neu-inset p-4 flex flex-col gap-3">
                  <input
                    type="text"
                    placeholder="Title (optional)"
                    value={entry.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className="w-full bg-transparent font-display text-xl font-bold text-on-surface placeholder:text-outline outline-none border-b border-outline-variant/20 pb-2 focus:border-primary transition-colors"
                  />
                  <textarea
                    placeholder="What's on your mind today? Start writing…"
                    value={entry.content}
                    onChange={(e) => updateField('content', e.target.value)}
                    rows={10}
                    className="w-full bg-transparent text-on-surface placeholder:text-outline outline-none resize-none text-base leading-relaxed"
                  />
                </div>
              </div>

              {/* Gratitude */}
              <div className="w-full bg-surface-container-low rounded-neu-xl shadow-neu-lg p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Sprout size={17} className="text-secondary" />
                  <span className="font-display text-base text-on-surface font-semibold">
                    Today's Gratitudes
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 w-full rounded-neu-lg bg-surface-container-low shadow-neu-inset-sm px-3 py-2.5"
                    >
                      <span className="w-6 h-6 rounded-full bg-surface-container flex items-center justify-center text-xs text-secondary font-bold shrink-0 shadow-neu-inset-xs">
                        {i + 1}
                      </span>
                      <input
                        type="text"
                        placeholder={`Gratitude #${i + 1}`}
                        value={entry.gratitude[i] || ''}
                        onChange={(e) => handleGratitudeChange(i, e.target.value)}
                        onBlur={triggerSave}
                        className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags + Book link + Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface-container-low rounded-neu-xl shadow-neu-lg p-4 flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                    <Tag size={14} className="text-secondary" /> Tags
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a tag…"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className={`flex-1 ${inputInsetClass}`}
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-3 py-2 rounded-neu-lg bg-surface-container-low text-secondary text-xs font-semibold shadow-neu-xs hover:shadow-neu-inset-sm transition-all"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 text-xs bg-surface-container-low text-secondary shadow-neu-xs px-2.5 py-1 rounded-full"
                      >
                        #{tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-neu-error transition-colors"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="bg-surface-container-low rounded-neu-xl shadow-neu-lg p-4 flex flex-col gap-3">
                    <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                      <BookMarked size={14} className="text-primary" /> Reading Reflection
                    </h3>
                    <select
                      value={entry.linkedBook || ''}
                      onChange={(e) => {
                        updateField('linkedBook', e.target.value || null);
                        setTimeout(triggerSave, 100);
                      }}
                      className={`w-full ${inputInsetClass}`}
                    >
                      <option value="">— No book linked —</option>
                      {books.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.title} — {b.author}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-surface-container-low rounded-neu-xl shadow-neu-lg p-4 flex flex-col gap-3">
                    <h3 className="text-sm font-bold text-on-surface flex items-center justify-between">
                      <span>Images</span>
                      <span className="text-xs font-normal text-on-surface-variant">
                        {entry.images.length}/{MAX_DIARY_IMAGES}
                      </span>
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {entry.images.map((url) => (
                        <div key={url} className="relative group w-20 h-20 flex-shrink-0">
                          <img
                            src={url}
                            alt=""
                            className="w-full h-full object-cover rounded-neu-lg shadow-neu-inset-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(url)}
                            className="absolute -top-1.5 -right-1.5 bg-surface shadow-neu-xs rounded-full w-5 h-5 flex items-center justify-center text-on-surface-variant hover:text-neu-error text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove image"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      {entry.images.length < MAX_DIARY_IMAGES && (
                        <label className="w-20 h-20 flex-shrink-0 flex flex-col items-center justify-center rounded-neu-lg bg-surface-container-low shadow-neu-inset-sm text-on-surface-variant hover:text-primary cursor-pointer transition-colors">
                          {imageUploading ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <>
                              <Plus size={16} />
                              <span className="text-[10px] mt-1">Add</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAddImage}
                            disabled={imageUploading}
                          />
                        </label>
                      )}
                    </div>
                    {imageError && <p className="text-xs text-neu-error">{imageError}</p>}
                  </div>
                </div>
              </div>

              {/* Ask Your Diary (Phase 18) */}
              <div className="bg-surface-container-low rounded-neu-xl shadow-neu-lg p-4 flex flex-col gap-3">
                <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <MessageCircle size={15} className="text-tertiary" /> Ask Your Diary
                </h3>
                <form onSubmit={handleAskDiary} className="flex gap-2">
                  <input
                    type="text"
                    value={askQuestion}
                    onChange={(e) => setAskQuestion(e.target.value)}
                    placeholder="How was I feeling last month?"
                    className={`flex-1 ${inputInsetClass}`}
                  />
                  <button
                    type="submit"
                    disabled={askLoading || !askQuestion.trim()}
                    className="flex-shrink-0 w-10 h-10 rounded-neu-lg bg-surface-container-low text-tertiary shadow-neu-xs hover:shadow-neu-inset-sm transition-all disabled:opacity-50 flex items-center justify-center"
                  >
                    {askLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                  </button>
                </form>
                {askError && <p className="text-xs text-neu-error">{askError}</p>}
                {askAnswer && (
                  <div className="bg-surface-container rounded-neu-lg shadow-neu-inset-sm p-3 flex flex-col gap-2">
                    <p className="text-xs text-on-surface leading-relaxed">{askAnswer.answer}</p>
                    {askAnswer.sources?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-outline-variant/20">
                        {askAnswer.sources.map((s) => (
                          <button
                            key={s.date}
                            onClick={() => setSelectedDate(s.date)}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-low text-tertiary shadow-neu-xs transition-all"
                            title="Jump to this entry"
                          >
                            {s.date}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ================= RIGHT: STATS & RECENT ENTRIES (4 cols) ================= */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          {/* Stats */}
          {stats && (
            <div className="w-full bg-surface-container-low rounded-neu-xl shadow-neu-lg p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant uppercase font-semibold tracking-wider">
                  Mind Metrics
                </span>
                <BarChart3 size={16} className="text-primary" />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-neu-lg bg-surface-container-low shadow-neu-sm p-2.5 flex flex-col items-center justify-center">
                  <span className="font-display text-lg text-on-surface font-bold leading-tight">
                    {stats.totalEntries}
                  </span>
                  <span className="text-[11px] text-on-surface-variant mt-1">Entries</span>
                </div>
                <div className="rounded-neu-lg bg-surface-container text-secondary shadow-neu-inset-sm p-2.5 flex flex-col items-center justify-center">
                  <div className="flex items-center gap-0.5">
                    <span className="font-display text-lg text-secondary font-bold leading-tight">
                      {stats.streak}
                    </span>
                    <Flame size={13} />
                  </div>
                  <span className="text-[11px] text-secondary font-semibold mt-1">Day Streak</span>
                </div>
                <div className="rounded-neu-lg bg-surface-container-low shadow-neu-sm p-2.5 flex flex-col items-center justify-center">
                  <span className="font-display text-lg text-on-surface font-bold leading-tight">
                    {stats.totalWords.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-on-surface-variant mt-1">Words</span>
                </div>
              </div>
              {stats.moodCounts && Object.keys(stats.moodCounts).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {MOODS.filter((m) => stats.moodCounts[m.id]).map((m) => (
                    <span
                      key={m.id}
                      className={`text-xs px-2 py-0.5 rounded-full bg-surface-container-low shadow-neu-xs ${m.color}`}
                    >
                      {m.emoji} {stats.moodCounts[m.id]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recent entries */}
          <div className="w-full bg-surface-container-low rounded-neu-xl shadow-neu-lg p-4 flex flex-col gap-2 max-h-80 overflow-y-auto">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2 sticky top-0 bg-surface-container-low pb-1">
              <FileText size={15} className="text-tertiary" /> Recent Entries
            </h3>
            {allEntries.length === 0 ? (
              <p className="text-xs text-on-surface-variant text-center py-4">
                No entries yet. Start writing!
              </p>
            ) : (
              allEntries.slice(0, 20).map((e) => {
                const m = getMoodConfig(e.mood);
                const isSel = selectedDate === e.date;
                return (
                  <button
                    key={e.date}
                    onClick={() => setSelectedDate(e.date)}
                    className={`w-full text-left px-3 py-2 rounded-neu-lg transition-all text-xs flex items-center gap-2 ${
                      isSel ? 'shadow-neu-inset-sm' : 'hover:shadow-neu-inset-sm'
                    }`}
                  >
                    <span className="text-base">{m.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-on-surface truncate">
                        {e.title || 'Untitled Entry'}
                      </div>
                      <div className="text-on-surface-variant">
                        {e.date} · {e.wordCount} words
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Mini calendar */}
          <div className="w-full bg-surface-container-low rounded-neu-xl shadow-neu-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() =>
                  setCalMonth((p) => {
                    const d = new Date(p.year, p.month - 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })
                }
                className="w-8 h-8 rounded-full bg-surface-container-low shadow-neu-xs hover:shadow-neu-inset-sm flex items-center justify-center text-on-surface-variant transition-all"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm font-bold text-on-surface">
                {new Date(calMonth.year, calMonth.month).toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <button
                onClick={() =>
                  setCalMonth((p) => {
                    const d = new Date(p.year, p.month + 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })
                }
                className="w-8 h-8 rounded-full bg-surface-container-low shadow-neu-xs hover:shadow-neu-inset-sm flex items-center justify-center text-on-surface-variant transition-all"
              >
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-on-surface-variant mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {Array(firstDay)
                .fill(null)
                .map((_, i) => (
                  <div key={'e' + i} />
                ))}
              {Array(daysInMonth)
                .fill(null)
                .map((_, i) => {
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
                      className={`aspect-square rounded-neu text-xs flex flex-col items-center justify-center relative transition-all
                      ${
                        isSelected
                          ? 'bg-primary text-on-primary font-bold shadow-neu-xs'
                          : isToday
                            ? 'shadow-neu-inset-xs text-primary'
                            : 'hover:shadow-neu-inset-xs text-on-surface-variant'
                      }`}
                    >
                      {day}
                      {hasEntry && !isSelected && (
                        <span
                          className={`absolute bottom-0.5 w-1 h-1 rounded-full ${moodCfg?.color.replace('text-', 'bg-').split(' ')[0] || 'bg-primary'}`}
                        />
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Diary;
