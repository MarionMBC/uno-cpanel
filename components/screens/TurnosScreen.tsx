'use client';

// B2–B8 (TASK-019): turnos, asignación de bomberos, lecturas por turno, corte de precio, arqueo y cierre del día.
// Solo aparece en el menú con settings/operacion.shiftsEnabled.
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '@/lib/firebase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import TextField from '@/components/ui/TextField';
import Modal from '@/components/overlays/Modal';
import { AsignacionTurno, AuditEntry, CashCount, DailyReading, PlantillaTurno, Shift, ShiftReading } from '@/types';
import { idLectura, METER_MAX_DEFAULT } from '@/lib/totalizadores';
import {
  bloqueoCierreDia, calcArqueo, calcVentaTurno, consolidadoAoa, fechaDeTurno, idTurno, inicialEncadenada, InicialSugerida,
  plantillaVigente, preciosCambiados, rompeCadena, turnoAoa, validarArqueo, validarAsignaciones, ventasPorBombero,
} from '@/lib/turnos';
import { abrirTurno, AperturaManguera, cerrarTurno, corregirFinalTurno, cortarPrecio, guardarArqueo, refEstado } from '@/lib/turnosDb';
import { fmtL, fmtNum } from '@/lib/utils';

const fechaHN = (iso: string) => iso.split('-').reverse().join('/');
const horaHN = (iso?: string) => (iso ? new Date(iso).toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' };
const th: React.CSSProperties = { padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'right', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '9px 12px', textAlign: 'right', ...mono, color: '#334155', whiteSpace: 'nowrap', fontSize: 13 };
const inp: React.CSSProperties = { height: 32, border: '1px solid #e2e8f0', borderRadius: 7, padding: '0 8px', fontSize: 13, fontFamily: 'inherit', minWidth: 0, ...mono };
const MOTIVO_MIN = 5;
const num = (t: string) => (t.trim() === '' ? NaN : Number(t.replace(',', '.')));
const etiqueta = (r: Pick<ShiftReading, 'pumpName' | 'face' | 'dispenserName'>) => `${r.pumpName} ${r.face}-${r.dispenserName.slice(-1)}`;

interface FilaApertura { base: AperturaManguera['base']; sugerida: InicialSugerida; inicial: string; motivo: string }
interface BomberoBorrador { email: string; name: string; fondo: string; dispenserIds: string[] }
interface ArqueoBorrador { cash: string; card: string; credits: string; partialDrops: string; notes: string }
interface CorreccionTurno { r: ShiftReading; valor: string; rollover: boolean; motivo: string }

export default function TurnosScreen() {
  const { pumps, roles, users, currentPrices, operacion, today, addAuditEntry } = useApp();
  const { appUser } = useAuth();
  const toast = useToast();
  const role = roles.find(r => r.id === appUser?.roleId);
  const puedeCerrar = role?.permissions?.canCloseDay === true;
  const miCorreo = (appUser?.email || '').toLowerCase();
  const autor = { email: miCorreo, name: appUser?.name || miCorreo };
  const precios = currentPrices as unknown as Record<string, number>;

  // ─── Suscripciones ───
  const [estado, setEstado] = useState<{ openShiftId: string | null; lastShiftId: string | null }>({ openShiftId: null, lastShiftId: null });
  const [fecha, setFecha] = useState(today);
  const [dia, setDia] = useState<{ fecha: string; shifts: Shift[]; lecturas: ShiftReading[]; arqueos: CashCount[] }>({ fecha: '', shifts: [], lecturas: [], arqueos: [] });
  const [selId, setSelId] = useState<string | null>(null);
  const [diaCerrado, setDiaCerrado] = useState(false);

  useEffect(() => onSnapshot(refEstado(), s => {
    const d = s.exists() ? s.data() : {};
    const abierto = (d.openShiftId as string | null) ?? null;
    setEstado({ openShiftId: abierto, lastShiftId: (d.lastShiftId as string | null) ?? null });
    // Turno nocturno abierto de ayer: se muestra su día.
    if (abierto) { setFecha(abierto.slice(0, 10)); setSelId(abierto); }
  }, e => console.warn('shiftState:', e.message)), []);

  useEffect(() => {
    const parcial: { shifts?: Shift[]; lecturas?: ShiftReading[]; arqueos?: CashCount[] } = {};
    const publicar = () => {
      if (parcial.shifts && parcial.lecturas && parcial.arqueos) setDia({ fecha, shifts: parcial.shifts, lecturas: parcial.lecturas, arqueos: parcial.arqueos });
    };
    const err = (e: Error) => console.warn('turnos:', e.message);
    const u1 = onSnapshot(query(collection(db, 'shifts'), where('date', '==', fecha)), s => {
      parcial.shifts = s.docs.map(d => ({ id: d.id, ...d.data() } as Shift)).sort((a, b) => a.openedAt.localeCompare(b.openedAt)); publicar();
    }, err);
    const u2 = onSnapshot(query(collection(db, 'shiftReadings'), where('date', '==', fecha)), s => {
      parcial.lecturas = s.docs.map(d => ({ id: d.id, ...d.data() } as ShiftReading)); publicar();
    }, err);
    const u3 = onSnapshot(query(collection(db, 'cashCounts'), where('date', '==', fecha)), s => {
      parcial.arqueos = s.docs.map(d => ({ id: d.id, ...d.data() } as CashCount)); publicar();
    }, err);
    const u4 = onSnapshot(doc(db, 'dayStatus', fecha), s => setDiaCerrado(s.exists() && s.data().status === 'cerrado'), err);
    return () => { u1(); u2(); u3(); u4(); };
  }, [fecha]);

  // Días operativos a los que irían los turnos que se pueden abrir ahora (hoy o, el nocturno, ayer).
  const fechasApertura = [...new Set(operacion.shiftTemplates.map(p => fechaDeTurno(p, new Date(), operacion.timeZone)))].sort().join(',');
  const [cerradosApertura, setCerradosApertura] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const unsubs = fechasApertura.split(',').filter(Boolean).map(f => onSnapshot(doc(db, 'dayStatus', f),
      s => setCerradosApertura(c => ({ ...c, [f]: s.exists() && s.data().status === 'cerrado' })),
      e => console.warn('dayStatus:', e.message)));
    return () => unsubs.forEach(u => u());
  }, [fechasApertura]);

  const datos = dia.fecha === fecha ? dia : { fecha, shifts: [], lecturas: [], arqueos: [] };
  const sel = datos.shifts.find(s => s.id === selId) ?? datos.shifts[datos.shifts.length - 1] ?? null;
  const lecturasSel = useMemo(() => (sel ? datos.lecturas.filter(r => r.shiftId === sel.id).sort((a, b) => a.dispenserId.localeCompare(b.dispenserId)) : []), [sel, datos.lecturas]);
  const arqueosSel = sel ? datos.arqueos.filter(c => c.shiftId === sel.id) : [];
  const abierto = datos.shifts.find(s => s.id === estado.openShiftId) ?? null;
  const cambiados = abierto ? preciosCambiados(abierto.prices, precios, datos.lecturas.filter(r => r.shiftId === abierto.id).map(r => r.fuelId)) : [];
  const razonesCierre = bloqueoCierreDia(fecha, datos.shifts, datos.arqueos);

  // Autor, rol y fecha-hora los pone AppContext desde la sesión (TASK-017).
  const auditar = async (action: string, target: string, detail: string, extra: Pick<Partial<AuditEntry>, 'before' | 'after' | 'reason' | 'icon'> = {}) => {
    try {
      await addAuditEntry({
        action, target, detail, icon: 'users', ...extra,
      });
    } catch (e) {
      console.error(e);
      toast.warning('Sin auditoría', 'Se guardó, pero no quedó el registro en la auditoría.');
    }
  };

  // ─── Abrir turno (B2/B3/B4) ───
  const [abrir, setAbrir] = useState<{ plantilla: PlantillaTurno; fecha: string; filas: FilaApertura[]; bomberos: BomberoBorrador[] } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const mangueras = useMemo(() => pumps.flatMap(p => p.faces.flatMap(f => f.dispensers
    .filter(d => p.isActive && d.status === 'activo')
    .map(d => ({
      dispenserId: d.id, dispenserName: d.name, face: f.id, pumpId: p.id, pumpName: p.name,
      fuelId: d.fuel, fuelName: d.fuelName, status: 'activo' as const, meterMax: d.meterMax ?? METER_MAX_DEFAULT,
    })))).sort((a, b) => a.dispenserId.localeCompare(b.dispenserId)), [pumps]);

  const prepararApertura = async (plantilla: PlantillaTurno) => {
    const f = fechaDeTurno(plantilla, new Date(), operacion.timeZone);
    if (cerradosApertura[f]) {
      toast.error('Día cerrado', `El ${fechaHN(f)} está cerrado. Reábrelo (con motivo) para abrir un turno en él.`);
      return;
    }
    setOcupado(true);
    try {
      const [prev, diarias] = await Promise.all([
        estado.lastShiftId ? getDocs(query(collection(db, 'shiftReadings'), where('shiftId', '==', estado.lastShiftId))) : Promise.resolve(null),
        getDocs(query(collection(db, 'readings'), where('date', '==', f))),
      ]);
      const anteriores = prev ? prev.docs.map(d => d.data() as ShiftReading) : [];
      const porDisp = new Map(diarias.docs.filter(d => d.id === idLectura(f, (d.data() as DailyReading).dispenserId)).map(d => [(d.data() as DailyReading).dispenserId, d.data() as DailyReading]));
      const filas = mangueras.map(m => {
        const sugerida = inicialEncadenada(m.dispenserId, anteriores, porDisp.get(m.dispenserId));
        return { base: m, sugerida, inicial: sugerida.valor === null ? '' : String(sugerida.valor), motivo: '' };
      });
      // Por defecto, los bomberos y mangueras del turno anterior.
      const anterior = datos.shifts.find(s => s.id === estado.lastShiftId);
      const bomberos: BomberoBorrador[] = anterior
        ? anterior.assignments.map(a => ({ email: a.email, name: a.name, fondo: String(a.cashFund), dispenserIds: a.dispenserIds.filter(d => mangueras.some(m => m.dispenserId === d)) }))
        : [{ email: '', name: '', fondo: '0', dispenserIds: mangueras.map(m => m.dispenserId) }];
      setAbrir({ plantilla, fecha: f, filas, bomberos });
    } catch (e) {
      console.error(e);
      toast.error('No se pudo preparar', 'No fue posible leer el turno anterior.');
    } finally {
      setOcupado(false);
    }
  };

  const asignacionesDe = (bs: BomberoBorrador[]): AsignacionTurno[] => bs.map(b => ({ email: b.email.trim().toLowerCase(), name: b.name.trim(), cashFund: num(b.fondo || '0'), dispenserIds: b.dispenserIds }));
  const erroresApertura = abrir ? [
    ...abrir.filas.flatMap(f => {
      const v = num(f.inicial);
      if (!Number.isFinite(v) || v < 0) return [`${etiqueta(f.base)}: inicial inválida.`];
      if (rompeCadena(v, f.sugerida) && f.motivo.trim().length < MOTIVO_MIN) return [`${etiqueta(f.base)}: difiere de la final anterior (${f.sugerida.valor}); escribe el motivo.`];
      return [];
    }),
    ...validarAsignaciones(abrir.filas.map(f => f.base.dispenserId), asignacionesDe(abrir.bomberos)),
    ...(datos.shifts.some(s => s.id === idTurno(abrir.fecha, abrir.plantilla.id)) && abrir.fecha === fecha ? [`El turno ${abrir.plantilla.name} del ${fechaHN(abrir.fecha)} ya existe.`] : []),
  ] : [];

  const confirmarApertura = async () => {
    if (!abrir || erroresApertura.length > 0) return;
    setOcupado(true);
    const prices = Object.fromEntries(Object.entries(precios).map(([k, v]) => [k, v]));
    try {
      const id = await abrirTurno({
        fecha: abrir.fecha, templateId: abrir.plantilla.id, name: abrir.plantilla.name, prices,
        assignments: asignacionesDe(abrir.bomberos), autor,
        mangueras: abrir.filas.map(f => ({ base: f.base, initialReading: num(f.inicial), previousFinal: f.sugerida.valor, continuityReason: f.motivo.trim() || undefined })),
      });
      toast.success('Turno abierto', `${abrir.plantilla.name} · ${fechaHN(abrir.fecha)}`);
      setFecha(abrir.fecha); setSelId(id);
      const rotas = abrir.filas.filter(f => rompeCadena(num(f.inicial), f.sugerida));
      setAbrir(null);
      await auditar('Apertura de turno', `${abrir.plantilla.name} ${fechaHN(abrir.fecha)}`,
        `${abrir.bomberos.map(b => `${b.name} (fondo ${b.fondo}): ${b.dispenserIds.length} mangueras`).join(' · ')} · precios ${Object.entries(prices).map(([k, v]) => `${k} ${v}`).join(', ')}`);
      for (const f of rotas) {
        await auditar('Turno: inicial distinta a la final anterior', `${etiqueta(f.base)} ${f.base.fuelName}`, f.motivo, { before: f.sugerida.valor ?? '', after: num(f.inicial), reason: f.motivo, icon: 'alert' });
      }
    } catch (e) {
      console.error(e);
      toast.error('No se abrió el turno', e instanceof Error ? e.message : 'Revisa la conexión.');
    } finally {
      setOcupado(false);
    }
  };

  // ─── Finales y cierre del turno (B4) ───
  const [finales, setFinales] = useState<Record<string, string>>({});
  const [rolls, setRolls] = useState<Record<string, boolean>>({});
  const lecturaEditada = (r: ShiftReading): ShiftReading => {
    if (r.finalReading !== undefined) return r;
    const t = finales[r.dispenserId] ?? '';
    return { ...r, finalReading: t === '' ? undefined : num(t), rollover: rolls[r.dispenserId] === true };
  };

  const cerrar = async (t: Shift | null) => {
    if (!t || t.status !== 'abierto') return;
    const ed = datos.lecturas.filter(r => r.shiftId === t.id).map(lecturaEditada);
    const malas = ed.filter(r => calcVentaTurno(r, precios).estado !== 'ok');
    if (malas.length > 0) {
      toast.error('Finales incompletas o inválidas', `${malas.map(etiqueta).join(', ')}: revisa la final (o marca vuelta a cero).`);
      return;
    }
    setOcupado(true);
    try {
      await cerrarTurno({ shift: t, autor, precios, finales: ed.map(r => ({ dispenserId: r.dispenserId, finalReading: r.finalReading as number, rollover: r.rollover === true })) });
      setFinales({}); setRolls({});
      const total = ed.reduce((s, r) => s + calcVentaTurno(r, precios).total, 0);
      toast.success('Turno cerrado', `${t.name} · ${fmtL(total)}. Falta el arqueo de cada bombero.`);
      await auditar('Cierre de turno', `${t.name} ${fechaHN(t.date)}`, ed.map(r => `${etiqueta(r)}: ${r.finalReading}${r.rollover ? ' (vuelta a cero)' : ''}`).join(' · '), { icon: 'lock' });
    } catch (e) {
      console.error(e);
      toast.error('No se cerró el turno', e instanceof Error ? e.message : 'Revisa la conexión.');
    } finally {
      setOcupado(false);
    }
  };

  // ─── Corregir una final con el turno cerrado (TASK-022) ───
  const [corr, setCorr] = useState<CorreccionTurno | null>(null);
  const puedeCorregir = puedeCerrar && !diaCerrado && sel?.status === 'cerrado';
  const confirmarCorreccion = async () => {
    if (!corr || !sel) return;
    const n = num(corr.valor);
    if (!Number.isFinite(n) || n < 0) { toast.error('Valor inválido', 'Ingresa un número mayor o igual a cero.'); return; }
    if (corr.motivo.trim().length < MOTIVO_MIN) { toast.error('Falta el motivo', `Escribe el motivo de la corrección (mínimo ${MOTIVO_MIN} caracteres).`); return; }
    setOcupado(true);
    const r = corr.r;
    try {
      const res = await corregirFinalTurno({ shiftId: sel.id as string, dispenserId: r.dispenserId, finalReading: n, rollover: corr.rollover, motivo: corr.motivo, precios, autor });
      setCorr(null);
      const arq = res.arqueo === 'recepcion_anulada' ? ' El arqueo del bombero se recalculó: vuelve a recibirlo.' : res.arqueo === 'recalculado' ? ' El arqueo del bombero se recalculó.' : '';
      toast.success('Final corregida', `${etiqueta(r)}: ${res.antes} → ${n}.${arq}`);
      await auditar('Corrección de final de turno', `${etiqueta(r)} ${r.fuelName} · ${sel.name} ${fechaHN(sel.date)}`,
        `Turno cerrado${corr.rollover ? ' · vuelta a cero' : ''}${res.finalDiaria ? ' · también la final del día' : ''}${res.arqueo === 'recepcion_anulada' ? ' · arqueo recalculado, recepción anulada' : res.arqueo ? ' · arqueo recalculado' : ''}`,
        { before: res.antes, after: n, reason: corr.motivo.trim(), icon: 'edit' });
    } catch (e) {
      console.error(e);
      toast.error('No se corrigió', e instanceof Error ? e.message : 'Revisa la conexión.');
    } finally {
      setOcupado(false);
    }
  };

  // ─── Corte de precio (B6) ───
  const [corte, setCorte] = useState<Record<string, string> | null>(null);
  const lecturasCorte = abierto ? datos.lecturas.filter(r => r.shiftId === abierto.id && cambiados.includes(r.fuelId)) : [];
  const confirmarCorte = async () => {
    if (!abierto || !corte) return;
    const malas = lecturasCorte.filter(r => {
      const v = num(corte[r.dispenserId] ?? '');
      const desde = r.cuts?.length ? r.cuts[r.cuts.length - 1].reading : r.initialReading;
      return !Number.isFinite(v) || v < desde;
    });
    if (malas.length > 0) { toast.error('Lecturas de corte inválidas', `${malas.map(etiqueta).join(', ')}: debe ser mayor o igual a la inicial del tramo.`); return; }
    setOcupado(true);
    const newPrices = { ...abierto.prices, ...Object.fromEntries(cambiados.map(f => [f, precios[f]])) };
    try {
      await cortarPrecio({
        shift: abierto, newPrices, autor,
        cortes: lecturasCorte.map(r => ({ dispenserId: r.dispenserId, reading: num(corte[r.dispenserId]), newPrice: precios[r.fuelId] })),
      });
      setCorte(null);
      toast.success('Corte de precio registrado', 'Los litros antes del corte quedan al precio anterior.');
      await auditar('Corte de precio en turno', `${abierto.name} ${fechaHN(abierto.date)}`,
        cambiados.map(f => `${f}: ${abierto.prices[f]} → ${precios[f]}`).join(' · '), { icon: 'tag' });
    } catch (e) {
      console.error(e);
      toast.error('No se registró el corte', e instanceof Error ? e.message : 'Revisa la conexión.');
    } finally {
      setOcupado(false);
    }
  };

  // ─── Arqueo (B5) ───
  const [arq, setArq] = useState<Record<string, ArqueoBorrador>>({});
  const ventasSel = sel ? ventasPorBombero(sel, lecturasSel, precios) : [];
  const visibles = sel ? sel.assignments.filter(a => puedeCerrar || a.email === miCorreo) : [];

  const borradorDe = (email: string): ArqueoBorrador => {
    if (arq[email]) return arq[email];
    const c = arqueosSel.find(x => x.email === email);
    return c
      ? { cash: String(c.cash), card: String(c.card), credits: String(c.credits), partialDrops: String(c.partialDrops), notes: c.notes || '' }
      : { cash: '', card: '', credits: '', partialDrops: '', notes: '' };
  };

  const guardarArq = async (a: AsignacionTurno, recibir: boolean) => {
    if (!sel) return;
    const b = borradorDe(a.email);
    const d = { cash: num(b.cash || '0'), card: num(b.card || '0'), credits: num(b.credits || '0'), partialDrops: num(b.partialDrops || '0') };
    const vb = ventasSel.find(v => v.email === a.email);
    const r = calcArqueo(vb?.total ?? 0, a.cashFund, d);
    const err = validarArqueo(d, r.difference, b.notes);
    if (sel.status !== 'cerrado' && recibir) err.push('Cierra el turno antes de recibir el arqueo.');
    if (diaCerrado) err.push('El día está cerrado: reábrelo (con motivo) para cambiar el arqueo.');
    if (err.length > 0) { toast.error('Arqueo incompleto', err[0]); return; }
    const previo = arqueosSel.find(x => x.email === a.email);
    const ahora = new Date().toISOString();
    const cc: CashCount = {
      shiftId: sel.id as string, date: sel.date, email: a.email, name: a.name,
      expectedSales: vb?.total ?? 0, cashFund: a.cashFund, ...d, ...r,
      notes: b.notes.trim() || undefined, declaredBy: previo?.declaredBy && !puedeCerrar ? previo.declaredBy : miCorreo, declaredAt: ahora,
      ...(recibir ? { receivedBy: miCorreo, receivedAt: ahora } : {}),
    };
    setOcupado(true);
    try {
      await guardarArqueo(cc);
      setArq(s => { const n = { ...s }; delete n[a.email]; return n; });
      toast.success(recibir ? 'Arqueo recibido' : 'Arqueo guardado', `${a.name}: diferencia ${fmtL(r.difference)}`);
      await auditar(recibir ? 'Arqueo recibido' : 'Arqueo declarado', `${a.name} · ${sel.name} ${fechaHN(sel.date)}`,
        `Esperado ${fmtL(r.expected)} · declarado ${fmtL(r.declared)} (efectivo ${d.cash}, POS ${d.card}, créditos/vales ${d.credits}, retiros ${d.partialDrops}) · diferencia ${fmtL(r.difference)}`,
        { before: r.expected, after: r.declared, ...(cc.notes ? { reason: cc.notes } : {}), icon: 'check' });
    } catch (e) {
      console.error(e);
      toast.error('No se guardó el arqueo', 'Revisa tu permiso y la conexión.');
    } finally {
      setOcupado(false);
    }
  };

  // ─── Cierre del día (B7) ───
  const cerrarDia = async () => {
    if (!puedeCerrar || razonesCierre.length > 0) return;
    setOcupado(true);
    try {
      await setDoc(doc(db, 'dayStatus', fecha), { date: fecha, status: 'cerrado', closedBy: miCorreo, closedAt: new Date().toISOString() }, { merge: true });
      toast.success('Día cerrado', `${fechaHN(fecha)} · todos los turnos cerrados y arqueados.`);
      await auditar('Cierre del día', fechaHN(fecha), `Con turnos: ${datos.shifts.map(s => s.name).join(', ')}`, { icon: 'lock' });
    } catch (e) {
      console.error(e);
      toast.error('No se cerró el día', 'Revisa la conexión.');
    } finally {
      setOcupado(false);
    }
  };

  // ─── Excel (B8) ───
  const exportar = () => {
    const turnos = datos.shifts.map(s => ({ shift: s, lecturas: datos.lecturas.filter(r => r.shiftId === s.id), arqueos: datos.arqueos.filter(c => c.shiftId === s.id) }));
    if (turnos.length === 0) { toast.info('Sin turnos', 'No hay turnos en la fecha.'); return; }
    const wb = XLSX.utils.book_new();
    const cons = XLSX.utils.aoa_to_sheet(consolidadoAoa(fechaHN(fecha), turnos, precios));
    cons['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, cons, 'Consolidado');
    turnos.forEach(t => {
      const ws = XLSX.utils.aoa_to_sheet(turnoAoa(t, precios));
      ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 28 }];
      XLSX.utils.book_append_sheet(wb, ws, `${t.shift.templateId} ${t.shift.name}`.slice(0, 31));
    });
    const nombre = `Turnos_${fecha}.xlsx`;
    XLSX.writeFile(wb, nombre);
    toast.success('Excel generado', `${nombre} descargado.`);
  };

  if (!operacion.shiftsEnabled) {
    return <div style={{ padding: 24 }}><Card>Los turnos están desactivados. Se activan en Configuración bombas.</Card></div>;
  }

  const vigente = plantillaVigente(operacion.shiftTemplates, new Date(), operacion.timeZone);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Turno actual */}
      <Card style={{ background: 'linear-gradient(135deg,#0a1530,#14275a)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Turno actual</div>
            {abierto ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{abierto.name} · {fechaHN(abierto.date)}</div>
                <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 4 }}>
                  Abrió {abierto.openedByName} · {horaHN(abierto.openedAt)} · precios {Object.entries(abierto.prices).map(([k, v]) => `${k} ${fmtNum(v)}`).join(' · ')}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>Sin turno abierto</div>
                <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 4 }}>Por la hora corresponde: {vigente ? `${vigente.name} (${vigente.start}–${vigente.end})` : '—'}</div>
              </>
            )}
          </div>
          {puedeCerrar && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!abierto && operacion.shiftTemplates.map(p => {
                const f = fechaDeTurno(p, new Date(), operacion.timeZone);
                const cerrado = cerradosApertura[f] === true;
                return (
                  <span key={p.id} title={cerrado ? `El día ${fechaHN(f)} está cerrado: reábrelo (con motivo) para abrir este turno.` : undefined}>
                    <Button variant={p.id === vigente?.id ? 'accent' : 'secondary'} icon="log-in" disabled={ocupado || cerrado} onClick={() => prepararApertura(p)}>Abrir {p.name}</Button>
                  </span>
                );
              })}
              {abierto && <Button variant="accent" icon="lock" disabled={ocupado} onClick={() => cerrar(abierto)}>Cerrar turno</Button>}
            </div>
          )}
        </div>
        {!abierto && puedeCerrar && Object.entries(cerradosApertura).some(([f, c]) => c && fechasApertura.split(',').includes(f)) && (
          <div style={{ fontSize: 12, color: '#fde68a', marginTop: 8 }}>
            Día {fechasApertura.split(',').filter(f => cerradosApertura[f]).map(fechaHN).join(' y ')} cerrado: no se abren turnos en él. Para hacerlo, reabre el día (con motivo).
          </div>
        )}
      </Card>

      {abierto && cambiados.length > 0 && (
        <Card style={{ background: '#fffbeb', boxShadow: '0 0 0 1px #fde68a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Icon name="alert" size={18} style={{ color: '#d97706' }} />
              <div style={{ fontSize: 13, color: '#7c4a03' }}>
                <b>El precio cambió con el turno abierto</b> ({cambiados.map(f => `${f}: ${fmtNum(abierto.prices[f])} → ${fmtNum(precios[f])}`).join(' · ')}).
                {' '}Registra la lectura de corte: lo vendido antes queda al precio anterior.
              </div>
            </div>
            {puedeCerrar && <Button variant="accent" size="sm" icon="tag" onClick={() => setCorte({})}>Registrar corte de precio</Button>}
          </div>
        </Card>
      )}

      {/* Día y turnos */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <TextField label="Fecha" type="date" value={fecha} onChange={v => { if (v) { setFecha(v); setSelId(null); } }} style={{ width: 170 }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 4 }}>
              {datos.shifts.length === 0 && <span style={{ fontSize: 13, color: '#64748b' }}>Sin turnos en la fecha.</span>}
              {datos.shifts.map(s => (
                <button key={s.id} onClick={() => setSelId(s.id as string)} style={{
                  border: 0, borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
                  background: sel?.id === s.id ? '#0f1f3d' : '#eef0f3', color: sel?.id === s.id ? 'white' : '#334155',
                }}>{s.name} · {s.status === 'abierto' ? 'abierto' : 'cerrado'}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {diaCerrado ? <Badge tone="success" icon="lock">Día cerrado</Badge> : puedeCerrar && (
              <Button variant="primary" size="sm" icon="lock" disabled={ocupado || razonesCierre.length > 0} onClick={cerrarDia}>Cerrar día</Button>
            )}
            <Button variant="secondary" size="sm" icon="download" onClick={exportar}>Exportar Excel</Button>
          </div>
        </div>
        {!diaCerrado && razonesCierre.length > 0 && datos.shifts.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#854d0e' }}>Para cerrar el día: {razonesCierre.join(' ')}</div>
        )}
      </Card>

      {sel && (
        <>
          {/* Asignaciones y lecturas del turno */}
          <Card padding={0}>
            <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{sel.name} · {fechaHN(sel.date)} <Badge tone={sel.status === 'abierto' ? 'warning' : 'success'} dot>{sel.status}</Badge></div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  {sel.assignments.map(a => `${a.name}: ${a.dispenserIds.length} mangueras, cambio ${fmtL(a.cashFund)}`).join(' · ')}
                  {sel.closedAt && ` · cerró ${sel.closedByName} ${horaHN(sel.closedAt)}`}
                  {sel.priceCuts?.length ? ` · ${sel.priceCuts.length} corte(s) de precio` : ''}
                </div>
              </div>
              {puedeCerrar && sel.status === 'abierto' && <Button variant="accent" size="sm" icon="lock" disabled={ocupado} onClick={() => cerrar(sel)}>Cerrar turno</Button>}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ ...th, textAlign: 'left' }}>Manguera</th><th style={{ ...th, textAlign: 'left' }}>Bombero</th>
                    <th style={th}>Inicial</th><th style={th}>Cortes</th><th style={th}>Final</th><th style={th}>Litros</th><th style={th}>Precio</th><th style={th}>Total</th>
                    {puedeCorregir && <th style={th} />}
                  </tr>
                </thead>
                <tbody>
                  {lecturasSel.map(r => {
                    const e = lecturaEditada(r);
                    const v = calcVentaTurno(e, precios);
                    const editable = puedeCerrar && sel.status === 'abierto' && r.finalReading === undefined;
                    return (
                      <tr key={r.dispenserId} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit' }}>{etiqueta(r)} <span style={{ color: '#64748b' }}>{r.fuelName}</span>
                          {r.continuityBreak && <span title={r.continuityReason}> <Badge tone="warning" icon="alert">continuidad</Badge></span>}</td>
                        <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit' }}>{r.attendantName}</td>
                        <td style={td}>{fmtNum(r.initialReading, 3)}</td>
                        <td style={td}>{r.cuts?.length ? r.cuts.map(c => `${fmtNum(c.reading, 3)} @${fmtNum(c.fuelPrice)}`).join(', ') : '—'}</td>
                        <td style={td}>
                          {editable ? (
                            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                              <input aria-label={`Final ${etiqueta(r)}`} style={{ ...inp, width: 130, textAlign: 'right', borderColor: v.estado === 'invalida' ? '#ef4444' : '#e2e8f0' }}
                                value={finales[r.dispenserId] ?? ''} inputMode="decimal" onChange={ev => setFinales(s => ({ ...s, [r.dispenserId]: ev.target.value }))} />
                              <label style={{ fontSize: 11, color: '#64748b', fontFamily: 'inherit' }} title="Vuelta a cero del totalizador">
                                <input type="checkbox" checked={rolls[r.dispenserId] === true} onChange={ev => setRolls(s => ({ ...s, [r.dispenserId]: ev.target.checked }))} /> 0
                              </label>
                            </span>
                          ) : r.finalReading !== undefined ? fmtNum(r.finalReading, 3) : <Badge tone="warning" dot>Pendiente</Badge>}
                          {r.correctedAt && <span title={`${r.correctedBy} · ${horaHN(r.correctedAt)}: ${r.correctionReason}`}> <Badge tone="info" icon="edit">corregida</Badge></span>}
                        </td>
                        <td style={td}>{v.estado === 'ok' ? fmtNum(v.litros, 3) : '—'}</td>
                        <td style={td}>{fmtNum(r.fuelPrice)}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{v.estado === 'ok' ? fmtL(v.total) : '—'}</td>
                        {puedeCorregir && (
                          <td style={td}>
                            {r.finalReading !== undefined && (
                              <Button variant="ghost" size="sm" icon="edit" disabled={ocupado} onClick={() => setCorr({ r, valor: '', rollover: r.rollover === true, motivo: '' })}>Corregir</Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Arqueo por bombero */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 16 }}>
            {visibles.length === 0 && <Card>No tienes mangueras asignadas en este turno.</Card>}
            {visibles.map(a => {
              const vb = ventasSel.find(v => v.email === a.email);
              const b = borradorDe(a.email);
              const d = { cash: num(b.cash || '0'), card: num(b.card || '0'), credits: num(b.credits || '0'), partialDrops: num(b.partialDrops || '0') };
              const r = calcArqueo(vb?.total ?? 0, a.cashFund, d);
              const c = arqueosSel.find(x => x.email === a.email);
              const bloqueado = diaCerrado || (!!c?.receivedBy && !puedeCerrar);
              const set = (k: keyof ArqueoBorrador) => (val: string) => setArq(s => ({ ...s, [a.email]: { ...borradorDe(a.email), [k]: val } }));
              return (
                <Card key={a.email}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>Arqueo · {a.name}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{a.email} · {a.dispenserIds.length} mangueras</div>
                    </div>
                    {c?.receivedBy ? <Badge tone="success" icon="check">Recibido</Badge> : c ? <Badge tone="info">Declarado</Badge> : <Badge tone="neutral">Sin arqueo</Badge>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, fontSize: 13, marginBottom: 12 }}>
                    <span>Ventas de sus mangueras{vb?.pendientes ? ` (${vb.pendientes} sin final)` : ''}</span><b style={mono}>{fmtL(vb?.total ?? 0)}</b>
                    <span>Fondo de cambio</span><b style={mono}>{fmtL(a.cashFund)}</b>
                    <span>Esperado</span><b style={mono}>{fmtL(r.expected)}</b>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                    <TextField label="Efectivo" prefix="L." value={b.cash} onChange={set('cash')} disabled={bloqueado} style={{ minWidth: 0 }} inputStyle={{ minWidth: 0, width: '100%' }} />
                    <TextField label="POS / tarjeta" prefix="L." value={b.card} onChange={set('card')} disabled={bloqueado} style={{ minWidth: 0 }} inputStyle={{ minWidth: 0, width: '100%' }} />
                    <TextField label="Créditos / vales" prefix="L." value={b.credits} onChange={set('credits')} disabled={bloqueado} style={{ minWidth: 0 }} inputStyle={{ minWidth: 0, width: '100%' }} />
                    <TextField label="Retiros parciales" prefix="L." value={b.partialDrops} onChange={set('partialDrops')} disabled={bloqueado} style={{ minWidth: 0 }} inputStyle={{ minWidth: 0, width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 8px', padding: '10px 12px', borderRadius: 10,
                    background: r.difference === 0 ? '#dcfce7' : '#fee2e2', color: r.difference === 0 ? '#166534' : '#991b1b' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Declarado {fmtL(r.declared)} · diferencia</span>
                    <b style={{ ...mono, fontSize: 16 }}>{fmtL(r.difference)}</b>
                  </div>
                  {r.difference !== 0 && <TextField label="Motivo de la diferencia (obligatorio)" value={b.notes} onChange={set('notes')} disabled={bloqueado} />}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                    {!bloqueado && <Button variant="secondary" size="sm" icon="check" disabled={ocupado} onClick={() => guardarArq(a, false)}>Guardar declaración</Button>}
                    {puedeCerrar && !diaCerrado && <Button variant="primary" size="sm" icon="lock" disabled={ocupado || sel.status !== 'cerrado'} onClick={() => guardarArq(a, true)}>{c?.receivedBy ? 'Corregir y recibir' : 'Recibir arqueo'}</Button>}
                  </div>
                  {diaCerrado && <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>Día cerrado: el arqueo no se modifica. Para corregirlo, reabre el día (con motivo).</div>}
                  {c?.receivedBy && <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>Recibido por {c.receivedBy} · {horaHN(c.receivedAt)}</div>}
                  {c?.recalculatedAt && !c.receivedBy && <div style={{ fontSize: 11, color: '#b45309', marginTop: 6 }}>Esperado recalculado por una corrección de lectura ({horaHN(c.recalculatedAt)}): revísalo y vuelve a recibirlo.</div>}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Modal: abrir turno */}
      <Modal open={!!abrir} onClose={() => setAbrir(null)} width={860} icon="log-in" title={abrir ? `Abrir turno ${abrir.plantilla.name}` : ''}
        subtitle={abrir ? `Día operativo ${fechaHN(abrir.fecha)} · ${abrir.plantilla.start}–${abrir.plantilla.end} · precios vigentes ${Object.entries(precios).map(([k, v]) => `${k} ${fmtNum(v)}`).join(', ')}` : ''}
        footer={<>
          <Button variant="secondary" onClick={() => setAbrir(null)}>Cancelar</Button>
          <Button variant="accent" icon="log-in" disabled={ocupado || erroresApertura.length > 0} onClick={confirmarApertura}>Abrir turno</Button>
        </>}>
        {abrir && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Bomberos y mangueras</div>
              <datalist id="usuarios-turno">{users.filter(u => u.status === 'activo').map(u => <option key={u.email} value={u.email}>{u.name}</option>)}</datalist>
              {abrir.bomberos.map((b, i) => {
                const upd = (patch: Partial<BomberoBorrador>) => setAbrir({ ...abrir, bomberos: abrir.bomberos.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div key={i} style={{ border: '1px solid #e6e8ec', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 110px 34px', gap: 8, marginBottom: 8 }}>
                      <input aria-label="Correo del bombero" list="usuarios-turno" placeholder="correo@" style={inp} value={b.email}
                        onChange={e => { const u = users.find(x => x.email === e.target.value); upd({ email: e.target.value, ...(u && !b.name ? { name: u.name } : {}) }); }} />
                      <input aria-label="Nombre del bombero" placeholder="Nombre" style={{ ...inp, fontFamily: 'inherit' }} value={b.name} onChange={e => upd({ name: e.target.value })} />
                      <input aria-label="Fondo de cambio" placeholder="Fondo L." style={inp} value={b.fondo} inputMode="decimal" onChange={e => upd({ fondo: e.target.value })} />
                      <Button variant="ghost" size="sm" icon="trash" disabled={abrir.bomberos.length <= 1} onClick={() => setAbrir({ ...abrir, bomberos: abrir.bomberos.filter((_, j) => j !== i) })} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {abrir.filas.map(f => {
                        const on = b.dispenserIds.includes(f.base.dispenserId);
                        return (
                          <label key={f.base.dispenserId} style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 999, cursor: 'pointer', background: on ? '#e0e7ff' : '#f1f5f9', color: on ? '#312e81' : '#475569' }}>
                            <input type="checkbox" checked={on} style={{ marginRight: 4 }} onChange={ev => {
                              // Una manguera = un bombero: marcarla aquí la quita de los demás.
                              const id = f.base.dispenserId;
                              setAbrir({ ...abrir, bomberos: abrir.bomberos.map((x, j) => ({
                                ...x, dispenserIds: j === i ? (ev.target.checked ? [...x.dispenserIds, id] : x.dispenserIds.filter(d => d !== id)) : (ev.target.checked ? x.dispenserIds.filter(d => d !== id) : x.dispenserIds),
                              })) });
                            }} />
                            {etiqueta(f.base)} {f.base.fuelName}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <Button variant="secondary" size="sm" icon="plus" onClick={() => setAbrir({ ...abrir, bomberos: [...abrir.bomberos, { email: '', name: '', fondo: '0', dispenserIds: [] }] })}>Agregar bombero</Button>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Lecturas iniciales (final del turno anterior)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {abrir.filas.map((f, i) => {
                    const v = num(f.inicial);
                    const rompe = Number.isFinite(v) && rompeCadena(v, f.sugerida);
                    const upd = (patch: Partial<FilaApertura>) => setAbrir({ ...abrir, filas: abrir.filas.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                    return (
                      <tr key={f.base.dispenserId} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit' }}>{etiqueta(f.base)} {f.base.fuelName}</td>
                        <td style={{ ...td, color: '#64748b', fontSize: 11.5 }}>{f.sugerida.origen === 'turno_anterior' ? 'turno anterior' : f.sugerida.origen === 'lectura_diaria' ? 'lectura del día' : 'digitar'}</td>
                        <td style={td}><input aria-label={`Inicial ${etiqueta(f.base)}`} style={{ ...inp, width: 140, textAlign: 'right', borderColor: rompe ? '#f59e0b' : '#e2e8f0' }} value={f.inicial} inputMode="decimal" onChange={e => upd({ inicial: e.target.value })} /></td>
                        <td style={{ ...td, textAlign: 'left' }}>{rompe && <input aria-label="Motivo" placeholder={`Motivo (anterior ${f.sugerida.valor})`} style={{ ...inp, width: 220, fontFamily: 'inherit' }} value={f.motivo} onChange={e => upd({ motivo: e.target.value })} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {erroresApertura.length > 0 && <div style={{ fontSize: 12, color: '#b91c1c' }}>{erroresApertura.slice(0, 4).join(' ')}</div>}
          </div>
        )}
      </Modal>

      {/* Modal: corregir final de un turno cerrado */}
      <Modal open={!!corr} onClose={() => setCorr(null)} icon="edit" iconTone="warning" title={corr ? `Corregir final · ${etiqueta(corr.r)} ${corr.r.fuelName}` : ''}
        subtitle={corr && sel ? `${sel.name} · ${fechaHN(sel.date)} (turno cerrado). Se recalculan la venta del día y el arqueo del bombero; el valor anterior, el nuevo y el motivo quedan en la auditoría.` : ''}
        footer={<>
          <Button variant="secondary" onClick={() => setCorr(null)}>Cancelar</Button>
          <Button variant="primary" icon="check" disabled={ocupado} onClick={confirmarCorreccion}>Guardar corrección</Button>
        </>}>
        {corr && (() => {
          const n = num(corr.valor);
          const v = Number.isFinite(n) ? calcVentaTurno({ ...corr.r, finalReading: n, rollover: corr.rollover }, precios) : null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 4, fontSize: 13 }}>
                <span>Inicial{corr.r.cuts?.length ? ` (último corte ${fmtNum(corr.r.cuts[corr.r.cuts.length - 1].reading, 3)})` : ''}</span><b style={mono}>{fmtNum(corr.r.initialReading, 3)}</b>
                <span>Final guardada</span><b style={mono}>{fmtNum(corr.r.finalReading ?? 0, 3)}</b>
                <span>Bombero</span><b>{corr.r.attendantName}</b>
              </div>
              <TextField label="Nueva final" value={corr.valor} autoFocus onChange={val => setCorr({ ...corr, valor: val })} />
              <label style={{ fontSize: 12.5, color: '#475569' }}>
                <input type="checkbox" checked={corr.rollover} onChange={ev => setCorr({ ...corr, rollover: ev.target.checked })} /> El totalizador dio la vuelta a cero
              </label>
              {v && <div style={{ fontSize: 12.5, color: v.estado === 'ok' ? '#166534' : '#b91c1c' }}>{v.estado === 'ok' ? `Venta del turno en esta manguera: ${fmtNum(v.litros, 3)} L · ${fmtL(v.total)}` : 'La final queda menor a la inicial o al último corte.'}</div>}
              <TextField label="Motivo (obligatorio)" value={corr.motivo} placeholder="Ej.: final mal digitada, foto del totalizador" onChange={val => setCorr({ ...corr, motivo: val })} />
            </div>
          );
        })()}
      </Modal>

      {/* Modal: corte de precio */}
      <Modal open={!!corte} onClose={() => setCorte(null)} icon="tag" iconTone="warning" title="Corte de precio"
        subtitle="Totalizador de cada manguera en el momento del cambio. Lo vendido hasta aquí queda al precio anterior."
        footer={<>
          <Button variant="secondary" onClick={() => setCorte(null)}>Cancelar</Button>
          <Button variant="accent" icon="check" disabled={ocupado} onClick={confirmarCorte}>Registrar corte</Button>
        </>}>
        {corte && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {lecturasCorte.map(r => (
                <tr key={r.dispenserId} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit' }}>{etiqueta(r)} {r.fuelName}</td>
                  <td style={{ ...td, fontSize: 11.5, color: '#64748b' }}>{fmtNum(r.fuelPrice)} → {fmtNum(precios[r.fuelId])}</td>
                  <td style={td}><input aria-label={`Corte ${etiqueta(r)}`} style={{ ...inp, width: 140, textAlign: 'right' }} value={corte[r.dispenserId] ?? ''} inputMode="decimal" onChange={e => setCorte({ ...corte, [r.dispenserId]: e.target.value })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
