import api from './api';

export const getGoals = () => api.get('/goals');
export const getGoalsProgress = () => api.get('/goals/progress');
export const createGoal = (goal) => api.post('/goals', goal);
export const updateGoal = (goalId, target) => api.put(`/goals/${goalId}`, { target });
export const deleteGoal = (goalId) => api.delete(`/goals/${goalId}`);
