import axios from 'axios';
import { CONFIG } from '../config';

const API_BASE = CONFIG.API_BASE_URL;

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(config => {
  try {
    const user = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY));
    if (user && user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
  } catch (e) {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
  }

  if (!config.url.startsWith('/api') && !config.url.startsWith('http')) {
    config.url = '/api' + config.url;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');

    if (!isLoginRequest && (error.response?.status === 401 || error.response?.status === 403)) {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }

    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'System error occurred';
    return Promise.reject({ message, ...error.response?.data });
  }
);
