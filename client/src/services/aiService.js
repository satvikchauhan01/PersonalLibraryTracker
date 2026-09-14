import api from './api';
import { getDiaryToken } from './diaryService';

// Phase 18: AI stretch features

export const getSimilarBooks = (bookId) => api.get(`/books/${bookId}/similar`);

export const getBookSummary = (bookId) => api.post(`/ai/summary/${bookId}`);

export const getHabitInsights = (year) => api.get('/ai/habits', { params: { year } });

export const reviewAssist = (bookId, bulletPoints) =>
  api.post('/ai/review-assist', { bookId, bulletPoints });

export const aiSearch = (query) => api.post('/ai/search', { query });

// Diary lock header — same pattern as diaryService.js's own diaryHeaders(),
// duplicated (not imported) to avoid diaryService.js needing to export an
// internal helper just for this one cross-service use.
export const askDiary = (question) => {
  const token = getDiaryToken();
  return api.post('/diary/ask', { question }, token ? { headers: { 'x-diary-token': token } } : {});
};
