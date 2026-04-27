'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
import * as XLSX from 'xlsx';
import { useToast } from '@/contexts/ToastContext';

type BadgeTone = 'accent' | 'info' | 'success';
const ROLE_TONES: Record<string, BadgeTone> = { Operador: 'accent', Admin: 'info', Supervisor: 'success' };

const USER_COLORS: Record<string, string> = {
  'Marlon Aguilar': '#f59e0b',
  'Cinthia López': '#3b82f6',
  'Daniel Ortez': '#10b981',
};

export default function AuditoriaScreen() {
  const { auditLog } = useApp();
  const toast = useToast();
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const users = Array.from(new Set(auditLog.map(a => a.userName)));
  const actions = Array.from(new Set(auditLog.map(a => a.action)));

  const filtered = useMemo(() => {
    return auditLog.filter(a => {
      if (filterUser && a.userName !== filterUser) return false;
      if (filterAction && a.action !== filterAction) return false;
      return true;
    });
  }, [auditLog, filterUser, filterAction]);

  const exportExcel = () => {
    const rows = filtered.map(a => ({
      'Fecha': a.date,
      'Hora': a.timestamp,
      'Usuario': a.userName,
      'Rol': a.userRole,
      'Acción': a.action,
      'Objetivo': a.target,
      'Detalle': a.detail,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoría');
    XLSX.writeFile(wb, 'Auditoria_26-04-2026.xlsx');
    toast.success('Excel exportado', 'Auditoria_26-04-2026.xlsx descargado.');
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Auditoría</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', letterSpacing: -0.2 }}>Historial completo · 26 abr 2026</div>
          </div>
          <select
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: 'white' }}
          >
            <option value="">Todos los usuarios</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: 'white' }}
          >
            <option value="">Todas las acciones</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <Button variant="secondary" icon="download" size="sm" onClick={exportExcel}>Exportar</Button>
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No hay entradas que coincidan con los filtros.</div>
          )}
          {filtered.map((a, i) => {
            const color = USER_COLORS[a.userName] || '#0f1f3d';
            const tone = ROLE_TONES[a.userRole] || 'accent';
            return (
              <div key={a.id || i} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr 200px 140px 80px',
                gap: 14, padding: '14px 18px', alignItems: 'center',
                borderTop: i ? '1px solid #f1f5f9' : undefined,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f1f5f9', color: '#0f1f3d', display: 'grid', placeItems: 'center' }}>
                  <Icon name={a.icon} size={16}/>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {a.action} · <span style={{ color: '#475569', fontWeight: 600 }}>{a.target}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>{a.detail}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={a.userName} color={color} size={28}/>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{a.userName}</div>
                    <Badge tone={tone} size="sm">{a.userRole}</Badge>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', fontFamily: 'ui-monospace, monospace' }}>{a.date}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'ui-monospace, monospace', textAlign: 'right' }}>{a.timestamp}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
