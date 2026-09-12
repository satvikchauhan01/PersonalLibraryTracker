import api from './api';

export const getQuotes = (bookId) =>
  api.get('/quotes', bookId ? { params: { book: bookId } } : undefined);
export const createQuote = (bookId, text, page) =>
  api.post('/quotes', { book: bookId, text, page: page || undefined });
export const updateQuote = (quoteId, data) => api.put(`/quotes/${quoteId}`, data);
export const deleteQuote = (quoteId) => api.delete(`/quotes/${quoteId}`);
