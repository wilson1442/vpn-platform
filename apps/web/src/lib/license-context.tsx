'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';
import { api } from './api';

interface LicenseContextType {
  features: string[];
  valid: boolean;
  status: string;
  loading: boolean;
  gracePeriodEndsAt: string | null;
  locked: boolean;
  hasFeature: (slug: string) => boolean;
  refresh: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextType>({
  features: [],
  valid: false,
  status: 'no_license',
  loading: true,
  gracePeriodEndsAt: null,
  locked: false,
  hasFeature: () => false,
  refresh: async () => {},
});

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [features, setFeatures] = useState<string[]>([]);
  const [valid, setValid] = useState(false);
  const [status, setStatus] = useState('no_license');
  const [loading, setLoading] = useState(true);
  const [gracePeriodEndsAt, setGracePeriodEndsAt] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const fetchFeatures = useCallback(async () => {
    try {
      const data = await api<{ valid: boolean; status: string; features: string[]; gracePeriodEndsAt: string | null; locked: boolean }>('/license/features');
      setValid(data.valid);
      setStatus(data.status);
      setFeatures(data.features);
      setGracePeriodEndsAt(data.gracePeriodEndsAt);
      setLocked(data.locked);
    } catch {
      setValid(false);
      setStatus('no_license');
      setFeatures([]);
      setGracePeriodEndsAt(null);
      setLocked(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchFeatures();
    } else {
      setValid(false);
      setStatus('no_license');
      setFeatures([]);
      setGracePeriodEndsAt(null);
      setLocked(false);
      setLoading(false);
    }
  }, [user, fetchFeatures]);

  const hasFeature = useCallback(
    (slug: string) => valid && features.includes(slug),
    [valid, features],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchFeatures();
  }, [fetchFeatures]);

  return (
    <LicenseContext.Provider value={{ features, valid, status, loading, gracePeriodEndsAt, locked, hasFeature, refresh }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  return useContext(LicenseContext);
}
