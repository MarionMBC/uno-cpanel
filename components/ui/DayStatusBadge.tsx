'use client';

import Badge from './Badge';
import { DayStatusValue } from '@/types';

interface Props {
  status: DayStatusValue;
}

const MAP: Record<DayStatusValue, { tone: 'neutral' | 'warning' | 'success'; label: string; icon: string }> = {
  pendiente:  { tone: 'neutral', label: 'Pendiente', icon: 'history' },
  en_proceso: { tone: 'warning', label: 'En proceso', icon: 'gauge' },
  cerrado:    { tone: 'success', label: 'Cerrado', icon: 'lock' },
};

export default function DayStatusBadge({ status }: Props) {
  const m = MAP[status] || MAP.pendiente;
  return <Badge tone={m.tone} icon={m.icon} size="lg" dot>{m.label}</Badge>;
}
