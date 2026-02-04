'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, setTokens, clearTokens, getStoredRefreshToken, storeAdminSession, restoreAdminSession, clearAdminSession } from './api';

interface User {
  id: string;
  username: string;
  email?: string;
  role: 'ADMIN' | 'RESELLER' | 'USER';
  resellerId?: string;
  expiresAt?: string;
  impersonatedBy?: string;
  impersonatedByEmail?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isImpersonating: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  impersonate: (targetUserId: string) => Promise<void>;
  stopImpersonating: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isImpersonating: false,
  login: async () => {},
  logout: async () => {},
  impersonate: async () => {},
  stopImpersonating: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const isImpersonating = !!user?.impersonatedBy;

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
    clearAdminSession();
    setUser(null);
  };

  const impersonate = async (targetUserId: string) => {
    // Store current admin session before impersonating
    storeAdminSession();

    // Call the impersonate endpoint
    const data = await api('/auth/impersonate', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });

    // Set the new tokens
    setTokens(data.accessToken, data.refreshToken);

    // Fetch the impersonated user's data
    await fetchMe();

    // Redirect to the appropriate dashboard based on the target user's role
    const meData = await api('/auth/me');
    if (meData.role === 'RESELLER') {
      router.push('/reseller');
    } else {
      router.push('/user');
    }
  };

  const stopImpersonating = async () => {
    const adminRt = restoreAdminSession();
    if (!adminRt) {
      // No admin session to restore, just logout
      await logout();
      return;
    }

    // Logout the impersonation session
    const rt = getStoredRefreshToken();
    if (rt) {
      try {
        await api('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: rt }),
        });
      } catch {}
    }

    // Restore admin session by refreshing with admin token
    try {
      const data = await api('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: adminRt }),
      });
      setTokens(data.accessToken, data.refreshToken);
      clearAdminSession();
      await fetchMe();
      router.push('/admin');
    } catch {
      // Admin session expired or invalid, full logout
      clearTokens();
      clearAdminSession();
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isImpersonating, login, logout, impersonate, stopImpersonating }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
