import api from './api';

// Phase 05: rating, favorite, tags, review, notes — all book-scoped

export const setRating = (bookId, rating) => api.put(`/books/${bookId}/rating`, { rating });

export const toggleFavorite = (bookId) => api.patch(`/books/${bookId}/favorite`, {});

export const setTags = (bookId, tags) => api.patch(`/books/${bookId}/tags`, { tags });

export const getReview = (bookId) => api.get(`/books/${bookId}/review`);
export const saveReview = (bookId, text) => api.post(`/books/${bookId}/review`, { text });
export const deleteReview = (bookId) => api.delete(`/books/${bookId}/review`);

export const getNote = (bookId) => api.get(`/books/${bookId}/notes`);
export const saveNote = (bookId, text) => api.post(`/books/${bookId}/notes`, { text });
