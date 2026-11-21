'use client';

import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import TextField from '@/components/ui/TextField';
import Modal from '@/components/overlays/Modal';
import { DayStatus, FuelReceipt } from '@/types';
import { arrayUnion, deleteField, doc, getDoc, increment, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { buildCuadro } from '@/lib/totalizadores';
import { FUELS } from '@/lib/constants';
import { fmtNum } from '@/lib/utils';
import {
  TABLAS, ANOMALIAS, TanqueId, TablaCalibracion, galonesDesdePulgadas, cuadreTanque, maxPulgadas, esAnomalia, LITROS_POR_GALON, galonesPipa,
} from '@/lib/calibracion';
import { recibidoTanque, totalPipas, fueraDeUmbral, cuadreParaGuardar, diaAnterior, comparaApertura, fusionarBorrador, UMBRAL_EVAPORACION_PCT } from '@/lib/inventario';

type Tab = 'apertura' | 'recepciones' | 'cierre' | 'tablas';
type FuelKey = 'super' | 'regular' | 'diesel';
const TANQUES: FuelKey[] = ['super', 'regular', 'diesel'];
const NOMBRE: Record<FuelKey, string> = { super: 'Súper', regular: 'Regular', diesel: 'Diésel' };
const COLOR: Record<FuelKey, string> = { super: '#ef4444', regular: '#22c55e', diesel: '#f59e0b' };

const tablaDe = (f: FuelKey): TablaCalibracion | null => (f === 'diesel' || f === 'super' ? TABLAS[f as TanqueId] : null);
const NUM = /^\d*\.?\d*$/;
const VACIO: Record<FuelKey, string> = { super: '', regular: '', diesel: '' };

/** Varilla guardada como texto: pulgadas para tanques con tabla, galones para los demás. */
function leerVarilla(ds: DayStatus | null | undefined, f: FuelKey, campo: 'initial' | 'final'): string {
  const tk = ds?.tanks?.[f];
  const v = tablaDe(f) ? tk?.[`${campo}Inches`] : tk?.[`${campo}Gallons`];
  return v !== undefined && v !== null ? String(v) : '';
}
const leerTodas = (ds: DayStatus | null | undefined, campo: 'initial' | 'final') =>
  ({ super: leerVarilla(ds, 'super', campo), regular: leerVarilla(ds, 'regular', campo), diesel: leerVarilla(ds, 'diesel', campo) });
const fechaCorta = (iso: string) => iso.split('-').reverse().slice(0, 2).join('/');


/** Galones a partir de lo digitado: pulgadas con tabla, galones directos sin tabla. */
function aGalones(f: FuelKey, texto: string): { gal: number | null; error?: string } {
  if (texto.trim() === '') return { gal: null };
  const n = parseFloat(texto);
  if (!Number.isFinite(n)) return { gal: null, error: 'Número inválido' };
  const t = tablaDe(f);
  if (!t) return { gal: n };
  const g = galonesDesdePulgadas(t, n);
  return g === null ? { gal: null, error: `Fuera de tabla (0 – ${maxPulgadas(t)} pulg)` } : { gal: g };
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '12px 16px', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 14, fontWeight: active ? 800 : 600, color: active ? '#0f172a' : '#64748b',
  borderBottom: active ? '3px solid #fbbf24' : '3px solid transparent', whiteSpace: 'nowrap',
});
const panel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' };
const fila: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8 };
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' };

function TanqueInput({ f, label, value, onChange, disabled, aviso }: { f: FuelKey; label: string; value: string; onChange: (v: string) => void; disabled: boolean; aviso?: ReactNode }) {
  const t = tablaDe(f);
  const { gal, error } = aGalones(f, value);
  return (
    <div style={panel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: COLOR[f] }}/>Tanque {NOMBRE[f]}
        </span>
        {t ? <Badge tone="info">{fmtNum(t.capacidad, 0)} gal</Badge> : <Badge tone="warning">Sin tabla</Badge>}
      </div>
      <TextField
        label={t ? `${label} (varilla)` : `${label} (galones)`}
        value={value}
        onChange={v => { if (NUM.test(v)) onChange(v); }}
        suffix={t ? 'pulg' : 'gal'}
        disabled={disabled}
        error={error}
      />
      {t && (
        <div style={{ ...fila, fontSize: 12.5, color: '#475569' }}>
          <span>Equivale a</span>
          <strong style={{ ...mono, color: '#0f172a' }}>{gal !== null ? `${fmtNum(gal, 2)} gal` : '—'}</strong>
        </div>
      )}
      {!t && <div style={{ fontSize: 11.5, color: '#94a3b8' }}>No se cargó tabla de calibración para este tanque: digite los galones.</div>}
      {aviso}
    </div>
  );
}

