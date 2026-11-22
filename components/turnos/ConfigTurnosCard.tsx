'use client';

// B1 (TASK-019): settings/operacion — zona, plantillas de turno y flag shiftsEnabled.
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { PlantillaTurno } from '@/types';
import { validarPlantillas } from '@/lib/turnos';
import { guardarOperacion } from '@/lib/turnosDb';

const input: React.CSSProperties = { height: 34, border: '1px solid #e2e8f0', borderRadius: 8, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', minWidth: 0 };

export default function ConfigTurnosCard() {
  const { operacion, addAuditEntry, roles } = useApp();
  const { appUser } = useAuth();
  const toast = useToast();
  const [borrador, setBorrador] = useState<PlantillaTurno[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const plantillas = borrador ?? operacion.shiftTemplates;
  const errores = validarPlantillas(plantillas);

  const cambiar = (i: number, k: keyof PlantillaTurno, v: string) =>
    setBorrador(plantillas.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  const auditar = (action: string, detail: string) => addAuditEntry({
    timestamp: new Date().toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    userId: appUser?.uid || 'unknown', userName: appUser?.name || 'Sistema',
    userRole: roles.find(r => r.id === appUser?.roleId)?.name || 'Desconocido',
    action, target: 'settings/operacion', detail, icon: 'settings',
  }).catch(e => console.error(e));

  const guardar = async (shiftsEnabled: boolean) => {
    if (errores.length > 0) { toast.error('Turnos inválidos', errores[0]); return; }
    setGuardando(true);
    try {
      await guardarOperacion({ timeZone: operacion.timeZone, shiftsEnabled, shiftTemplates: plantillas });
      setBorrador(null);
      toast.success('Turnos guardados', shiftsEnabled ? 'Turnos activados: menú "Turnos".' : 'Turnos desactivados: la app trabaja por día.');
      auditar(shiftsEnabled !== operacion.shiftsEnabled ? (shiftsEnabled ? 'Turnos activados' : 'Turnos desactivados') : 'Plantillas de turno',
        plantillas.map(p => `${p.id} ${p.name} ${p.start}–${p.end}`).join(' · '));
    } catch (e) {
      console.error(e);
      toast.error('No se guardó', 'Revisa tu permiso y la conexión.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="users" size={18} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Turnos y arqueo por bombero</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Zona {operacion.timeZone}. Apagado, la app trabaja por día como siempre.</div>
          </div>
        </div>
        <Badge tone={operacion.shiftsEnabled ? 'success' : 'neutral'} dot>{operacion.shiftsEnabled ? 'Activados' : 'Desactivados'}</Badge>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plantillas.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 90px 90px 34px', gap: 8, alignItems: 'center' }}>
            <input aria-label="Código" style={input} value={p.id} onChange={e => cambiar(i, 'id', e.target.value)} />
            <input aria-label="Nombre" style={input} value={p.name} onChange={e => cambiar(i, 'name', e.target.value)} />
            <input aria-label="Inicio" type="time" style={input} value={p.start} onChange={e => cambiar(i, 'start', e.target.value)} />
            <input aria-label="Fin" type="time" style={input} value={p.end} onChange={e => cambiar(i, 'end', e.target.value)} />
            <Button variant="ghost" size="sm" icon="trash" onClick={() => setBorrador(plantillas.filter((_, j) => j !== i))} disabled={plantillas.length <= 1} />
          </div>
        ))}
      </div>
      {errores.length > 0 && <div style={{ marginTop: 8, fontSize: 12, color: '#b91c1c' }}>{errores[0]}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button variant="secondary" size="sm" icon="plus" onClick={() => setBorrador([...plantillas, { id: `T${plantillas.length + 1}`, name: 'Nuevo', start: '00:00', end: '06:00' }])}>Agregar turno</Button>
        <Button variant="primary" size="sm" icon="check" disabled={guardando || borrador === null} onClick={() => guardar(operacion.shiftsEnabled)}>Guardar plantillas</Button>
        <Button variant={operacion.shiftsEnabled ? 'danger' : 'accent'} size="sm" disabled={guardando} onClick={() => guardar(!operacion.shiftsEnabled)}>
          {operacion.shiftsEnabled ? 'Desactivar turnos' : 'Activar turnos'}
        </Button>
      </div>
    </Card>
  );
}
