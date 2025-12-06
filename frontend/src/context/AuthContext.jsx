import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('woy_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('woy_token'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token && !user) {
      api
        .get('/auth/me')
        .then((res) => setUser(res.data.user))
        .catch(() => {
          setToken(null);
          localStorage.removeItem('woy_token');
          localStorage.removeItem('woy_user');
        });
    }
  }, [token, user]);

  const login = (data) => {
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('woy_user', JSON.stringify(data.user));
    localStorage.setItem('woy_token', data.token);
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {
      // abaikan error logout backend
    });

    setUser(null);
    setToken(null);
    localStorage.removeItem('woy_user');
    localStorage.removeItem('woy_token');
  };

  const value = { user, token, login, logout, loading, setLoading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
