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
import { cambioDe, diaDeEntrada, filtrarAuditoria, horaDeEntrada } from '@/lib/auditoria';
import { diaOperativo, fechaCortaHN } from '@/lib/fecha';

type BadgeTone = 'accent' | 'info' | 'success';
const ROLE_TONES: Record<string, BadgeTone> = { Operador: 'accent', Administrador: 'info', Admin: 'info', Supervisor: 'success' };

const selectStyle = { padding: '8px 12px', borderRadius: 9, border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: 'white' } as const;

export default function AuditoriaScreen() {
  // auditLog llega ordenado por `at` (o date+timestamp en entradas viejas), más reciente primero.
  const { auditLog } = useApp();
  const toast = useToast();
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const users = useMemo(() => Array.from(new Set(auditLog.map(a => a.userName))).sort(), [auditLog]);
  const actions = useMemo(() => Array.from(new Set(auditLog.map(a => a.action))).sort(), [auditLog]);

  const filtered = useMemo(
    () => filtrarAuditoria(auditLog, { fecha: filterDate || undefined, usuario: filterUser || undefined, accion: filterAction || undefined }),
    [auditLog, filterUser, filterAction, filterDate],
  );

  const fechaMostrar = (a: (typeof auditLog)[number]) => { const d = diaDeEntrada(a); return d ? fechaCortaHN(d) : a.date; };

  const exportExcel = () => {
    const rows = filtered.map(a => ({
      'Fecha': fechaMostrar(a),
      'Hora': horaDeEntrada(a),
      'Usuario': a.userName,
      'Rol': a.userRole,
      'Acción': a.action,
      'Objetivo': a.target,
      'Detalle': a.detail,
      'Antes': a.before ?? '',
      'Después': a.after ?? '',
      'Motivo': a.reason ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoría');
    const nombre = `Auditoria_${filterDate || diaOperativo()}.xlsx`;
    XLSX.writeFile(wb, nombre);
    toast.success('Excel exportado', `${nombre} descargado.`);
  };

  const hayFiltro = !!(filterUser || filterAction || filterDate);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Auditoría</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', letterSpacing: -0.2 }}>
              {filterDate ? `Movimientos del ${fechaCortaHN(filterDate)}` : 'Historial completo'} · {filtered.length} registro{filtered.length !== 1 && 's'}
            </div>
          </div>
          <input type="date" aria-label="Filtrar por fecha" value={filterDate} max={diaOperativo()} onChange={e => setFilterDate(e.target.value)} style={selectStyle}/>
          <select aria-label="Filtrar por usuario" value={filterUser} onChange={e => setFilterUser(e.target.value)} style={selectStyle}>
            <option value="">Todos los usuarios</option>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <select aria-label="Filtrar por acción" value={filterAction} onChange={e => setFilterAction(e.target.value)} style={selectStyle}>
            <option value="">Todas las acciones</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {hayFiltro && <Button variant="ghost" size="sm" onClick={() => { setFilterDate(''); setFilterUser(''); setFilterAction(''); }}>Limpiar</Button>}
          <Button variant="secondary" icon="download" size="sm" onClick={exportExcel} disabled={filtered.length === 0}>Exportar</Button>
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No hay entradas que coincidan con los filtros.</div>
          )}
          {filtered.map((a, i) => {
            const tone = ROLE_TONES[a.userRole] || 'accent';
            const cambio = cambioDe(a);
            return (
              <div key={a.id || i} style={{
                display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) 200px 110px',
                gap: 14, padding: '14px 18px', alignItems: 'center',
                borderTop: i ? '1px solid #f1f5f9' : undefined,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f1f5f9', color: '#0f1f3d', display: 'grid', placeItems: 'center' }}>
                  <Icon name={a.icon} size={16}/>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {a.action} · <span style={{ color: '#475569', fontWeight: 600 }}>{a.target}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, fontFamily: 'ui-monospace, monospace', overflowWrap: 'anywhere' }}>{a.detail}</div>
                  {cambio && (
                    <div style={{ fontSize: 11.5, color: '#0f172a', marginTop: 4, fontFamily: 'ui-monospace, monospace', overflowWrap: 'anywhere' }}>
                      <span style={{ color: '#94a3b8' }}>Antes → después:</span> {cambio}
                    </div>
                  )}
                  {a.reason && (
                    <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 4 }}><b>Motivo:</b> {a.reason}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={a.userName} color="#0f1f3d" size={28}/>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{a.userName}</div>
                    <Badge tone={tone} size="sm">{a.userRole}</Badge>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>
                  <div style={{ fontSize: 11.5, color: '#475569' }}>{fechaMostrar(a)}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{horaDeEntrada(a)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
