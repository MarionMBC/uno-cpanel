'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Toast {
  id: string;
  tone: 'success' | 'danger' | 'warning' | 'info';
  title: string;
  sub?: string;
  icon?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
  success: (title: string, sub?: string) => void;
  error: (title: string, sub?: string) => void;
  warning: (title: string, sub?: string) => void;
  info: (title: string, sub?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(s => s.filter(t => t.id !== id));
  }, []);

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const t: Toast = { id, duration: 4200, ...toast };
    setToasts(s => [...s, t]);
    if ((t.duration ?? 0) > 0) setTimeout(() => dismiss(id), t.duration);
    return id;
  }, [dismiss]);

  const success = (title: string, sub?: string) => push({ tone: 'success', title, sub, icon: 'check' });
  const error = (title: string, sub?: string) => push({ tone: 'danger', title, sub, icon: 'alert' });
  const warning = (title: string, sub?: string) => push({ tone: 'warning', title, sub, icon: 'alert' });
  const info = (title: string, sub?: string) => push({ tone: 'info', title, sub, icon: 'info' });

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss, success, error, warning, info }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
