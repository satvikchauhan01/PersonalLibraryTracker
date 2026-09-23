import api from './api';

export const getAdminStats = () => api.get('/auth/admin/stats');

export const listUsers = (params) => api.get('/auth/admin/users', { params });

export const updateUserRole = (id, role) => api.patch(`/auth/admin/users/${id}/role`, { role });

export const updateUserBanStatus = (id, isBanned, reason) =>
  api.patch(`/auth/admin/users/${id}/ban`, { isBanned, reason });
