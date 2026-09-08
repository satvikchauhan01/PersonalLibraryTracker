import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();
const API_URL = process.env.REACT_APP_API_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // On mount, verify stored token by fetching full profile from /api/auth/me
  useEffect(() => {
    const checkUser = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        try {
          const { data } = await axios.get(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          setUser(data);
        } catch (e) {
          console.error('Token verification failed');
          logout();
        }
      }
      setLoading(false);
    };
    checkUser();
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data);
      return true;
    } catch (error) {
      console.error('Login failed', error.response?.data);
      throw new Error(error.response?.data?.message || 'Login Failed');
    }
  };

  const register = async (userData) => {
    try {
      const { data } = await axios.post(`${API_URL}/auth/register`, userData);
      localStorage.setItem('token', data.token);
      setToken(data.token);
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
      const { data } = await axios.put(`${API_URL}/auth/update-profile`, profileData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser((prev) => ({ ...prev, ...data }));
      return data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Update failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
