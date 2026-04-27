'use client';

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import TextField from '@/components/ui/TextField';
import PumpDiagram from '@/components/ui/PumpDiagram';
import Modal from '@/components/overlays/Modal';
import ConfirmDialog from '@/components/overlays/ConfirmDialog';
import { FUELS } from '@/lib/constants';
import { Pump, Dispenser } from '@/types';

interface DispDraft { name: string; sn: string; status: 'activo' | 'inactivo' | 'mantenimiento'; }

export default function BombasScreen() {
  const { pumps, setPumps, addAuditEntry } = useApp();
  const toast = useToast();
  const [picked, setPicked] = useState(pumps[0]?.id || '');
  const pump = pumps.find(p => p.id === picked) || pumps[0];

  const [newPumpOpen, setNewPumpOpen] = useState(false);
  const [editDispenser, setEditDispenser] = useState<{ face: string; id: string } | null>(null);
  const [addDispenserFace, setAddDispenserFace] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmDelDisp, setConfirmDelDisp] = useState<{ face: string; id: string; name: string } | null>(null);

  const [pumpDraft, setPumpDraft] = useState({ name: '', fuel: 'Súper' });
  const [dispDraft, setDispDraft] = useState<DispDraft>({ name: '', sn: '', status: 'activo' });
  const [pumpName, setPumpName] = useState(pump?.name || '');

  if (!pump) return <div style={{ padding: 24 }}>No hay bombas configuradas.</div>;

  const toggleActive = () => {
    setPumps(pumps.map(p => p.id === pump.id ? { ...p, isActive: !p.isActive } : p));
    toast.success(`${pump.name} ${pump.isActive ? 'desactivada' : 'activada'}`);
  };

  const saveChanges = () => {
    setPumps(pumps.map(p => p.id === pump.id ? { ...p, name: pumpName } : p));
    addAuditEntry({
      timestamp: new Date().toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }),
      date: '26/04/2026',
      userId: 'current',
      userName: 'Operador',
      userRole: 'Operador',
      action: 'Edición',
      target: pump.name,
      detail: 'Configuración actualizada',
      icon: 'edit',
    });
    toast.success('Cambios guardados', `${pumpName} actualizada correctamente.`);
  };

  const createPump = () => {
    if (!pumpDraft.name.trim()) { toast.error('Falta el nombre', 'Ingresa un nombre para la bomba.'); return; }
    const fuelObj = FUELS.find(f => f.name === pumpDraft.fuel) || FUELS[0];
    const newPump: Pump = {
      id: 'p' + Date.now(),
      name: pumpDraft.name,
      isActive: true,
      fuel: fuelObj,
      faces: ['A', 'B'].map(fId => ({
        id: fId,
        dispensers: [1, 2, 3].map(n => ({
          id: `p${Date.now()}-${fId}-${n}`,
          name: `Dispensador ${n}`,
          face: fId,
          pumpId: 'p' + Date.now(),
          pumpName: pumpDraft.name,
          fuel: fuelObj.id,
          fuelName: fuelObj.name,
          fuelColor: fuelObj.color,
          status: 'activo' as const,
        })),
      })),
    };
    setPumps([...pumps, newPump]);
    setNewPumpOpen(false);
    setPicked(newPump.id);
    toast.success('Bomba creada', `${pumpDraft.name} agregada con 6 dispensadores.`);
  };

  const updateDispenser = () => {
    if (!editDispenser) return;
    setPumps(pumps.map(p => p.id === pump.id ? {
      ...p,
      faces: p.faces.map(f => f.id === editDispenser.face ? {
        ...f,
        dispensers: f.dispensers.map(d => d.id === editDispenser.id ? { ...d, name: dispDraft.name, status: dispDraft.status } : d),
      } : f),
    } : p));
    setEditDispenser(null);
    toast.success('Dispensador actualizado', `${dispDraft.name} guardado correctamente.`);
  };

  const addDispenser = () => {
    if (!addDispenserFace) return;
    const faceDisps = pump.faces.find(f => f.id === addDispenserFace)?.dispensers || [];
    const newDisp: Dispenser = {
      id: `${pump.id}-${addDispenserFace}-${Date.now()}`,
      name: dispDraft.name || `Dispensador ${faceDisps.length + 1}`,
      face: addDispenserFace,
      pumpId: pump.id,
      pumpName: pump.name,
      fuel: pump.fuel.id,
      fuelName: pump.fuel.name,
      fuelColor: pump.fuel.color,
      status: 'activo',
      serialNumber: dispDraft.sn,
    };
    setPumps(pumps.map(p => p.id === pump.id ? {
      ...p,
      faces: p.faces.map(f => f.id === addDispenserFace ? { ...f, dispensers: [...f.dispensers, newDisp] } : f),
    } : p));
    setAddDispenserFace(null);
    toast.success('Dispensador agregado', `${newDisp.name} disponible para registrar lecturas.`);
  };

  const deleteDispenser = () => {
    if (!confirmDelDisp) return;
    setPumps(pumps.map(p => p.id === pump.id ? {
      ...p,
      faces: p.faces.map(f => f.id === confirmDelDisp.face ? {
        ...f,
        dispensers: f.dispensers.filter(d => d.id !== confirmDelDisp.id),
      } : f),
    } : p));
    toast.error('Dispensador eliminado', `${confirmDelDisp.name} fue removido permanentemente.`);
  };

  return (
    <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
      {/* Pump list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Bombas</div>
          <Button variant="primary" icon="plus" size="sm" onClick={() => { setPumpDraft({ name: '', fuel: 'Súper' }); setNewPumpOpen(true); }}>Nueva bomba</Button>
        </div>
        {pumps.map((p) => (
          <Card
            key={p.id}
            hoverable
            padding={14}
            onClick={() => { setPicked(p.id); setPumpName(p.name); }}
            style={{ cursor: 'pointer', boxShadow: picked === p.id ? '0 0 0 2px #0f1f3d' : '0 0 0 1px #e6e8ec' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: p.fuel.color + '22', color: p.fuel.color, display: 'grid', placeItems: 'center' }}>
                <Icon name="fuel" size={16}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{p.fuel.name} · 6 dispensadores</div>
              </div>
              {p.isActive ? <Badge tone="success" dot size="sm">Activa</Badge> : <Badge tone="warning" size="sm">Mant.</Badge>}
            </div>
          </Card>
        ))}
      </div>

      {/* Pump detail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#d97706', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Configuración de bomba</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3, marginTop: 4, marginBottom: 0 }}>{pump.name}</h2>
              <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                <TextField label="Nombre interno" value={pumpName} onChange={setPumpName} style={{ flex: 1 }}/>
                <TextField label="Combustible" value={pump.fuel.name} disabled style={{ flex: 1 }}/>
                <TextField label="Caras" value="2" disabled style={{ width: 90 }}/>
                <TextField label="Disp./cara" value={String(pump.faces[0]?.dispensers.length || 3)} disabled style={{ width: 100 }}/>
              </div>
            </div>
            <PumpDiagram pump={pump} compact/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={toggleActive}
                style={{
                  width: 40, height: 22, borderRadius: 999,
                  background: pump.isActive ? '#16a34a' : '#cbd5e1', border: 0, position: 'relative', cursor: 'pointer',
                  transition: 'background .2s',
                }}
              >
                <span style={{ position: 'absolute', top: 2, left: pump.isActive ? 20 : 2, width: 18, height: 18, borderRadius: 999, background: 'white', transition: 'left .15s' }}/>
              </button>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{pump.isActive ? 'Bomba activa' : 'Bomba inactiva'}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="danger" icon="trash" onClick={() => setConfirmDeactivate(true)}>Desactivar</Button>
              <Button variant="primary" icon="check" onClick={saveChanges}>Guardar cambios</Button>
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {pump.faces.map((face) => (
            <Card key={face.id} padding={0}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#0f1f3d', color: '#fbbf24', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{face.id}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Cara {face.id}</div>
                </div>
                <Button variant="ghost" icon="plus" size="sm" onClick={() => {
                  setDispDraft({ name: `Dispensador ${face.dispensers.length + 1}`, sn: '', status: 'activo' });
                  setAddDispenserFace(face.id);
                }}>Dispensador</Button>
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {face.dispensers.map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f8fafc', borderRadius: 9 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'white', boxShadow: '0 0 0 1px #e2e8f0', fontSize: 11, fontWeight: 800, color: '#0f1f3d', display: 'grid', placeItems: 'center' }}>D{d.name.slice(-1)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>SN-{d.id.toUpperCase().slice(0, 8)}</div>
                    </div>
                    {d.status === 'mantenimiento'
                      ? <Badge tone="warning" icon="wrench" size="sm">Mantenim.</Badge>
                      : <Badge tone="success" dot size="sm">Activo</Badge>}
                    <button onClick={() => {
                      setDispDraft({ name: d.name, sn: `SN-${d.id.toUpperCase().slice(0, 8)}`, status: d.status });
                      setEditDispenser({ face: face.id, id: d.id });
                    }} style={{ width: 26, height: 26, borderRadius: 6, border: 0, background: 'white', boxShadow: '0 0 0 1px #e2e8f0', cursor: 'pointer', color: '#475569', display: 'grid', placeItems: 'center' }}>
                      <Icon name="edit" size={12}/>
                    </button>
                    <button onClick={() => setConfirmDelDisp({ face: face.id, id: d.id, name: d.name })} style={{ width: 26, height: 26, borderRadius: 6, border: 0, background: 'white', boxShadow: '0 0 0 1px #fecaca', cursor: 'pointer', color: '#dc2626', display: 'grid', placeItems: 'center' }}>
                      <Icon name="trash" size={12}/>
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* New Pump Modal */}
      <Modal open={newPumpOpen} onClose={() => setNewPumpOpen(false)}
        title="Agregar nueva bomba"
        subtitle="Por defecto se crearán 2 caras (A y B) con 3 dispensadores cada una."
        icon="fuel" iconTone="primary" width={520}
        footer={<>
          <Button variant="secondary" onClick={() => setNewPumpOpen(false)}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={createPump}>Crear bomba</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TextField label="Nombre de la bomba" placeholder="Ej. Bomba 04" value={pumpDraft.name} onChange={(v) => setPumpDraft(s => ({ ...s, name: v }))} autoFocus/>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Tipo de combustible</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {FUELS.map(f => (
                <button key={f.id} onClick={() => setPumpDraft(s => ({ ...s, fuel: f.name }))} style={{
                  padding: 12, borderRadius: 10, fontFamily: 'inherit', cursor: 'pointer',
                  border: 0, background: pumpDraft.fuel === f.name ? f.color + '22' : '#f8fafc',
                  boxShadow: pumpDraft.fuel === f.name ? `0 0 0 2px ${f.color}` : '0 0 0 1px #e2e8f0',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: f.color, color: 'white', display: 'grid', placeItems: 'center' }}><Icon name="droplet" size={13}/></div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>L. {f.price.toFixed(2)}/L</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ background: '#dbeafe', borderRadius: 9, padding: 12, fontSize: 12, color: '#1e40af', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="info" size={14} style={{ marginTop: 1 }}/>
            <span>Después de crearla podrás añadir o quitar dispensadores y editar números de serie.</span>
          </div>
        </div>
      </Modal>

      {/* Edit Dispenser Modal */}
      <Modal open={!!editDispenser} onClose={() => setEditDispenser(null)}
        title="Editar dispensador"
        subtitle={editDispenser ? `${pump.name} · Cara ${editDispenser.face}` : ''}
        icon="edit" iconTone="info" width={460}
        footer={<>
          <Button variant="secondary" onClick={() => setEditDispenser(null)}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={updateDispenser}>Guardar cambios</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TextField label="Nombre" value={dispDraft.name} onChange={(v) => setDispDraft(s => ({ ...s, name: v }))}/>
          <TextField label="Número de serie" value={dispDraft.sn} onChange={(v) => setDispDraft(s => ({ ...s, sn: v }))}/>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Estado del dispensador</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {([
                { v: 'activo', l: 'Activo', i: 'check' },
                { v: 'inactivo', l: 'Inactivo', i: 'minus' },
                { v: 'mantenimiento', l: 'Mantenim.', i: 'wrench' },
              ] as const).map(o => (
                <button key={o.v} onClick={() => setDispDraft(s => ({ ...s, status: o.v }))} style={{
                  padding: 10, borderRadius: 9, fontFamily: 'inherit', cursor: 'pointer',
                  border: 0, fontSize: 12, fontWeight: 700,
                  background: dispDraft.status === o.v
                    ? (o.v === 'activo' ? '#dcfce7' : o.v === 'mantenimiento' ? '#fef3c7' : '#f1f5f9')
                    : 'white',
                  color: dispDraft.status === o.v
                    ? (o.v === 'activo' ? '#166534' : o.v === 'mantenimiento' ? '#854d0e' : '#475569')
                    : '#94a3b8',
                  boxShadow: dispDraft.status === o.v ? 'none' : '0 0 0 1px #e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <Icon name={o.i} size={12}/>{o.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Add Dispenser Modal */}
      <Modal open={!!addDispenserFace} onClose={() => setAddDispenserFace(null)}
        title="Agregar dispensador"
        subtitle={addDispenserFace ? `${pump.name} · Cara ${addDispenserFace}` : ''}
        icon="plus" iconTone="success" width={460}
        footer={<>
          <Button variant="secondary" onClick={() => setAddDispenserFace(null)}>Cancelar</Button>
          <Button variant="primary" icon="plus" onClick={addDispenser}>Agregar</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TextField label="Nombre del dispensador" value={dispDraft.name} onChange={(v) => setDispDraft(s => ({ ...s, name: v }))} autoFocus/>
          <TextField label="Número de serie" placeholder="SN-XXXX" value={dispDraft.sn} onChange={(v) => setDispDraft(s => ({ ...s, sn: v }))}/>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        title={`¿Desactivar ${pump.name}?`}
        message="Los dispensadores de esta bomba dejarán de aparecer en los registros de lectura. Podrás reactivarla más tarde."
        confirmLabel="Sí, desactivar"
        cancelLabel="Mantener activa"
        icon="alert" tone="danger"
        onConfirm={() => {
          setPumps(pumps.map(p => p.id === pump.id ? { ...p, isActive: false } : p));
          toast.warning(`${pump.name} desactivada`, 'Ya no aparecerá en las lecturas diarias.');
        }}
      />

      <ConfirmDialog
        open={!!confirmDelDisp}
        onClose={() => setConfirmDelDisp(null)}
        title={confirmDelDisp ? `¿Eliminar ${confirmDelDisp.name}?` : ''}
        message="Se perderá su histórico de lecturas. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        icon="trash" tone="danger"
        onConfirm={deleteDispenser}
      />
    </div>
  );
}
