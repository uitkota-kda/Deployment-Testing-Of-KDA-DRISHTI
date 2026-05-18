import React, { createContext, useState, useEffect, useContext } from 'react';
import { CONFIG } from '../config';
import { api } from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
      if (storedUser && !storedUser.token) {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        return null;
      }
      return storedUser;
    } catch (e) {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      return null;
    }
  });

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const login = (authData) => {
    const { token, user: userData } = authData;
    const fullUserData = { ...userData, token };
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(fullUserData));
    setUser(fullUserData);
  };

  const logout = () => {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, theme, toggleTheme }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
