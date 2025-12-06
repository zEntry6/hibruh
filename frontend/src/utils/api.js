import axios from 'axios';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const SOCKET_BASE =
  import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const API_BASE_URL = API_BASE;
export const SOCKET_URL = SOCKET_BASE;

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('woy_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    const status = error?.response?.status;
    const url = originalRequest?.url || '';

    if (
      status === 401 &&
      !url.endsWith('/auth/login') &&
      !url.endsWith('/auth/register') &&
      !url.endsWith('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = api
            .post('/auth/refresh')
            .then((res) => {
              const newToken = res.data?.token;
              if (newToken) {
                localStorage.setItem('woy_token', newToken);
              } else {
                localStorage.removeItem('woy_token');
              }
              return newToken;
            })
            .finally(() => {
              isRefreshing = false;
            });
        }

        const newToken = await refreshPromise;

        if (!newToken) {
          // gagal refresh → paksa logout client
          localStorage.removeItem('woy_token');
          localStorage.removeItem('woy_user');
          if (typeof window !== 'undefined') {
            window.location.href = '/auth';
          }
          return Promise.reject(error);
        }

        // Authorization header akan di-set ulang oleh request interceptor
        return api(originalRequest);
      } catch (refreshErr) {
        localStorage.removeItem('woy_token');
        localStorage.removeItem('woy_user');
        if (typeof window !== 'undefined') {
          window.location.href = '/auth';
        }
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);
