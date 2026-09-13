import api from './api';

export const getOverview = (year) => api.get('/analytics/overview', { params: { year } });
