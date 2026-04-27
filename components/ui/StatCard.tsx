'use client';

import Icon from './Icon';
import Card from './Card';

type StatTone = 'primary' | 'accent' | 'neutral' | 'success';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  tone?: StatTone;
  trend?: number;
}

const ACCENTS: Record<StatTone, { bg: string; fg: string; iconBg: string; iconFg: string }> = {
  primary: { bg: '#0f1f3d', fg: 'white', iconBg: 'rgba(255,255,255,.12)', iconFg: '#fbbf24' },
  accent:  { bg: '#fff4d6', fg: '#0f1f3d', iconBg: '#fde68a', iconFg: '#92400e' },
  neutral: { bg: 'white', fg: '#0f172a', iconBg: '#f1f5f9', iconFg: '#0f1f3d' },
  success: { bg: 'white', fg: '#0f172a', iconBg: '#dcfce7', iconFg: '#16a34a' },
};

export default function StatCard({ label, value, sub, icon, tone = 'neutral', trend }: StatCardProps) {
  const a = ACCENTS[tone];
  return (
    <Card padding={0} style={{ background: a.bg, overflow: 'hidden' }}>
      <div style={{ padding: 18, color: a.fg }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', opacity: .7 }}>{label}</span>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: a.iconBg, color: a.iconFg, display: 'grid', placeItems: 'center' }}>
            <Icon name={icon} size={16} />
          </div>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, lineHeight: 1.1 }}>{value}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, opacity: .75 }}>
          {trend != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: trend >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
              <Icon name={trend >= 0 ? 'arrow-up' : 'arrow-down'} size={12} /> {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          <span>{sub}</span>
        </div>
      </div>
    </Card>
  );
}
