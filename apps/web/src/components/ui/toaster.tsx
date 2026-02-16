'use client';

import { useToast } from '@/hooks/use-toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-slide-in rounded-xl border px-4 py-3 shadow-xl backdrop-blur-xl transition-all ${
            toast.variant === 'destructive'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
              : 'border-border/50 bg-background/95 text-foreground'
          }`}
        >
          {toast.title && <p className="font-semibold">{toast.title}</p>}
          {toast.description && <p className="text-sm opacity-90">{toast.description}</p>}
        </div>
      ))}
    </div>
  );
}
