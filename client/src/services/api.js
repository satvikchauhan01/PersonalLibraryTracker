import axios from 'axios';

// In-memory access token (not localStorage — shrinks XSS blast radius).
// Cleared on page reload; AuthContext re-establishes it via silent refresh.
let accessToken = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token;
};

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  withCredentials: true, // sends/receives the httpOnly refresh-token cookie
});

api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Queue concurrent requests while a single refresh call is in flight
let isRefreshing = false;
let pendingQueue = [];

const flushQueue = (error, token) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isRefreshCall = originalRequest?.url?.includes('/auth/refresh');

    if (error.response?.status !== 401 || originalRequest._retry || isRefreshCall) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await api.post('/auth/refresh');
      setAccessToken(data.accessToken);
      flushQueue(null, data.accessToken);
      originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      // Bug fix: only a definitive 401 here means the session is actually
      // invalid (the refresh cookie is missing/expired/revoked/reused) —
      // that's the one case a hard logout+redirect is correct. Any other
      // failure (429 rate-limited, a network blip, a 5xx) is transient and
      // says nothing about whether the session is still good, so don't wipe
      // the in-memory access token or force-navigate away from whatever the
      // user was doing for it — just fail this one request and let the next
      // natural retry (or the next 401) try again once the condition clears.
      if (refreshError.response?.status === 401) {
        setAccessToken(null);
        window.location.href = '/auth';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
