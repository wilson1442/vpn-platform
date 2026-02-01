'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setTokens, clearTokens, getStoredRefreshToken } from './api';

interface User {
  id: string;
  username: string;
  email?: string;
  role: 'ADMIN' | 'RESELLER' | 'USER';
  resellerId?: string;
  expiresAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const data = await api('/auth/me');
      setUser(data);
    } catch {
      setUser(null);
      clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const rt = getStoredRefreshToken();
    if (rt) {
      // Try to refresh and get user info
      api('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: rt }),
      })
        .then((data) => {
          setTokens(data.accessToken, data.refreshToken);
          return fetchMe();
        })
        .catch(() => {
          clearTokens();
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [fetchMe]);

  const login = async (username: string, password: string) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setTokens(data.accessToken, data.refreshToken);
    await fetchMe();
  };

  const logout = async () => {
    const rt = getStoredRefreshToken();
    if (rt) {
      try {
        await api('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: rt }),
        });
      } catch {}
    }
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
