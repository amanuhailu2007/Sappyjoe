/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (title: string, message?: string, type?: ToastType, duration?: number) => void;
  success: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((title: string, message?: string, type: ToastType = 'info', duration: number = 3500) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: Toast = { id, title, message, type, duration };
    setToasts(prev => [...prev.slice(-4), newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((title: string, message?: string) => showToast(title, message, 'success'), [showToast]);
  const warning = useCallback((title: string, message?: string) => showToast(title, message, 'warning'), [showToast]);
  const error = useCallback((title: string, message?: string) => showToast(title, message, 'error'), [showToast]);
  const info = useCallback((title: string, message?: string) => showToast(title, message, 'info'), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, warning, error, info }}>
      {children}
      {/* Toast floating container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => {
          let bg = 'bg-white border-[#DCE8DC] text-[#14391A]';
          let icon = <Info className="w-5 h-5 text-[#228B22] shrink-0" />;

          if (t.type === 'success') {
            bg = 'bg-[#F6FAF6] border-[#228B22]/30 text-[#14391A]';
            icon = <CheckCircle2 className="w-5 h-5 text-[#228B22] shrink-0" />;
          } else if (t.type === 'warning') {
            bg = 'bg-amber-50 border-amber-200 text-amber-900';
            icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
          } else if (t.type === 'error') {
            bg = 'bg-red-50 border-red-200 text-red-900';
            icon = <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />;
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg flex items-start gap-3 transition-all transform animate-in slide-in-from-top-2 ${bg}`}
              role="alert"
            >
              {icon}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.message && <p className="text-xs opacity-90 mt-0.5">{t.message}</p>}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 hover:bg-black/5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                aria-label="Close alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
