import api from './api';

export const getShelves = () => api.get('/shelves');
export const getShelf = (shelfId) => api.get(`/shelves/${shelfId}`);
export const createShelf = (name) => api.post('/shelves', { name });
export const renameShelf = (shelfId, name) => api.put(`/shelves/${shelfId}`, { name });
export const deleteShelf = (shelfId) => api.delete(`/shelves/${shelfId}`);
export const addBookToShelf = (shelfId, bookId) => api.post(`/shelves/${shelfId}/books/${bookId}`);
export const removeBookFromShelf = (shelfId, bookId) =>
  api.delete(`/shelves/${shelfId}/books/${bookId}`);
