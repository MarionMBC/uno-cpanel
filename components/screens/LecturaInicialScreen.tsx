'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import TextField from '@/components/ui/TextField';
import ConfirmDialog from '@/components/overlays/ConfirmDialog';
import { Dispenser } from '@/types';

interface ReadingValue {
  value: string;
  status: 'activo' | 'mantenimiento';
  obs: string;
}

export default function LecturaInicialScreen() {
  const { pumps, dayStatus, addAuditEntry } = useApp();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const activePumps = pumps.filter(p => p.isActive);
  const allDisp: Dispenser[] = activePumps.flatMap(p => p.faces.flatMap(f => f.dispensers));

  const [values, setValues] = useState<Record<string, ReadingValue>>(() => {
    const o: Record<string, ReadingValue> = {};
    allDisp.forEach(d => { o[d.id] = { value: (120000 + Math.floor(Math.random() * 60000)).toFixed(2), status: d.status === 'inactivo' ? 'activo' : d.status, obs: '' }; });
    return o;
  });

  const isClosed = dayStatus === 'cerrado';
  const completed = Object.values(values).filter(v => v.value && v.status === 'activo').length;
  const total = allDisp.filter(d => d.status === 'activo').length;

  const handleConfirm = () => {
    addAuditEntry({
      timestamp: new Date().toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }),
      date: '26/04/2026',
      userId: 'current',
      userName: 'Operador',
      userRole: 'Operador',
      action: 'Lectura inicial',
      target: `${completed} dispensadores`,
      detail: `Registradas para el día actual`,
      icon: 'log-in',
    });
    toast.success('Lecturas iniciales registradas', `${completed} dispensadores actualizados correctamente.`);
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ background: 'linear-gradient(135deg,#0a1530,#14275a)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Inicio del día · 26 abr 2026</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, letterSpacing: -0.3 }}>Registrar lectura inicial</div>
            <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 4 }}>Captura la lectura del totalizador antes de abrir cada dispensador.</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' }}>Progreso</div>
            <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#fbbf24', letterSpacing: -0.4 }}>
              {completed}<span style={{ color: '#94a3b8', fontSize: 18 }}> / {total}</span>
            </div>
            <div style={{ width: 200, height: 6, background: 'rgba(255,255,255,.12)', borderRadius: 999, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%`, height: '100%', background: '#fbbf24', transition: 'width .3s' }}/>
            </div>
          </div>
        </div>
      </Card>

      {activePumps.map((p) => (
        <Card key={p.id} padding={0}>
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: p.fuel.color + '22', color: p.fuel.color, display: 'grid', placeItems: 'center' }}>
                <Icon name="fuel" size={18}/>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>{p.fuel.name} · 2 caras · 6 dispensadores</div>
              </div>
            </div>
            <Badge tone="success" icon="check">Listo para abrir</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {p.faces.map((face, fi) => (
              <div key={face.id} style={{ padding: 18, borderRight: fi === 0 ? '1px solid #f1f5f9' : undefined }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#0f1f3d', color: '#fbbf24', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{face.id}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', letterSpacing: 0.3, textTransform: 'uppercase' }}>Cara {face.id}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {face.dispensers.map((d) => {
                    const v = values[d.id] || { value: '', status: 'activo', obs: '' };
                    const isMaint = v.status === 'mantenimiento';
                    return (
                      <div key={d.id} style={{
                        display: 'grid', gridTemplateColumns: '70px 1fr 130px',
                        gap: 10, alignItems: 'center',
                        padding: 10,
                        background: isMaint ? '#fef3c7' : '#f8fafc',
                        borderRadius: 10,
                        border: isMaint ? '1px dashed #f59e0b' : '1px solid #eef0f3',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'white', boxShadow: '0 0 0 1px #e2e8f0', fontSize: 10.5, fontWeight: 800, color: '#0f1f3d', display: 'grid', placeItems: 'center' }}>D{d.name.slice(-1)}</div>
                        </div>
                        <TextField
                          prefix="L"
                          value={v.value}
                          onChange={(val) => setValues(s => ({ ...s, [d.id]: { ...s[d.id], value: val } }))}
                          suffix="ltrs"
                          disabled={isMaint || isClosed}
                        />
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['activo', 'mantenimiento'] as const).map((st) => (
                            <button key={st} onClick={() => setValues(s => ({ ...s, [d.id]: { ...s[d.id], status: st } }))}
                              disabled={isClosed}
                              style={{
                                flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 10.5, fontWeight: 700,
                                fontFamily: 'inherit', cursor: isClosed ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: 0.4, border: 0,
                                background: v.status === st ? (st === 'activo' ? '#dcfce7' : '#fef3c7') : 'white',
                                color: v.status === st ? (st === 'activo' ? '#166534' : '#854d0e') : '#94a3b8',
                                boxShadow: v.status === st ? 'none' : '0 0 0 1px #e2e8f0',
                              }}>{st === 'activo' ? 'Activo' : 'Mant.'}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px' }}>
        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="info" size={12} style={{ verticalAlign: -2 as any }}/> No se permite registrar dos lecturas iniciales para el mismo dispensador y fecha.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => toast.info('Borrador guardado', 'Puedes continuar más tarde sin perder datos.')}>Guardar borrador</Button>
          <Button variant="primary" icon="check" onClick={() => setConfirmOpen(true)} disabled={isClosed}>Confirmar lectura inicial</Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar lectura inicial del día"
        message={`Vas a registrar ${completed} lecturas iniciales para el 26/04/2026. Una vez confirmadas no se podrán duplicar para esta fecha.`}
        confirmLabel="Sí, confirmar lecturas"
        icon="log-in"
        tone="primary"
        onConfirm={handleConfirm}
      />
    </div>
  );
}
