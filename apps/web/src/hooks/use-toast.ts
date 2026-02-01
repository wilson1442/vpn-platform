'use client';

import { useState, useCallback } from 'react';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastIdCounter = 0;
let globalAddToast: ((toast: Omit<Toast, 'id'>) => void) | null = null;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = String(++toastIdCounter);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  globalAddToast = addToast;

  return { toasts, toast: addToast };
}

export function toast(props: Omit<Toast, 'id'>) {
  globalAddToast?.(props);
}
