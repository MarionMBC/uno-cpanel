'use client';

import Icon from './Icon';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'primary';

interface BadgeProps {
  tone?: BadgeTone;
  size?: 'sm' | 'lg';
  children: React.ReactNode;
  dot?: boolean;
  icon?: string;
}

const TONES: Record<BadgeTone, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: '#eef0f3', fg: '#475569', dot: '#94a3b8' },
  success: { bg: '#dcfce7', fg: '#166534', dot: '#22c55e' },
  warning: { bg: '#fef3c7', fg: '#854d0e', dot: '#f59e0b' },
  danger:  { bg: '#fee2e2', fg: '#991b1b', dot: '#ef4444' },
  info:    { bg: '#dbeafe', fg: '#1e40af', dot: '#3b82f6' },
  accent:  { bg: '#fff4d6', fg: '#7c4a03', dot: '#d97706' },
  primary: { bg: '#e0e7ff', fg: '#312e81', dot: '#4f46e5' },
};

export default function Badge({ tone = 'neutral', size = 'sm', children, dot, icon }: BadgeProps) {
  const t = TONES[tone];
  const pad = size === 'lg' ? '5px 10px' : '2px 8px';
  const fs = size === 'lg' ? 12 : 11;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: t.bg, color: t.fg, padding: pad, borderRadius: 999,
      fontSize: fs, fontWeight: 600, letterSpacing: 0.1, lineHeight: 1.3,
      whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: t.dot, flexShrink: 0 }} />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}
