import api from './api';

// Session storage key for the diary token (not localStorage – cleared on tab close)
const DIARY_TOKEN_KEY = 'diary_token';

// ── Token helpers ──────────────────────────────────────────────────────────

export const saveDiaryToken = (token) => {
  sessionStorage.setItem(DIARY_TOKEN_KEY, token);
};

export const getDiaryToken = () => {
  return sessionStorage.getItem(DIARY_TOKEN_KEY);
};

export const clearDiaryToken = () => {
  sessionStorage.removeItem(DIARY_TOKEN_KEY);
};

// Returns the axios config with x-diary-token header if token exists
const diaryHeaders = () => {
  const token = getDiaryToken();
  return token ? { headers: { 'x-diary-token': token } } : {};
};

// ── Lock / PIN management ──────────────────────────────────────────────────

export const getPinStatus = () => api.get('/diary/lock/status');

export const setupPin = (pin) => api.post('/diary/lock/setup-pin', { pin });

export const verifyPin = async (pin) => {
  const { data } = await api.post('/diary/lock/verify-pin', { pin });
  if (data.diaryToken) {
    saveDiaryToken(data.diaryToken);
  }
  return data;
};

export const disablePin = (pin) => api.post('/diary/lock/disable', { pin });

export const lockDiary = () => {
  clearDiaryToken();
};

// ── Entries ────────────────────────────────────────────────────────────────

export const getEntries = () =>
  api.get('/diary/entries', diaryHeaders());

export const getEntryByDate = (date) =>
  api.get(`/diary/entries/${date}`, diaryHeaders());

export const saveEntry = (date, entryData) =>
  api.put(`/diary/entries/${date}`, entryData, diaryHeaders());

export const deleteEntry = (date) =>
  api.delete(`/diary/entries/${date}`, diaryHeaders());

// ── Stats ──────────────────────────────────────────────────────────────────

export const getDiaryStats = () =>
  api.get('/diary/stats', diaryHeaders());

// ── AI Prompt ──────────────────────────────────────────────────────────────

export const getWritingPrompt = () => api.get('/diary/prompt');
