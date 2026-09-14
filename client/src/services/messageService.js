import api from './api';

export const getConversations = () => api.get('/messages/conversations');
export const getMessages = (friendId, page = 1) =>
  api.get(`/messages/${friendId}`, { params: { page } });
export const sendMessage = (friendId, text) => api.post(`/messages/${friendId}`, { text });
export const markConversationRead = (friendId) => api.post(`/messages/${friendId}/read`);
