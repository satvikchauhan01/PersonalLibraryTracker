import api from './api';

export const createSubscription = () => api.post('/payments/subscribe');
export const verifyPayment = (data) => api.post('/payments/verify', data);
export const cancelSubscription = () => api.post('/payments/cancel');
export const getPaymentStatus = () => api.get('/payments/status');
