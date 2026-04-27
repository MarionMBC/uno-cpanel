'use client';

import React, { useEffect } from 'react';
import Icon from '@/components/ui/Icon';

type ModalTone = 'primary' | 'success' | 'danger' | 'warning' | 'info';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  iconTone?: ModalTone;
  width?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const TONES: Record<ModalTone, { bg: string; fg: string }> = {
  primary: { bg: '#0f1f3d', fg: '#fbbf24' },
  success: { bg: '#dcfce7', fg: '#16a34a' },
  danger:  { bg: '#fee2e2', fg: '#dc2626' },
  warning: { bg: '#fef3c7', fg: '#d97706' },
  info:    { bg: '#dbeafe', fg: '#1e40af' },
};

export default function Modal({ open, onClose, title, subtitle, icon, iconTone = 'primary', width = 520, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const t = TONES[iconTone];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(8,13,30,.55)',
        backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
        zIndex: 500, display: 'grid', placeItems: 'center', padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: width, background: 'white', borderRadius: 14,
          boxShadow: '0 30px 80px rgba(8,13,30,.35), 0 0 0 1px rgba(15,23,42,.06)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh',
        }}
      >
        <div style={{ padding: '18px 22px 14px', display: 'flex', alignItems: 'flex-start', gap: 14, borderBottom: '1px solid #f1f5f9' }}>
          {icon && (
            <div style={{ width: 38, height: 38, borderRadius: 10, background: t.bg, color: t.fg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon name={icon} size={18} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: -0.2 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0',
            background: 'white', cursor: 'pointer', color: '#64748b',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: '14px 22px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
