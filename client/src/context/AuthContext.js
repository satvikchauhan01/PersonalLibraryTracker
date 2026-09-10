import React, { createContext, useState, useEffect } from 'react';
import api, { setAccessToken } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, try a silent refresh — the httpOnly cookie may still be valid
  // from a previous session even though we hold no access token in memory yet.
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        setAccessToken(data.accessToken);
        const me = await api.get('/auth/me');
        setUser(me.data);
      } catch (e) {
        // No valid session — normal for a logged-out visitor
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAccessToken(data.accessToken);
      setUser(data);
      return true;
    } catch (error) {
      console.error('Login failed', error.response?.data);
      throw new Error(error.response?.data?.message || 'Login Failed');
    }
  };

  const register = async (userData) => {
    try {
      const { data } = await api.post('/auth/register', userData);
      setAccessToken(data.accessToken);
      setUser(data);
      return true;
    } catch (error) {
      console.error('Registration failed', error.response?.data);
      throw new Error(error.response?.data?.message || 'Registration Failed');
    }
  };

  // Update user profile (called from Profile page)
  const updateUser = async (profileData) => {
    try {
      const { data } = await api.put('/auth/update-profile', profileData);
      setUser((prev) => ({ ...prev, ...data }));
      return data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Update failed');
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // ignore — logging out client-side regardless
    }
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
