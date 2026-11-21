'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import TextField from '@/components/ui/TextField';
import ConfirmDialog from '@/components/overlays/ConfirmDialog';
import { Dispenser, DailyReading, Pump } from '@/types';
import { fmtNum } from '@/lib/utils';
import { finalAnterior, lecturasPorDispensador, rompeContinuidad } from '@/lib/totalizadores';

interface ReadingValue {
  value: string;
  status: 'activo' | 'mantenimiento';
  /** Motivo si la inicial difiere de la final anterior (continuidad). */
  obs: string;
}

// Lecturas anteriores que se revisan para precargar la inicial (≈10 días × 12 mangueras).
const LECTURAS_PREVIAS = 120;
const MOTIVO_MIN = 5;

export default function LecturaInicialScreen() {
  const { pumps, dayStatus, addAuditEntry, readings, createInitialReadings, currentPrices, roles, today } = useApp();
  const { appUser } = useAuth();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStatusChange, setConfirmStatusChange] = useState<{ id: string, status: 'activo'|'mantenimiento' } | null>(null);

  const activePumps = pumps.filter(p => p.isActive);
  // Operables: bomba activa y dispensador no inactivo (mismo criterio que Lectura final y el Cuadro).
  const allDisp: Dispenser[] = activePumps.flatMap(p => p.faces.flatMap(f => f.dispensers.filter(d => d.status !== 'inactivo')));
  const lecturaDe = lecturasPorDispensador(readings);


  const [values, setValues] = useState<Record<string, ReadingValue>>(() => {
    const o: Record<string, ReadingValue> = {};
    allDisp.forEach(d => { 
      const existing = lecturaDe.get(d.id);
      o[d.id] = { 
        value: existing ? existing.initialReading.toString() : '', 
        status: existing ? existing.status : (d.status === 'inactivo' ? 'activo' : d.status), 
        obs: '' 
      }; 
    });
    return o;
  });

  // Final anterior por dispensador (continuidad): última lectura con final de una fecha previa.
  const [anteriores, setAnteriores] = useState<{ fecha: string; porDisp: Record<string, { fecha: string; valor: number }> } | null>(null);
  useEffect(() => {
    let vivo = true;
    getDocs(query(collection(db, 'readings'), where('date', '<', today), orderBy('date', 'desc'), limit(LECTURAS_PREVIAS)))
      .then(snap => {
        if (!vivo) return;
        const previas = snap.docs.map(d => d.data() as DailyReading);
        const porDisp: Record<string, { fecha: string; valor: number }> = {};
        new Set(previas.map(r => r.dispenserId)).forEach(id => {
          const f = finalAnterior(previas, id, today);
          if (f) porDisp[id] = f;
        });
        setAnteriores({ fecha: today, porDisp });
        // Precarga: la inicial sugerida es la final anterior del mismo dispensador (solo campos vacíos).
        setValues(prev => {
          let changed = false;
          const next = { ...prev };
          Object.entries(porDisp).forEach(([id, f]) => {
            if (next[id] && next[id].value === '') { next[id] = { ...next[id], value: String(f.valor) }; changed = true; }
          });
          return changed ? next : prev;
        });
      })
      .catch(e => { console.warn('Sin lecturas anteriores:', e); if (vivo) setAnteriores({ fecha: today, porDisp: {} }); });
    return () => { vivo = false; };
  }, [today]);
  const previaDe = (id: string) => (anteriores?.fecha === today ? anteriores.porDisp[id] ?? null : null);

  const [draftExists, setDraftExists] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const prevPumpsRef = useRef(pumps);

  const { dayData, updateDayData } = useApp();

  useEffect(() => {
    const draft = localStorage.getItem('lectura_inicial_draft');
    setDraftExists(!!draft);
    if (draft && readings.length === 0) {
      try {
        const parsed = JSON.parse(draft);
        // Fallback for previous draft structure just in case
        const draftValues = parsed.values ? parsed.values : parsed;

        setValues(prev => {
          const next = { ...prev };
          Object.keys(draftValues).forEach(k => {
             if (next[k]) {
                const disp = allDisp.find(d => d.id === k);
                const currentConfigStatus = disp ? disp.status : 'activo';
                const draftConfigStatus = draftValues[k].configStatus;
                
                next[k].value = draftValues[k].value;
                
                if (draftConfigStatus === currentConfigStatus) {
                  next[k].status = draftValues[k].status || next[k].status;
                } else {
                  next[k].status = currentConfigStatus === 'inactivo' ? 'activo' : currentConfigStatus;
                }
             }
          });
          return next;
        });
      } catch (e) {}
    }
  }, [readings.length]); // allDisp isn't in deps to avoid re-triggering draft load

  // Sync maintenance status if changed from global config live
  useEffect(() => {
    if (prevPumpsRef.current !== pumps) {
      setValues(prev => {
        let changed = false;
        const next = { ...prev };
        allDisp.forEach(d => {
          const prevPump = prevPumpsRef.current.find(p => p.id === d.pumpId);
          const prevDisp = prevPump?.faces.flatMap(f => f.dispensers).find(x => x.id === d.id);
          
          if (prevDisp && prevDisp.status !== d.status) {
            if (next[d.id]) {
              next[d.id].status = d.status === 'inactivo' ? 'activo' : d.status;
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });
      prevPumpsRef.current = pumps;
    }
  }, [pumps, allDisp]);

  useEffect(() => {
    if (readings.length > 0) {
      setValues(prev => {
        const o = { ...prev };
        let changed = false;
        lecturasPorDispensador(readings).forEach(r => {
          if (!o[r.dispenserId] || o[r.dispenserId].value !== r.initialReading.toString()) {
            o[r.dispenserId] = { value: r.initialReading.toString(), status: r.status, obs: '' };
            changed = true;
          }
        });
        return changed ? o : prev;
      });
    }
  }, [readings]);

  /** Inicial digitada que no coincide con la final anterior (requiere motivo). */
  const rompe = (id: string) => {
    const v = values[id];
    if (!v || v.status !== 'activo' || v.value === '' || lecturaDe.has(id)) return false;
    const n = parseFloat(v.value);
    return !isNaN(n) && rompeContinuidad(n, previaDe(id)?.valor);
  };

  const isClosed = dayStatus === 'cerrado';
  const completed = Object.values(values).filter(v => v.value !== '' && !isNaN(parseFloat(v.value)) && v.status === 'activo').length;
  const total = allDisp.filter(d => d.status === 'activo').length;
  const totalSuma = Object.values(values).reduce((acc, v) => acc + (parseFloat(v.value) || 0), 0);

  const getPumpFuelsText = (p: Pump) => {
    const uniqueFuels = Array.from(new Set(p.faces.flatMap(f => f.dispensers.map(d => d.fuelName))));
    return uniqueFuels.length > 0 ? uniqueFuels.join(' / ') : p.fuel.name;
  };

  const getPumpDispCount = (p: Pump) => p.faces.reduce((acc: number, f) => acc + f.dispensers.length, 0);

  const saveDraft = () => {
    const draftToSave: Record<string, (typeof values)[string] & { configStatus?: string }> = { ...values };
    Object.keys(draftToSave).forEach(k => {
      const disp = allDisp.find(d => d.id === k);
      if (disp) {
        draftToSave[k] = { ...draftToSave[k], configStatus: disp.status };
      }
    });
    localStorage.setItem('lectura_inicial_draft', JSON.stringify(draftToSave));
    setDraftExists(true);
    toast.info('Borrador guardado', 'Tus lecturas temporales han sido guardadas localmente.');
  };

  const discardDraft = () => {
    localStorage.removeItem('lectura_inicial_draft');
    setDraftExists(false);
    
    const o: Record<string, ReadingValue> = {};
    allDisp.forEach(d => { 
      const existing = lecturaDe.get(d.id);
      const previa = previaDe(d.id);
      o[d.id] = { 
        value: existing ? existing.initialReading.toString() : previa ? String(previa.valor) : '', 
        status: existing ? existing.status : (d.status === 'inactivo' ? 'activo' : d.status), 
        obs: '' 
      }; 
    });
    setValues(o);
    toast.success('Borrador descartado', 'Se han restaurado los valores originales.');
    setConfirmDiscard(false);
  };

  const handleConfirmClick = () => {
    const missing = allDisp.filter(d => values[d.id]?.status === 'activo' && values[d.id]?.value === '');
    if (missing.length > 0) {
      toast.error('Lecturas incompletas', `Faltan ${missing.length} dispensadores por registrar.`);
      return;
    }
    
    const invalid = allDisp.filter(d => values[d.id]?.status === 'activo' && (isNaN(parseFloat(values[d.id]?.value)) || parseFloat(values[d.id]?.value) < 0));
    if (invalid.length > 0) {
      toast.error('Valores inválidos', 'Revisa que todas las lecturas de los dispensadores sean números válidos y mayores a cero.');
      return;
    }

    const sinMotivo = allDisp.filter(d => rompe(d.id) && (values[d.id]?.obs || '').trim().length < MOTIVO_MIN);
    if (sinMotivo.length > 0) {
      toast.error('Falta el motivo', `${sinMotivo.length} lectura${sinMotivo.length > 1 ? 's' : ''} no coincide${sinMotivo.length > 1 ? 'n' : ''} con la final anterior. Escribe el motivo (mínimo ${MOTIVO_MIN} caracteres).`);
      return;
    }

    const unconfirmed = allDisp.filter(d => !lecturaDe.has(d.id));
    if (unconfirmed.length === 0) {
      toast.error('Ya registradas', 'Todas las lecturas iniciales ya fueron confirmadas para hoy.');
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    const fecha = today; // día operativo del contexto (hora de Honduras)
    const ahora = new Date().toISOString();
    const autor = appUser?.email || appUser?.name || 'unknown';
    const newReadings: DailyReading[] = [];

    allDisp.forEach(d => {
      const v = values[d.id];
      if (!v || lecturaDe.has(d.id)) return;
      if (v.value === '' && v.status !== 'mantenimiento') return;
      const previa = previaDe(d.id);
      // Mantenimiento sin valor conserva la final anterior en vez de grabar 0.
      const inicial = v.value !== '' ? parseFloat(v.value) || 0 : previa?.valor ?? 0;
      const ruptura = rompe(d.id);
      newReadings.push({
        date: fecha,
        dispenserId: d.id,
        dispenserName: d.name,
        face: d.face,
        pumpId: d.pumpId,
        pumpName: d.pumpName,
        fuelId: d.fuel,
        fuelName: d.fuelName,
        fuelPrice: currentPrices[d.fuel as 'super' | 'regular' | 'diesel'] || 0,
        initialReading: inicial,
        status: v.status,
        createdBy: autor,
        createdAt: ahora,
        ...(previa ? { previousFinal: previa.valor } : {}),
        ...(ruptura ? { continuityBreak: true, continuityReason: v.obs.trim() } : {}),
      });
    });

    let res = { creadas: [] as string[], existentes: [] as string[] };
    try {
      if (newReadings.length > 0) res = await createInitialReadings(newReadings);
    } catch (e) {
      console.error(e);
      toast.error('No se guardó', 'Revisa la conexión e intenta de nuevo.');
      setConfirmOpen(false);
      return;
    }

    localStorage.removeItem('lectura_inicial_draft');
    setDraftExists(false);

    const roleName = roles.find(r => r.id === appUser?.roleId)?.name || 'Desconocido';
    const base = {
      timestamp: new Date().toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      userId: appUser?.uid || 'unknown',
      userName: appUser?.name || 'Sistema',
      userRole: roleName,
    };
    const creadas = newReadings.filter(r => res.creadas.includes(r.dispenserId));
    if (creadas.length > 0) {
      await addAuditEntry({
        ...base,
        action: 'Lectura inicial',
        target: `${creadas.length} dispensadores`,
        detail: creadas.map(r => `${r.pumpName} ${r.face}-${r.dispenserName.slice(-1)}: ${r.status === 'mantenimiento' ? 'mant.' : r.initialReading}`).join(' · '),
        icon: 'log-in',
      });
    }
    for (const r of creadas.filter(c => c.continuityBreak)) {
      await addAuditEntry({
        ...base,
        action: 'Continuidad de totalizador',
        target: `${r.pumpName} ${r.face}-${r.dispenserName.slice(-1)} (${r.fuelName})`,
        detail: `Inicial distinta de la final anterior`,
        icon: 'alert',
        before: r.previousFinal,
        after: r.initialReading,
        reason: r.continuityReason,
      });
    }

    if (res.existentes.length > 0) {
      toast.error('Ya registrada', `${res.existentes.length} lectura${res.existentes.length > 1 ? 's' : ''} inicial${res.existentes.length > 1 ? 'es' : ''} ya ${res.existentes.length > 1 ? 'estaban registradas' : 'estaba registrada'} por otro usuario; se conserva la primera.`);
    }
    if (creadas.length > 0) toast.success('Lecturas iniciales registradas', `${creadas.length} dispensadores actualizados correctamente.`);

    setConfirmOpen(false);
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ background: 'linear-gradient(135deg,#0a1530,#14275a)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Inicio del día · {new Date().toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
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

      <div className="grid-cols-3">
        <div style={{ background: '#0f172a', borderRadius: 16, padding: 20, color: 'white', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: '#94a3b8', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
              Suma de Totalizadores
              <div style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', display: 'grid', placeItems: 'center' }}>
                <Icon name="droplet" size={12} style={{ color: '#fbbf24' }}/>
              </div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, marginTop: 12, letterSpacing: -1, lineHeight: 1 }}>
              {fmtNum(totalSuma, 2)}
            </div>
            <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 12, lineHeight: 1.4 }}>
              litros<br/>acumulados<br/>iniciales
            </div>
          </div>
        </div>

        <div style={{ background: '#fef3c7', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: '#92400e', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
            Dispensadores activos
            <div style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid rgba(217, 119, 6, 0.2)', display: 'grid', placeItems: 'center' }}>
              <Icon name="clock" size={12} style={{ color: '#d97706' }}/>
            </div>
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#92400e', marginTop: 12, letterSpacing: -1, lineHeight: 1 }}>
            {total}
          </div>
          <div style={{ fontSize: 12, color: '#b45309', marginTop: 12, lineHeight: 1.4 }}>
            listos para<br/>registrar
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: '#64748b', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
            En mantenimiento
            <div style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #e2e8f0', display: 'grid', placeItems: 'center' }}>
              <Icon name="tool" size={12} style={{ color: '#64748b' }}/>
            </div>
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#0f172a', marginTop: 12, letterSpacing: -1, lineHeight: 1 }}>
            {Object.values(values).filter(v => v.status === 'mantenimiento').length}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 12, lineHeight: 1.4 }}>
            no se les pedirá<br/>lectura
          </div>
        </div>
      </div>

      {activePumps.map((p) => (
        <Card key={p.id} padding={0}>
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: '#fbbf2422', color: '#d97706', display: 'grid', placeItems: 'center' }}>
                <Icon name="fuel" size={18}/>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>{getPumpFuelsText(p)} · {p.faces.length} caras · {getPumpDispCount(p)} mangueras</div>
              </div>
            </div>
            <Badge tone="success" icon="check">Listo para abrir</Badge>
          </div>

          <div className="grid-cols-2">
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
                    const hasReading = lecturaDe.has(d.id);
                    const previa = previaDe(d.id);
                    const ruptura = rompe(d.id);
                    
                    return (
                      <div key={d.id} className="lectura-row" style={{
                        padding: 10,
                        background: isMaint ? '#fef3c7' : '#f8fafc',
                        borderRadius: 10,
                        border: isMaint ? '1px dashed #f59e0b' : '1px solid #eef0f3',
                        opacity: hasReading ? 0.7 : 1,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'white', boxShadow: '0 0 0 1px #e2e8f0', fontSize: 10.5, fontWeight: 800, color: '#0f1f3d', display: 'grid', placeItems: 'center', flexShrink: 0 }}>D{d.name.slice(-1)}</div>
                          <span style={{ fontSize: 9.5, background: d.fuelColor + '22', color: d.fuelColor, padding: '2px 5px', borderRadius: 4, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.fuelName}</span>
                        </div>
                        <TextField
                          prefix="L"
                          value={v.value}
                          onChange={(val) => {
                            if (/^\d*\.?\d*$/.test(val)) {
                              setValues(s => ({ ...s, [d.id]: { ...s[d.id], value: val } }));
                            }
                          }}
                          suffix="ltrs"
                          disabled={isMaint || isClosed || hasReading}
                          hint={previa && !hasReading && !isMaint ? `Final anterior (${previa.fecha.split('-').reverse().join('/')}): ${fmtNum(previa.valor, 3)}` : undefined}
                          error={ruptura ? 'No coincide con la final anterior' : undefined}
                        />
                        {ruptura && (
                          <TextField
                            placeholder="Motivo de la diferencia (obligatorio)"
                            value={v.obs}
                            onChange={(val) => setValues(s => ({ ...s, [d.id]: { ...s[d.id], obs: val } }))}
                            disabled={isClosed}
                          />
                        )}
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(['activo', 'mantenimiento'] as const).map((st) => (
                            <button key={st} onClick={() => {
                                if (v.status !== st) {
                                  setConfirmStatusChange({ id: d.id, status: st });
                                }
                              }}
                              disabled={isClosed || hasReading}
                              style={{
                                flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 10.5, fontWeight: 700,
                                fontFamily: 'inherit', cursor: (isClosed || hasReading) ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: 0.4, border: 0,
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
          <Icon name="info" size={12} style={{ verticalAlign: -2 }}/> No se permite registrar dos lecturas iniciales para el mismo dispensador y fecha.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {draftExists && <button onClick={() => setConfirmDiscard(true)} disabled={isClosed} style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '0 16px', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="trash" size={14}/>Descartar borrador</button>}
          <Button variant="secondary" onClick={saveDraft} disabled={isClosed}>Guardar borrador</Button>
          <Button variant="primary" icon="check" onClick={handleConfirmClick} disabled={isClosed}>Confirmar lectura inicial</Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Descartar borrador"
        message="¿Estás seguro de que quieres descartar el borrador? Se perderán las lecturas temporales no confirmadas y se restaurará la configuración por defecto de las bombas."
        confirmLabel="Sí, descartar borrador"
        icon="trash"
        tone="danger"
        onConfirm={discardDraft}
      />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar lectura inicial del día"
        message={`Vas a registrar de forma definitiva las lecturas. Una vez confirmadas no se podrán duplicar para esta fecha; solo se corrigen desde Lectura final, con motivo y permiso de cierre.`}
        confirmLabel="Sí, confirmar lecturas"
        icon="log-in"
        tone="primary"
        onConfirm={handleConfirm}
      />

      <ConfirmDialog
        open={!!confirmStatusChange}
        onClose={() => setConfirmStatusChange(null)}
        title={confirmStatusChange?.status === 'mantenimiento' ? '¿Marcar en mantenimiento?' : '¿Activar dispensador?'}
        message={confirmStatusChange?.status === 'mantenimiento' 
          ? `Vas a marcar el dispensador en mantenimiento. No se requerirá lectura inicial ni final para el día de hoy en este dispensador.`
          : `Vas a volver a activar este dispensador. Deberás ingresar su lectura inicial para poder confirmar el registro del día.`}
        confirmLabel="Sí, confirmar"
        icon={confirmStatusChange?.status === 'mantenimiento' ? 'wrench' : 'check'}
        tone={confirmStatusChange?.status === 'mantenimiento' ? 'danger' : 'success'}
        onConfirm={() => {
          if (confirmStatusChange) {
            setValues(s => ({ ...s, [confirmStatusChange.id]: { ...s[confirmStatusChange.id], status: confirmStatusChange.status } }));
            setConfirmStatusChange(null);
          }
        }}
      />
    </div>
  );
}
