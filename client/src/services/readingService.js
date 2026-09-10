import api from './api';

// Phase 04: Reading progress & session service

export const updateProgress = (bookId, currentPage) =>
  api.patch(`/books/${bookId}/progress`, { currentPage });

export const logSession = (bookId, data) => api.post(`/books/${bookId}/sessions`, data);

export const getSessions = (bookId) => api.get(`/books/${bookId}/sessions`);

export const getStreak = () => api.get('/reading/streak');

export const getCalendar = () => api.get('/reading/calendar');
