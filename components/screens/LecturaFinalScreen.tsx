'use client';

import { useState, useMemo } from 'react';
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
import Modal from '@/components/overlays/Modal';
import { fmtL, fmtNum } from '@/lib/utils';
import { LITERS_PER_GALLON } from '@/lib/constants';
import { DailyReading } from '@/types';
import * as XLSX from 'xlsx';
import { calcVenta, lecturasPorDispensador, litrosEntre, METER_MAX_DEFAULT, round, Venta } from '@/lib/totalizadores';

const MOTIVO_MIN = 5;
const fechaHN = (iso: string) => iso.split('-').reverse().join('/');

interface Fila {
  id: string; name: string; pumpName: string; face: string;
  fuel: string; fuelName: string; fuelColor: string; meterMax: number;
}

interface Correccion { reading: DailyReading; fila: Fila; campo: 'inicial' | 'final'; valor: string; motivo: string }

export default function LecturaFinalScreen() {
  const { pumps, dayStatus, updateDayData, addAuditEntry, readings, saveReadings, currentPrices, roles, today } = useApp();
  const { appUser } = useAuth();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Lo digitado y aún no guardado; lo guardado viene de `readings` (sobrevive a recargar la página).
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [rollEdits, setRollEdits] = useState<Record<string, boolean>>({});
  const [rolloverPide, setRolloverPide] = useState<Fila | null>(null);
  const [corr, setCorr] = useState<Correccion | null>(null);
  const [reabrir, setReabrir] = useState<string | null>(null);

  const role = roles.find(r => r.id === appUser?.roleId);
  const puedeCerrar = role?.permissions?.canCloseDay === true;

  // Operables: bomba activa y dispensador no inactivo (mismo criterio que Lectura inicial y el Cuadro).
  const rows: Fila[] = useMemo(() => pumps
    .filter(p => p.isActive)
    .flatMap(p => p.faces.flatMap(f => f.dispensers.filter(d => d.status !== 'inactivo').map(d => ({
      id: d.id, name: d.name, pumpName: p.name, face: f.id,
      fuel: d.fuel, fuelName: d.fuelName, fuelColor: d.fuelColor, meterMax: d.meterMax ?? METER_MAX_DEFAULT,
    })))), [pumps]);

  const lecturaDe = useMemo(() => lecturasPorDispensador(readings), [readings]);

  const finalTxt = (id: string) => edits[id] ?? (lecturaDe.get(id)?.finalReading?.toString() ?? '');
  const rolloverDe = (id: string) => rollEdits[id] ?? lecturaDe.get(id)?.rollover === true;

  /** Lectura con lo digitado aplicado (final, rollover y meterMax). */
  const lecturaEditada = (f: Fila): DailyReading | null => {
    const r = lecturaDe.get(f.id);
    if (!r) return null;
    const txt = finalTxt(f.id);
    const n = txt === '' ? undefined : parseFloat(txt);
    const rollover = rolloverDe(f.id);
    return { ...r, finalReading: n, rollover, meterMax: r.meterMax ?? f.meterMax };
  };

  const ventaDe = (f: Fila): Venta | null => {
    const r = lecturaEditada(f);
    return r ? calcVenta(r, currentPrices) : null;
  };

  const totals = rows.reduce((s, f) => {
    const v = ventaDe(f);
    if (v?.estado === 'ok') { s.l += v.litros; s.m += v.total; }
    return s;
  }, { l: 0, m: 0 });
  totals.l = round(totals.l, 3);
  totals.m = round(totals.m, 2);
  const totalGal = totals.l / LITERS_PER_GALLON;

  const isClosed = dayStatus === 'cerrado';
  const conFinal = rows.filter(f => { const r = lecturaDe.get(f.id); return r?.status === 'mantenimiento' || r?.finalReading !== undefined; }).length;

  const etiqueta = (f: Fila) => `${f.pumpName} ${f.face}-${f.name.slice(-1)} (${f.fuelName})`;

  /** Valida y arma las finales digitadas. `todas`: exige todas las operables (para cerrar). */
  const prepararFinales = (todas: boolean): DailyReading[] | null => {
    const autor = appUser?.email || appUser?.name || 'unknown';
    const ahora = new Date().toISOString();

    if (todas) {
      const sinInicial = rows.filter(f => !lecturaDe.has(f.id));
      if (sinInicial.length > 0) {
        toast.error('Faltan lecturas iniciales', `Hay ${sinInicial.length} dispensadores sin lectura inicial hoy. Completa la lectura inicial primero.`);
        return null;
      }
    }

    const candidatas = rows.filter(f => {
      const r = lecturaDe.get(f.id);
      return r && r.status !== 'mantenimiento';
    });
    const vacias = candidatas.filter(f => finalTxt(f.id) === '');
    if (todas && vacias.length > 0) {
      toast.error('Lecturas incompletas', `Faltan ${vacias.length} dispensadores por registrar.`);
      return null;
    }
    const conValor = candidatas.filter(f => finalTxt(f.id) !== '');
    if (conValor.length === 0 && !todas) {
      toast.info('Nada que guardar', 'Ingresa al menos una lectura final.');
      return null;
    }
    const invalidas = conValor.filter(f => { const n = parseFloat(finalTxt(f.id)); return isNaN(n) || n < 0 || !/^\d*\.?\d*$/.test(finalTxt(f.id)); });
    if (invalidas.length > 0) {
      toast.error('Valores inválidos', 'Revisa que todas las lecturas sean números válidos y mayores o iguales a cero.');
      return null;
    }
    const menores = conValor.filter(f => ventaDe(f)?.estado === 'invalida');
    if (menores.length > 0) {
      toast.error('Lecturas incorrectas', `Hay ${menores.length} lectura${menores.length > 1 ? 's' : ''} final${menores.length > 1 ? 'es' : ''} menor${menores.length > 1 ? 'es' : ''} a la inicial. Si el totalizador pasó por cero, márcalo como "Vuelta a cero".`);
      return null;
    }

    const out: DailyReading[] = [];
    conValor.forEach(f => {
      const r = lecturaDe.get(f.id) as DailyReading;
      const e = lecturaEditada(f) as DailyReading;
      const v = calcVenta(e, currentPrices);
      const cambio = r.finalReading !== e.finalReading || (r.rollover === true) !== (e.rollover === true);
      if (!cambio) return;
      out.push({
        ...r,
        finalReading: e.finalReading,
        liters: v.litros,
        gallons: round(v.litros / LITERS_PER_GALLON, 3),
        total: v.total,
        rollover: e.rollover === true,
        ...(e.rollover ? { meterMax: e.meterMax } : {}),
        closedBy: autor,
        closedAt: ahora,
      });
    });
    return out;
  };

  const registrarFinales = async (finales: DailyReading[]) => {
    if (finales.length === 0) return;
    await saveReadings(finales);
    setEdits(s => { const n = { ...s }; finales.forEach(r => delete n[r.dispenserId]); return n; });
    setRollEdits(s => { const n = { ...s }; finales.forEach(r => delete n[r.dispenserId]); return n; });
    await addAuditEntry({
      action: 'Lecturas finales guardadas',
      target: `${finales.length} dispensadores`,
      detail: finales.map(r => `${r.pumpName} ${r.face}-${r.dispenserName.slice(-1)}: ${r.finalReading}${r.rollover ? ' (vuelta a cero)' : ''}`).join(' · '),
      icon: 'log-out',
    });
    for (const r of finales.filter(x => x.rollover)) {
      await addAuditEntry({
        action: 'Vuelta a cero del totalizador',
        target: `${r.pumpName} ${r.face}-${r.dispenserName.slice(-1)} (${r.fuelName})`,
        detail: `Litros = final + máximo (${r.meterMax}) − inicial = ${r.liters}`,
        icon: 'alert',
        before: r.initialReading,
        after: r.finalReading,
      });
    }
  };

  const handleGuardar = async () => {
    const finales = prepararFinales(false);
    if (!finales) return;
    if (finales.length === 0) { toast.info('Sin cambios', 'Las lecturas finales ya estaban guardadas.'); return; }
    setGuardando(true);
    try {
      await registrarFinales(finales);
      toast.success('Lecturas finales guardadas', `${finales.length} dispensador${finales.length > 1 ? 'es' : ''}. El día sigue abierto.`);
    } catch (e) {
      console.error(e);
      toast.error('No se guardó', 'Revisa la conexión e intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const handleConfirmClick = () => {
    if (!puedeCerrar) return;
    if (prepararFinales(true)) setConfirmOpen(true);
  };

  const handleClose = async () => {
    const finales = prepararFinales(true);
    if (!finales) return;
    const autor = appUser?.email || appUser?.name || 'unknown';
    const ahora = new Date().toISOString();
    // Mantenimiento: la final es la inicial (0 litros).
    const mant = rows.map(f => lecturaDe.get(f.id)).filter((r): r is DailyReading => !!r && r.status === 'mantenimiento' && r.finalReading === undefined)
      .map(r => ({ ...r, finalReading: r.initialReading, liters: 0, gallons: 0, total: 0, closedBy: autor, closedAt: ahora }));
    try {
      await registrarFinales(finales);
      if (mant.length > 0) await saveReadings(mant);
      await updateDayData({ status: 'cerrado', closedBy: autor, closedAt: ahora });
      await addAuditEntry({
        action: 'Cierre del día',
        target: fechaHN(today),
        detail: `Total ${fmtL(totals.m)}`,
        icon: 'lock',
      });
      toast.success('Día cerrado', `Resumen final guardado · ${fmtL(totals.m)}`);
    } catch (e) {
      console.error(e);
      toast.error('No se cerró el día', 'Revisa la conexión e intenta de nuevo.');
    }
    setConfirmOpen(false);
  };

  const confirmarRollover = () => {
    if (!rolloverPide) return;
    setRollEdits(s => ({ ...s, [rolloverPide.id]: true }));
    setRolloverPide(null);
  };
  const litrosRollover = (f: Fila) => {
    const r = lecturaDe.get(f.id);
    const n = parseFloat(finalTxt(f.id));
    return r && !isNaN(n) ? litrosEntre(r.initialReading, n, true, r.meterMax ?? f.meterMax) : null;
  };

  const guardarCorreccion = async () => {
    if (!corr || !puedeCerrar) return;
    const n = parseFloat(corr.valor);
    if (corr.valor === '' || isNaN(n) || n < 0 || !/^\d*\.?\d*$/.test(corr.valor)) { toast.error('Valor inválido', 'Ingresa un número mayor o igual a cero.'); return; }
    if (corr.motivo.trim().length < MOTIVO_MIN) { toast.error('Falta el motivo', `Escribe el motivo de la corrección (mínimo ${MOTIVO_MIN} caracteres).`); return; }
    const r = corr.reading;
    const antes = corr.campo === 'inicial' ? r.initialReading : r.finalReading;
    const nueva: DailyReading = corr.campo === 'inicial' ? { ...r, initialReading: n } : { ...r, finalReading: n };
    const v = calcVenta(nueva, currentPrices);
    if (nueva.finalReading !== undefined && v.estado === 'invalida') {
      toast.error('Corrección inválida', 'La final quedaría menor a la inicial. Revisa el valor o marca la vuelta a cero.');
      return;
    }
    const autor = appUser?.email || appUser?.name || 'unknown';
    const upd: DailyReading = nueva.finalReading !== undefined
      ? { ...nueva, liters: v.litros, gallons: round(v.litros / LITERS_PER_GALLON, 3), total: v.total, ...(corr.campo === 'final' ? { closedBy: autor, closedAt: new Date().toISOString() } : {}) }
      : nueva;
    try {
      await saveReadings([upd]);
      setEdits(s => { const x = { ...s }; delete x[r.dispenserId]; return x; });
      await addAuditEntry({
        action: `Corrección de lectura ${corr.campo}`,
        target: etiqueta(corr.fila),
        detail: `${fechaHN(r.date)}${isClosed ? ' · día cerrado' : ''}`,
        icon: 'edit',
        before: antes ?? '',
        after: n,
        reason: corr.motivo.trim(),
      });
      toast.success('Lectura corregida', `${etiqueta(corr.fila)}: ${antes ?? '—'} → ${n}`);
      setCorr(null);
    } catch (e) {
      console.error(e);
      toast.error('No se guardó', 'Revisa la conexión e intenta de nuevo.');
    }
  };

  const confirmarReapertura = async () => {
    if (reabrir === null || !puedeCerrar) return;
    const motivo = reabrir.trim();
    if (motivo.length < MOTIVO_MIN) { toast.error('Falta el motivo', `Escribe el motivo de la reapertura (mínimo ${MOTIVO_MIN} caracteres).`); return; }
    const autor = appUser?.email || appUser?.name || 'unknown';
    try {
      await updateDayData({ status: 'en_proceso', reopenedBy: autor, reopenedAt: new Date().toISOString(), reopenReason: motivo });
      await addAuditEntry({
        action: 'Reapertura del día',
        target: fechaHN(today),
        detail: 'Día reabierto para corregir lecturas',
        icon: 'unlock',
        before: 'cerrado',
        after: 'en_proceso',
        reason: motivo,
      });
      toast.success('Día reabierto', 'Las lecturas finales se pueden editar de nuevo.');
      setReabrir(null);
    } catch (e) {
      console.error(e);
      toast.error('No se reabrió', 'Revisa la conexión e intenta de nuevo.');
    }
  };

  const exportExcel = () => {
    const fecha = fechaHN(today).replace(/\//g, '-');
    const data = rows.map(f => {
      const r = lecturaDe.get(f.id);
      const v = ventaDe(f);
      return {
        'Bomba': f.pumpName,
        'Cara': f.face,
        'Dispensador': `D${f.name.slice(-1)}`,
        'Combustible': f.fuelName,
        'L. Inicial': (r?.initialReading ?? 0).toFixed(3),
        'L. Final': parseFloat(finalTxt(f.id) || '0').toFixed(3),
        'Vuelta a cero': rolloverDe(f.id) ? 'Sí' : '',
        'Litros': (v?.litros ?? 0).toFixed(3),
        'Galones': ((v?.litros ?? 0) / LITERS_PER_GALLON).toFixed(2),
        'Precio/L': (v?.precio ?? 0).toFixed(2),
        'Total L.': (v?.total ?? 0).toFixed(2),
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lectura Final');
    XLSX.writeFile(wb, `Reporte_Diario_${fecha}.xlsx`);
    toast.success('Excel generado', `Reporte_Diario_${fecha}.xlsx descargado.`);
  };

  const botonCierre = (size?: 'sm') => puedeCerrar && (isClosed
    ? <Button variant="secondary" size={size} icon="unlock" onClick={() => setReabrir('')}>Reabrir día</Button>
    : <Button variant="primary" size={size} icon="lock" onClick={handleConfirmClick}>Cerrar día</Button>);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ background: 'linear-gradient(135deg,#0a1530,#14275a)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Fin del turno · {fechaHN(today)}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, letterSpacing: -0.3 }}>Cierre de ventas</div>
            <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 4 }}>Ingresa el totalizador final de cada dispensador y guárdalo; el cierre del día lo hace quien tiene permiso.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isClosed && <Button variant="accent" icon="check" onClick={handleGuardar} disabled={guardando}>Guardar lecturas finales</Button>}
            {botonCierre()}
          </div>
        </div>
      </Card>

      <div className="grid-cols-4">
        <StatCard tone="primary" label="Total lempiras" icon="fuel" value={fmtL(totals.m)} sub="estimado del día"/>
        <StatCard tone="neutral" label="Litros" icon="droplet" value={fmtNum(totals.l, 2)} sub="L vendidos"/>
        <StatCard tone="neutral" label="Galones" icon="droplet" value={fmtNum(totalGal, 2)} sub="gal vendidos"/>
        <StatCard tone="accent" label="Dispensadores" icon="gauge" value={`${conFinal} / ${rows.length}`} sub="con lectura final guardada"/>
      </div>

      <Card padding={0}>
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Lecturas finales por dispensador</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>La final debe ser ≥ a la inicial, salvo vuelta a cero del totalizador. Los totales se calculan en vivo.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon="download" size="sm" onClick={exportExcel}>Excel</Button>
            {!isClosed && <Button variant="accent" size="sm" icon="check" onClick={handleGuardar} disabled={guardando}>Guardar</Button>}
            {botonCierre('sm')}
          </div>
        </div>

        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                {['Bomba', 'Cara', 'Disp.', 'Combust.', 'L. inicial', 'L. final', 'Diff (L)', 'Galones', 'Precio', 'Total L.', ''].map((h, i) => (
                  <th key={`${h}-${i}`} style={{ padding: '12px 14px', fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: i >= 4 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const r = lecturaDe.get(f.id);
                const v = ventaDe(f);
                const isMant = r?.status === 'mantenimiento';
                const roll = rolloverDe(f.id);
                const guardada = r?.finalReading !== undefined && edits[f.id] === undefined && rollEdits[f.id] === undefined;
                const invalida = v?.estado === 'invalida';
                const ok = v?.estado === 'ok';

                return (
                  <tr key={f.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{f.pumpName}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ width: 22, height: 22, borderRadius: 5, background: '#0f1f3d', color: '#fbbf24', fontSize: 10, fontWeight: 800, display: 'inline-grid', placeItems: 'center' }}>{f.face}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>D{f.name.slice(-1)}</td>
                    <td style={{ padding: '10px 14px' }}><Badge tone="neutral" dot>{f.fuelName}</Badge></td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>
                      {r ? fmtNum(r.initialReading, 3) : <Badge tone="neutral">Sin inicial</Badge>}
                      {r?.continuityBreak && <div style={{ marginTop: 4 }}><Badge tone="warning" icon="alert">Continuidad</Badge></div>}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      {isMant ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Badge tone="neutral">Mantenimiento</Badge>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <input
                            value={finalTxt(f.id)}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (/^\d*\.?\d*$/.test(val)) setEdits(s => ({ ...s, [f.id]: val }));
                            }}
                            disabled={isClosed || !r}
                            style={{
                              width: 120, padding: '6px 8px', textAlign: 'right',
                              fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 700, color: '#0f172a',
                              border: `1px solid ${invalida ? '#ef4444' : '#e2e8f0'}`, borderRadius: 7, background: isClosed || !r ? '#f8fafc' : 'white', outline: 'none',
                            }}
                          />
                          {guardada && !isClosed && <span style={{ fontSize: 10.5, color: '#16a34a' }}>Guardada</span>}
                          {invalida && !roll && !isClosed && (
                            <button onClick={() => setRolloverPide(f)} style={{ fontSize: 10.5, color: '#b45309', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                              ¿Vuelta a cero?
                            </button>
                          )}
                          {roll && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Badge tone="info" icon="history">Vuelta a cero</Badge>
                              {!isClosed && (
                                <button onClick={() => setRollEdits(s => ({ ...s, [f.id]: false }))} title="Quitar vuelta a cero" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#64748b', padding: 0 }}>
                                  <Icon name="x" size={12}/>
                                </button>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: ok ? '#16a34a' : invalida ? '#dc2626' : '#94a3b8' }}>{ok ? `+${fmtNum(v.litros, 3)}` : invalida ? 'Final menor' : '-'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{ok ? fmtNum(v.litros / LITERS_PER_GALLON, 2) : '-'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>L. {(v?.precio ?? 0).toFixed(2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: ok ? '#0f172a' : '#94a3b8' }}>{ok ? fmtL(v.total) : '-'}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                      {puedeCerrar && r && !isMant && (
                        <button
                          onClick={() => setCorr({ reading: r, fila: f, campo: r.finalReading !== undefined ? 'final' : 'inicial', valor: '', motivo: '' })}
                          title="Corregir lectura (con motivo)"
                          style={{ border: '1px solid #e2e8f0', background: 'white', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', display: 'inline-grid', placeItems: 'center', color: '#475569' }}
                        >
                          <Icon name="edit" size={13}/>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#0f1f3d', color: 'white' }}>
                <td colSpan={6} style={{ padding: '14px 14px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: '#fbbf24' }}>Totales del día</td>
                <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800 }}>{fmtNum(totals.l, 2)} L</td>
                <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800 }}>{fmtNum(totalGal, 2)} gal</td>
                <td/>
                <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: '#fbbf24' }}>{fmtL(totals.m)}</td>
                <td/>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {isClosed && (
        <div style={{ background: '#dcfce7', borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #86efac' }}>
          <Icon name="lock" size={18} style={{ color: '#16a34a' }}/>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>Día cerrado correctamente</div>
            <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>Corregir una lectura o reabrir el día requiere permiso de cierre y un motivo; queda registrado en la auditoría.</div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`¿Cerrar el día ${fechaHN(today)}?`}
        message={`Se guardarán las lecturas finales y se cerrará el día con ${rows.length} dispensadores, total de ${fmtL(totals.m)}. Después del cierre, las correcciones requieren motivo y quedan en la auditoría.`}
        confirmLabel="Sí, cerrar día"
        icon="lock"
        tone="warning"
        onConfirm={handleClose}
      />

      <ConfirmDialog
        open={!!rolloverPide}
        onClose={() => setRolloverPide(null)}
        title="¿El totalizador dio la vuelta a cero?"
        message={rolloverPide ? (() => {
          const r = lecturaDe.get(rolloverPide.id);
          const max = r?.meterMax ?? rolloverPide.meterMax;
          const l = litrosRollover(rolloverPide);
          return `${etiqueta(rolloverPide)}: litros = final + máximo del totalizador − inicial = ${finalTxt(rolloverPide.id)} + ${max} − ${r?.initialReading ?? 0} = ${l === null ? 'no válido' : fmtNum(l, 3)} L. Confírmalo solo si el contador pasó por cero; quedará en la auditoría.`;
        })() : ''}
        confirmLabel="Sí, vuelta a cero"
        icon="history"
        tone="warning"
        onConfirm={confirmarRollover}
      />

      <Modal
        open={!!corr}
        onClose={() => setCorr(null)}
        title="Corregir lectura"
        subtitle={corr ? `${etiqueta(corr.fila)} · ${fechaHN(corr.reading.date)}. El valor anterior, el nuevo y el motivo quedan en la auditoría.` : undefined}
        icon="edit"
        iconTone="warning"
        width={480}
        footer={<>
          <Button variant="secondary" onClick={() => setCorr(null)}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={guardarCorreccion}>Guardar corrección</Button>
        </>}
      >
        {corr && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['inicial', 'final'] as const).map(c => (
                <button key={c} onClick={() => setCorr({ ...corr, campo: c })}
                  disabled={c === 'final' && corr.reading.finalReading === undefined}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', border: 0,
                    cursor: c === 'final' && corr.reading.finalReading === undefined ? 'not-allowed' : 'pointer',
                    background: corr.campo === c ? '#0f1f3d' : 'white', color: corr.campo === c ? 'white' : '#475569',
                    boxShadow: corr.campo === c ? 'none' : '0 0 0 1px #e2e8f0',
                  }}>Lectura {c}</button>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: '#475569' }}>
              Valor actual: <b style={{ fontFamily: 'ui-monospace, monospace' }}>{(corr.campo === 'inicial' ? corr.reading.initialReading : corr.reading.finalReading)?.toString() ?? '—'}</b>
            </div>
            <TextField label="Valor correcto" prefix="L" suffix="ltrs" value={corr.valor} autoFocus
              onChange={val => { if (/^\d*\.?\d*$/.test(val)) setCorr({ ...corr, valor: val }); }} />
            <TextField label="Motivo (obligatorio)" value={corr.motivo} placeholder="Ej.: error de digitación, foto del totalizador"
              onChange={val => setCorr({ ...corr, motivo: val })} />
          </div>
        )}
      </Modal>

      <Modal
        open={reabrir !== null}
        onClose={() => setReabrir(null)}
        title={`Reabrir el día ${fechaHN(today)}`}
        subtitle="Vuelve a permitir editar las lecturas finales. El motivo queda en la auditoría."
        icon="unlock"
        iconTone="warning"
        width={460}
        footer={<>
          <Button variant="secondary" onClick={() => setReabrir(null)}>Cancelar</Button>
          <Button variant="primary" icon="unlock" onClick={confirmarReapertura}>Reabrir día</Button>
        </>}
      >
        <TextField label="Motivo (obligatorio)" value={reabrir ?? ''} autoFocus placeholder="Ej.: lectura final de Bomba 02 mal digitada"
          onChange={val => setReabrir(val)} />
      </Modal>
    </div>
  );
}