export default function ControlCombustibleScreen() {
  const { dayData, updateDayData, dayStatus, readings, pumps, currentPrices, today, roles, addAuditEntry } = useApp();
  const { appUser } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('apertura');
  const [iniciales, setIniciales] = useState<Record<FuelKey, string>>(VACIO);
  const [finales, setFinales] = useState<Record<FuelKey, string>>(VACIO);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [draftReceipt, setDraftReceipt] = useState<Partial<FuelReceipt>>({ fuelId: 'super' });
  const [draftGal, setDraftGal] = useState('');
  const [horoIni, setHoroIni] = useState('');
  const [horoFin, setHoroFin] = useState('');
  const [anular, setAnular] = useState<FuelReceipt | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ayer, setAyer] = useState<DayStatus | null>(null);
  // Campos que el usuario editó desde el último guardado: un snapshot del día no los pisa.
  const tocIni = useRef(new Set<FuelKey>());
  const tocFin = useRef(new Set<FuelKey>());
  const tocHoro = useRef(new Set<'ini' | 'fin'>());

  const rol = roles.find(r => r.id === appUser?.roleId);
  const puedeCerrar = rol?.permissions?.canCloseDay === true;
  const autor = appUser?.name || appUser?.email || 'Desconocido';
  const isClosed = dayStatus === 'cerrado';
  // Con el día cerrado, la varilla final (y la anulación de pipas) solo la corrige quien cierra el día.
  const finalBloqueado = isClosed && !puedeCerrar;

  // Día anterior: la apertura de hoy se precarga con su varilla final.
  useEffect(() => {
    let vivo = true;
    getDoc(doc(db, 'dayStatus', diaAnterior(today)))
      .then(snap => { if (vivo) setAyer(snap.exists() ? (snap.data() as DayStatus) : null); })
      .catch(() => { if (vivo) setAyer(null); });
    return () => { vivo = false; };
  }, [today]);

  // Lo guardado en el día (o, sin apertura, la final de ayer), solo en los campos que no se están digitando.
  useEffect(() => {
    if (!dayData) return;
    if (!tocHoro.current.has('ini')) setHoroIni(dayData.horometerInitial !== undefined ? String(dayData.horometerInitial) : '');
    if (!tocHoro.current.has('fin')) setHoroFin(dayData.horometerFinal !== undefined ? String(dayData.horometerFinal) : '');
    const hoyIni = leerTodas(dayData, 'initial');
    const ayerFin = leerTodas(ayer, 'final');
    const srvIni = Object.fromEntries(TANQUES.map(f => [f, hoyIni[f] !== '' ? hoyIni[f] : ayerFin[f]])) as Record<FuelKey, string>;
    setIniciales(s => fusionarBorrador(s, srvIni, tocIni.current));
    setFinales(s => fusionarBorrador(s, leerTodas(dayData, 'final'), tocFin.current));
  }, [dayData, ayer]);

  // Litros vendidos por producto: mismo cálculo que el Cuadro de totalizadores (duplicadas, mantenimiento,
  // bombas inactivas y lecturas inválidas se tratan igual en ambas pantallas).
  const cuadro = useMemo(() => buildCuadro(pumps, readings, currentPrices), [pumps, readings, currentPrices]);
  const vendidoL = useMemo(() => Object.fromEntries(cuadro.productos.map(p => [p.fuelId, p.litros])) as Record<string, number>, [cuadro]);
  const pendientesPorProducto = useMemo(() => {
    const m: Record<string, number> = {};
    // Toda manguera operable que no suma al vendido (sin final, final < inicial o sin inicial) deja el cuadre provisional.
    cuadro.grupos.flatMap(g => g.filas).forEach(f => {
      if (f.estado === 'pendiente' || f.estado === 'invalida' || f.estado === 'sin_inicial') m[f.fuelId] = (m[f.fuelId] || 0) + 1;
    });
    return m;
  }, [cuadro]);

  const auditar = (action: string, target: string, detail: string, icon: string) => {
    const ahora = new Date();
    addAuditEntry({
      timestamp: ahora.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }),
      date: ahora.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      userId: appUser?.uid || 'unknown',
      userName: autor,
      userRole: rol?.name || 'Desconocido',
      action, target, detail, icon,
    }).catch(() => { /* la auditoría no bloquea la operación */ });
  };

  const guardar = async (campo: 'initial' | 'final', valores: Record<FuelKey, string>) => {
    const errores = TANQUES.filter(f => aGalones(f, valores[f]).error);
    if (errores.length) {
      toast.error('Revise las varillas', `Lectura fuera de tabla en ${errores.map(f => NOMBRE[f]).join(', ')}.`);
      return;
    }
    // Solo se envían los campos de este paso: setDoc con merge combina los mapas anidados y no pisa
    // lo que otro equipo haya guardado en el resto del día. Campo vacío = se borra el valor guardado.
    const tanks: Record<string, Record<string, unknown>> = {};
    const alertas: string[] = [];
    const savedAt = new Date().toISOString();
    TANQUES.forEach(f => {
      const vacio = valores[f].trim() === '';
      const { gal } = aGalones(f, valores[f]);
      const entry: Record<string, unknown> = {};
      if (tablaDe(f)) entry[`${campo}Inches`] = vacio ? deleteField() : parseFloat(valores[f]);
      entry[`${campo}Gallons`] = vacio || gal === null ? deleteField() : gal;
      if (campo === 'final') {
        // Resultado del cuadre al cerrar el inventario: queda en el doc del día para el histórico de evaporación.
        const tk = dayData?.tanks?.[f];
        const inicialGal = tk?.initialGallons;
        if (inicialGal !== undefined && gal !== null && !vacio) {
          const c = cuadreParaGuardar(
            cuadreTanque({ inicialGal, recibidoGal: recibidoTanque(dayData?.receipts, f, tk), vendidoL: vendidoL[f] || 0, finalGal: gal }),
            { provisional: (pendientesPorProducto[f] || 0) > 0, savedAt, savedBy: autor },
          );
          entry.cuadre = c;
          if (c.alerta) alertas.push(`${NOMBRE[f]} ${fmtNum(c.porcentaje ?? 0, 2)} %`);
        } else {
          entry.cuadre = deleteField();
        }
      }
      tanks[f] = entry;
    });
    const horo = campo === 'initial' ? horoIni : horoFin;
    if (horo.trim() !== '' && !Number.isFinite(parseFloat(horo))) {
      toast.error('Horómetro inválido', 'Ingrese las horas como número.');
      return;
    }
    const horoCampo = campo === 'initial' ? 'horometerInitial' : 'horometerFinal';
    try {
      await updateDayData({ tanks, [horoCampo]: horo.trim() === '' ? deleteField() : parseFloat(horo) } as unknown as Partial<DayStatus>);
      (campo === 'initial' ? tocIni : tocFin).current.clear();
      tocHoro.current.delete(campo === 'initial' ? 'ini' : 'fin');
      toast.success(campo === 'initial' ? 'Apertura guardada' : 'Cierre guardado',
        campo === 'initial' ? 'Inventario inicial de tanques registrado.' : 'Inventario final y cuadre registrados.');
      if (alertas.length) toast.warning(`Evaporación fuera de tolerancia (> ${fmtNum(UMBRAL_EVAPORACION_PCT, 1)} %)`, alertas.join(' · '));
    } catch {
      toast.error('No se guardó', 'Revise la conexión e intente de nuevo.');
    }
  };

  const addReceipt = async () => {
    const galones = parseFloat(draftGal);
    if (!Number.isFinite(galones) || galones <= 0) {
      toast.error('Cantidad inválida', 'Ingrese los galones recibidos.');
      return;
    }
    const fuel = FUELS.find(f => f.id === draftReceipt.fuelId) || FUELS[0];
    const newReceipt: FuelReceipt = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fuelId: fuel.id,
      fuelName: fuel.name,
      amount: Math.round(galones * LITROS_POR_GALON * 100) / 100,
      gallons: galones,
      driver: draftReceipt.driver || '',
      invoice: draftReceipt.invoice || '',
      plate: draftReceipt.plate || '',
      timestamp: new Date().toISOString(),
      createdBy: autor,
    };
    const key = fuel.id as FuelKey;
    try {
      // arrayUnion + increment: dos pipas registradas a la vez desde equipos distintos suman las dos.
      await updateDayData({
        receipts: arrayUnion(newReceipt),
        tanks: { [key]: { refueledGallons: increment(galones) } },
      } as unknown as Partial<DayStatus>);
      auditar('Pipa', fuel.name, `${fmtNum(galones, 2)} gal · factura ${newReceipt.invoice || 'S/N'}`, 'truck');
      setReceiptOpen(false);
      setDraftReceipt({ fuelId: 'super' });
      setDraftGal('');
      toast.success('Recepción registrada', `Se agregaron ${fmtNum(galones, 2)} gal al tanque de ${fuel.name}.`);
    } catch {
      toast.error('No se guardó', 'Revise la conexión e intente de nuevo.');
    }
  };

  /** Anula una pipa sin borrarla: queda marcada con motivo y autor, y deja de sumar al recibido. */
  const anularPipa = async () => {
    if (!anular) return;
    const razon = motivo.trim();
    if (razon.length < 3) {
      toast.error('Falta el motivo', 'Indique por qué se anula la pipa.');
      return;
    }
    const ref = doc(db, 'dayStatus', today);
    try {
      // Transacción: se reescribe la lista sobre la versión vigente del día (si otra pipa entra a la vez, reintenta).
      const rec = await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        const lista = (snap.data() as DayStatus | undefined)?.receipts || [];
        const actual = lista.find(r => r.id === anular.id);
        if (!actual) throw new Error('no-existe');
        if (actual.voided) throw new Error('ya-anulada');
        const nueva = lista.map(r => r.id === actual.id
          ? { ...r, voided: true, voidReason: razon, voidedBy: autor, voidedAt: new Date().toISOString() }
          : r);
        tx.set(ref, { receipts: nueva, tanks: { [actual.fuelId]: { refueledGallons: totalPipas(nueva, actual.fuelId) } } }, { merge: true });
        return actual;
      });
      auditar('Anulación pipa', rec.fuelName, `${fmtNum(galonesPipa(rec), 2)} gal · factura ${rec.invoice || 'S/N'} · motivo: ${razon}`, 'trash');
      setAnular(null);
      setMotivo('');
      toast.success('Pipa anulada', 'Ya no suma al inventario recibido.');
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      toast.error('No se anuló', m === 'ya-anulada' ? 'Esa pipa ya estaba anulada.' : m === 'no-existe' ? 'La pipa ya no existe en el día.' : 'Revise la conexión e intente de nuevo.');
    }
  };

  const [consulta, setConsulta] = useState<{ tanque: TanqueId; pulg: string }>({ tanque: 'diesel', pulg: '' });
  const consultaGal = consulta.pulg === '' ? null : galonesDesdePulgadas(TABLAS[consulta.tanque], parseFloat(consulta.pulg));

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ background: 'linear-gradient(135deg,#0a1530,#14275a)', color: 'white' }}>
        <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Gestión Diaria · {new Date().toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, letterSpacing: -0.3 }}>Control de Combustible y Evaporación</div>
        <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 4 }}>Varilla de tanques en pulgadas → galones con la tabla de calibración, llegada de pipas y cuadre contra los totalizadores.</div>
      </Card>

      <div role="tablist" style={{ display: 'flex', gap: 16, borderBottom: '1px solid #e2e8f0', marginBottom: 8, overflowX: 'auto' }}>
        <button role="tab" aria-selected={activeTab === 'apertura'} onClick={() => setActiveTab('apertura')} style={tabStyle(activeTab === 'apertura')}>Apertura (Varillas Iniciales)</button>
        <button role="tab" aria-selected={activeTab === 'recepciones'} onClick={() => setActiveTab('recepciones')} style={tabStyle(activeTab === 'recepciones')}>Recepciones (Pipas)</button>
        <button role="tab" aria-selected={activeTab === 'cierre'} onClick={() => setActiveTab('cierre')} style={tabStyle(activeTab === 'cierre')}>Cierre y Evaporación</button>
        <button role="tab" aria-selected={activeTab === 'tablas'} onClick={() => setActiveTab('tablas')} style={tabStyle(activeTab === 'tablas')}>Tablas de calibración</button>
      </div>

      {activeTab === 'apertura' && (
        <Card padding={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Varillas iniciales de los tanques</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Mida antes de empezar el despacho. Diésel y Súper en pulgadas; el sistema convierte a galones.</div>
            </div>
            <Button variant="primary" icon="check" onClick={() => guardar('initial', iniciales)} disabled={isClosed}>Guardar Apertura</Button>
          </div>
          <div className="grid-cols-4">
            <div style={panel}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Horómetro Planta</div>
              <TextField label="Horas iniciales" value={horoIni} onChange={v => { if (NUM.test(v)) { tocHoro.current.add('ini'); setHoroIni(v); } }} suffix="hrs" disabled={isClosed}/>
            </div>
            {TANQUES.map(f => {
              // Arrastre: sin apertura guardada, el campo trae la varilla final de ayer; si la de hoy difiere, se avisa.
              const ayerTxt = leerVarilla(ayer, f, 'final');
              const sinGuardar = leerVarilla(dayData, f, 'initial') === '';
              const precargado = sinGuardar && ayerTxt !== '' && iniciales[f] === ayerTxt;
              const cmp = comparaApertura(aGalones(f, iniciales[f]).gal, ayer?.tanks?.[f]?.finalGallons);
              const aviso = precargado ? (
                <div style={{ fontSize: 11.5, color: '#1d4ed8', fontWeight: 600 }}>Precargado con la varilla final de ayer ({fechaCorta(ayer?.date || diaAnterior(today))}). Confírmelo y guarde.</div>
              ) : cmp.difiere && cmp.diferenciaGal !== null ? (
                <div style={{ fontSize: 11.5, color: '#b45309', fontWeight: 600 }}>
                  Difiere de la final de ayer ({fmtNum(ayer?.tanks?.[f]?.finalGallons ?? 0, 2)} gal) en {cmp.diferenciaGal > 0 ? '+' : '−'}{fmtNum(Math.abs(cmp.diferenciaGal), 2)} gal.
                </div>
              ) : undefined;
              return (
                <TanqueInput key={f} f={f} label="Inicial" value={iniciales[f]} onChange={v => { tocIni.current.add(f); setIniciales(s => ({ ...s, [f]: v })); }} disabled={isClosed} aviso={aviso}/>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === 'recepciones' && (
        <Card padding={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Entradas de combustible (pipas)</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Registre cada descarga en galones, según la factura.</div>
            </div>
            <Button variant="primary" icon="plus" onClick={() => setReceiptOpen(true)} disabled={isClosed}>Registrar Pipa</Button>
          </div>
          {!dayData?.receipts || dayData.receipts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
              <Icon name="droplet" size={32} style={{ color: '#94a3b8', marginBottom: 12 }}/>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>No se han registrado descargas hoy</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Haga clic en «Registrar Pipa» cuando ingrese producto.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {dayData.receipts.map(rec => (
                <div key={rec.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: rec.voided ? '#f8fafc' : 'white', flexWrap: 'wrap', opacity: rec.voided ? 0.75 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f1f5f9', display: 'grid', placeItems: 'center' }}>
                      <Icon name="truck" size={20} style={{ color: '#64748b' }}/>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', display: 'flex', gap: 8, alignItems: 'center' }}>
                        Factura: {rec.invoice || 'S/N'}
                        <span style={{ fontSize: 10, padding: '2px 6px', background: '#f1f5f9', borderRadius: 4, textTransform: 'uppercase' }}>{rec.fuelName}</span>
                        {rec.voided && <Badge tone="danger" size="sm">Anulada</Badge>}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Placa: {rec.plate || 'N/A'} · Conductor: {rec.driver || 'N/A'} · {new Date(rec.timestamp).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}{rec.createdBy ? ` · Registró: ${rec.createdBy}` : ''}</div>
                      {rec.voided && (
                        <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>Motivo: {rec.voidReason || '—'} · {rec.voidedBy || '—'}{rec.voidedAt ? ` · ${new Date(rec.voidedAt).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: rec.voided ? '#94a3b8' : '#16a34a', textDecoration: rec.voided ? 'line-through' : 'none', ...mono }}>+{fmtNum(galonesPipa(rec), 2)} gal</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{fmtNum(galonesPipa(rec) * LITROS_POR_GALON, 2)} L</div>
                    </div>
                    {!rec.voided && (
                      <Button variant="ghost" size="sm" icon="x" onClick={() => { setMotivo(''); setAnular(rec); }} disabled={finalBloqueado}>Anular</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'cierre' && (
        <Card padding={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Cierre y cuadre de evaporación</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Inicial + pipas − vendido (totalizadores) = lo que debería quedar. Se compara con la varilla final.</div>
            </div>
            <Button variant="primary" icon="lock" onClick={() => guardar('final', finales)} disabled={finalBloqueado}>Guardar y Cuadrar</Button>
          </div>
          {isClosed && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: puedeCerrar ? '#eff6ff' : '#f8fafc', border: `1px solid ${puedeCerrar ? '#bfdbfe' : '#e2e8f0'}`, color: puedeCerrar ? '#1e40af' : '#475569', fontSize: 12.5 }}>
              {puedeCerrar
                ? 'El día está cerrado. Como responsable del cierre puede corregir la varilla final y volver a cuadrar.'
                : 'El día está cerrado. Solo quien cierra el día puede corregir la varilla final.'}
            </div>
          )}

          <div className="grid-cols-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={panel}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Horómetro Planta</div>
                <TextField label="Horas finales" value={horoFin} onChange={v => { if (NUM.test(v)) { tocHoro.current.add('fin'); setHoroFin(v); } }} suffix="hrs" disabled={finalBloqueado}/>
                <div style={{ ...fila, fontSize: 12, color: '#64748b' }}><span>Inicial</span><span style={mono}>{dayData?.horometerInitial !== undefined ? `${dayData.horometerInitial} hrs` : '—'}</span></div>
                <div style={{ ...fila, fontSize: 13, fontWeight: 800, color: '#0f172a', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                  <span>Trabajado</span>
                  <span style={mono}>{dayData?.horometerInitial !== undefined && Number.isFinite(parseFloat(horoFin)) ? `${fmtNum(parseFloat(horoFin) - dayData.horometerInitial, 2)} hrs` : '—'}</span>
                </div>
                {dayData?.horometerInitial !== undefined && Number.isFinite(parseFloat(horoFin)) && parseFloat(horoFin) < dayData.horometerInitial && (
                  <div style={{ fontSize: 11.5, color: '#dc2626', fontWeight: 600 }}>Las horas finales son menores que las iniciales.</div>
                )}
              </div>
            </div>
            {TANQUES.map(f => {
              const tk = dayData?.tanks?.[f];
              const inicialGal = tk?.initialGallons;
              const finalGal = aGalones(f, finales[f]).gal;
              const recibidoGal = recibidoTanque(dayData?.receipts, f, tk);
              const c = inicialGal !== undefined && finalGal !== null
                ? cuadreTanque({ inicialGal, recibidoGal, vendidoL: vendidoL[f] || 0, finalGal })
                : null;
              const alerta = !!c && fueraDeUmbral(c.porcentaje);
              const guardado = tk?.cuadre;
              const tono = !c ? '#64748b' : c.diferenciaGal < 0 ? '#dc2626' : c.diferenciaGal > 0 ? '#16a34a' : '#64748b';
              const fondo = !c ? '#f8fafc' : c.diferenciaGal < 0 ? '#fef2f2' : c.diferenciaGal > 0 ? '#f0fdf4' : '#f8fafc';
              return (
                <div key={f} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <TanqueInput f={f} label="Final" value={finales[f]} onChange={v => { tocFin.current.add(f); setFinales(s => ({ ...s, [f]: v })); }} disabled={finalBloqueado}/>
                  <div style={{ ...panel, background: 'white', gap: 6, fontSize: 12.5, color: '#475569' }}>
                    <div style={fila}><span>Inventario inicial</span><span style={mono}>{inicialGal !== undefined ? `${fmtNum(inicialGal, 2)} gal` : 'sin apertura'}</span></div>
                    <div style={fila}><span>Pipas recibidas</span><span style={{ ...mono, color: '#16a34a' }}>+{fmtNum(recibidoGal, 2)} gal</span></div>
                    <div style={fila}><span>Vendido (totalizadores)</span><span style={{ ...mono, color: '#d97706' }}>−{fmtNum((vendidoL[f] || 0) / LITROS_POR_GALON, 2)} gal</span></div>
                    <div style={{ ...fila, borderTop: '1px solid #e2e8f0', paddingTop: 6, fontWeight: 700, color: '#0f172a' }}><span>Debería quedar</span><span style={mono}>{c ? `${fmtNum(c.teoricoGal, 2)} gal` : '—'}</span></div>
                    <div style={{ ...fila, fontWeight: 700, color: '#0f172a' }}><span>Medido (varilla)</span><span style={mono}>{finalGal !== null ? `${fmtNum(finalGal, 2)} gal` : '—'}</span></div>
                    <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 8, background: fondo, color: tono, fontWeight: 800, boxShadow: alerta ? '0 0 0 2px #dc2626' : 'none' }}>
                      {!c ? (
                        <span style={{ fontWeight: 600 }}>{inicialGal === undefined ? 'Falta la varilla inicial.' : 'Ingrese la varilla final.'}</span>
                      ) : (
                        <>
                          <div style={fila}>
                            <span>{c.diferenciaGal < 0 ? 'Faltante / evaporación' : c.diferenciaGal > 0 ? 'Sobrante' : 'Exacto'}</span>
                            <span style={mono}>{fmtNum(Math.abs(c.diferenciaGal), 2)} gal</span>
                          </div>
                          {pendientesPorProducto[f] > 0 && (
                            <div style={{ fontWeight: 600, fontSize: 11.5, color: '#b45309' }}>
                              Provisional: {pendientesPorProducto[f]} manguera{pendientesPorProducto[f] > 1 ? 's' : ''} sin lectura completa.
                            </div>
                          )}
                          <div style={{ ...fila, fontWeight: 600, fontSize: 11.5 }}>
                            <span>{fmtNum(Math.abs(c.diferenciaL), 2)} L</span>
                            <span>{c.porcentaje !== null ? `${fmtNum(Math.abs(c.porcentaje), 2)} % de lo vendido` : 'sin ventas'}</span>
                          </div>
                          {alerta && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11.5, color: '#b91c1c' }}>
                              <Icon name="alert" size={13}/>Fuera de tolerancia (más de {fmtNum(UMBRAL_EVAPORACION_PCT, 1)} %)
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: guardado ? '#475569' : '#94a3b8' }}>
                      {guardado
                        ? `Cuadre guardado ${new Date(guardado.savedAt).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })} por ${guardado.savedBy}: ${guardado.diferenciaGal > 0 ? '+' : guardado.diferenciaGal < 0 ? '−' : ''}${fmtNum(Math.abs(guardado.diferenciaGal), 2)} gal${guardado.porcentaje !== null ? ` (${fmtNum(guardado.porcentaje, 2)} %)` : ''}${guardado.provisional ? ' · provisional' : ''}`
                        : 'Cuadre sin guardar.'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === 'tablas' && (
        <>
          <Card padding={24}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Consulta rápida</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Tablas de calibración del tanque horizontal · Guaimaca. Entre puntos de la tabla se interpola.</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['diesel', 'super'] as TanqueId[]).map(id => (
                  <button key={id} onClick={() => setConsulta(c => ({ ...c, tanque: id }))} aria-pressed={consulta.tanque === id} style={{
                    padding: '10px 14px', borderRadius: 9, fontFamily: 'inherit', cursor: 'pointer', border: 0, fontSize: 13, fontWeight: 700,
                    background: consulta.tanque === id ? COLOR[id] + '22' : '#f8fafc',
                    boxShadow: consulta.tanque === id ? `0 0 0 2px ${COLOR[id]}` : '0 0 0 1px #e2e8f0', color: '#0f172a',
                  }}>{TABLAS[id].nombre} · {fmtNum(TABLAS[id].capacidad, 0)} gal</button>
                ))}
              </div>
              <TextField label="Varilla" suffix="pulg" value={consulta.pulg} onChange={v => { if (NUM.test(v)) setConsulta(c => ({ ...c, pulg: v })); }} style={{ width: 160 }} inputStyle={{ minWidth: 0, width: '100%' }}/>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', ...mono, paddingBottom: 6 }}>
                {consulta.pulg === '' ? '—' : consultaGal === null ? <span style={{ fontSize: 13, color: '#dc2626' }}>Fuera de tabla</span> : `${fmtNum(consultaGal, 2)} gal`}
              </div>
            </div>
            <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', color: '#854d0e', fontSize: 12.5 }}>
              <strong>Valores a revisar en la hoja impresa</strong> (se usan tal cual, resaltados abajo):
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {ANOMALIAS.map(a => <li key={`${a.tanque}-${a.pulgadas}`}>{TABLAS[a.tanque].nombre} {fmtNum(a.pulgadas, 2)} pulg = {a.galones} gal — {a.nota}</li>)}
              </ul>
            </div>
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {(['diesel', 'super'] as TanqueId[]).map(id => {
              const t = TABLAS[id];
              const pts = t.puntos.slice(1);
              const mitad = Math.ceil(pts.length / 2);
              return (
                <Card key={id} padding={0}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #eef0f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0f172a' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: COLOR[id] }}/>{t.nombre}
                    </span>
                    <Badge tone="info">Capacidad {fmtNum(t.capacidad, 0)} gal</Badge>
                  </div>
                  <div style={{ maxHeight: 420, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    {[pts.slice(0, mitad), pts.slice(mitad)].map((col, ci) => (
                      <table key={ci} style={{ borderCollapse: 'collapse', fontSize: 12.5, width: '100%', borderLeft: ci ? '1px solid #eef0f3' : 0 }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                          <tr><th style={{ padding: '6px 12px', textAlign: 'right', color: '#64748b', fontSize: 11 }}>PULG</th><th style={{ padding: '6px 12px', textAlign: 'right', color: '#64748b', fontSize: 11 }}>GAL</th></tr>
                        </thead>
                        <tbody>
                          {col.map(([p, g]) => {
                            const mala = esAnomalia(id, p);
                            return (
                              <tr key={p} style={{ borderTop: '1px solid #f1f5f9', background: mala ? '#fef3c7' : undefined }} title={mala ? 'Valor a revisar en la hoja impresa' : undefined}>
                                <td style={{ padding: '4px 12px', textAlign: 'right', ...mono, color: '#475569' }}>{p.toFixed(2)}</td>
                                <td style={{ padding: '4px 12px', textAlign: 'right', ...mono, fontWeight: 700, color: mala ? '#b45309' : '#0f172a' }}>{g}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Modal open={!!anular} onClose={() => setAnular(null)} title="Anular pipa" icon="alert" width={460} footer={
        <>
          <Button variant="secondary" onClick={() => setAnular(null)}>Cancelar</Button>
          <Button variant="danger" icon="x" onClick={anularPipa}>Anular pipa</Button>
        </>
      }>
        {anular && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: '#475569' }}>
              {anular.fuelName} · {fmtNum(galonesPipa(anular), 2)} gal · factura {anular.invoice || 'S/N'}. La pipa no se borra: queda marcada como anulada y deja de sumar al inventario recibido.
            </div>
            <TextField label="Motivo de la anulación *" value={motivo} onChange={setMotivo} placeholder="Ej. galones mal digitados" autoFocus/>
          </div>
        )}
      </Modal>

      <Modal open={receiptOpen} onClose={() => setReceiptOpen(false)} title="Registrar Recepción (Pipa)" icon="truck" width={500} footer={
        <>
          <Button variant="secondary" onClick={() => setReceiptOpen(false)}>Cancelar</Button>
          <Button variant="primary" icon="plus" onClick={addReceipt}>Guardar Recepción</Button>
        </>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Producto Recibido *</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {FUELS.map(f => (
                <button key={f.id} onClick={() => setDraftReceipt(s => ({ ...s, fuelId: f.id }))} aria-pressed={draftReceipt.fuelId === f.id} style={{
                  padding: 10, borderRadius: 9, fontFamily: 'inherit', cursor: 'pointer',
                  border: 0, background: draftReceipt.fuelId === f.id ? f.color + '22' : '#f8fafc',
                  boxShadow: draftReceipt.fuelId === f.id ? `0 0 0 2px ${f.color}` : '0 0 0 1px #e2e8f0',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: f.color, color: 'white', display: 'grid', placeItems: 'center' }}><Icon name="droplet" size={10}/></div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{f.name}</span>
                </button>
              ))}
            </div>
          </div>
          <TextField
            label="Cantidad recibida (galones) *"
            value={draftGal}
            onChange={(val) => { if (NUM.test(val)) setDraftGal(val); }}
            suffix="gal"
            autoFocus
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <TextField label="Factura (Opcional)" value={draftReceipt.invoice || ''} onChange={(val) => setDraftReceipt(s => ({ ...s, invoice: val }))} placeholder="N° de factura"/>
            <TextField label="Placa del Vehículo (Opcional)" value={draftReceipt.plate || ''} onChange={(val) => setDraftReceipt(s => ({ ...s, plate: val }))} placeholder="Ej. AAA-0000"/>
          </div>
          <TextField label="Conductor (Opcional)" value={draftReceipt.driver || ''} onChange={(val) => setDraftReceipt(s => ({ ...s, driver: val }))}/>
        </div>
      </Modal>
    </div>
  );
}
