import api from './api';

export const searchUsers = (q) => api.get('/friends/search', { params: { q } });
export const getFriends = () => api.get('/friends');
export const getPendingRequests = () => api.get('/friends/requests');
export const sendFriendRequest = (userId) => api.post(`/friends/request/${userId}`);
export const acceptFriendRequest = (requestId) => api.post(`/friends/accept/${requestId}`);
export const declineFriendRequest = (requestId) => api.post(`/friends/decline/${requestId}`);
export const unfriend = (userId) => api.delete(`/friends/${userId}`);
