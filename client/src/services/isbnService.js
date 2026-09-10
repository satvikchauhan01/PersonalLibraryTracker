import api from './api';

/**
 * Look up a book by ISBN via the backend (which proxies Google Books / Open Library).
 *
 * @param {string} isbn  Raw ISBN string (hyphens/spaces ok; backend strips them)
 * @returns {{ title, author, genre, coverUrl, isbn }} Pre-fill data
 * @throws Axios error with response.status === 404 if not found
 */
export const lookupIsbn = async (isbn) => {
  const { data } = await api.get(`/external/isbn/${encodeURIComponent(isbn.trim())}`);
  return data;
};
