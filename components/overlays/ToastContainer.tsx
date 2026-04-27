'use client';

import { useToast } from '@/contexts/ToastContext';
import Icon from '@/components/ui/Icon';

const TONES = {
  success: { bar: '#16a34a', icBg: '#16a34a' },
  danger:  { bar: '#dc2626', icBg: '#dc2626' },
  warning: { bar: '#d97706', icBg: '#d97706' },
  info:    { bar: '#0f1f3d', icBg: '#0f1f3d' },
};

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 20, zIndex: 1000,
      display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none',
      maxWidth: 380, width: '100%',
    }}>
      {toasts.map((t) => {
        const c = TONES[t.tone] || TONES.info;
        return (
          <div key={t.id} style={{
            background: 'white', borderRadius: 11,
            boxShadow: '0 12px 30px rgba(15,23,42,.18), 0 0 0 1px #e2e8f0',
            padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12,
            pointerEvents: 'auto', borderLeft: `3px solid ${c.bar}`,
            animation: 'toastIn .18s cubic-bezier(.3,.7,.4,1)',
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: c.icBg, color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon name={t.icon || 'info'} size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{t.title}</div>
              {t.sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>{t.sub}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} style={{
              width: 22, height: 22, borderRadius: 6, border: 0, background: 'transparent',
              color: '#94a3b8', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <Icon name="x" size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
