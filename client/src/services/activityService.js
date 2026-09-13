import api from './api';

export const getActivityFeed = (page = 1, limit = 20) =>
  api.get('/activity/feed', { params: { page, limit } });
