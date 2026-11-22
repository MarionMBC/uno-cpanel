// Turnos y arqueo por bombero (TASK-019, auditoría TASK-004 §5 / B1–B8).
// Todo detrás de settings/operacion.shiftsEnabled (default false). Lógica pura: se prueba con `npm test`.
import type { AsignacionTurno, CashCount, CorteLectura, DailyReading, Operacion, PlantillaTurno, Shift, ShiftReading, TramoVenta } from '../types';
import { calcVenta, round, rompeContinuidad, type LecturaVenta, type PreciosPorLitro, type Venta } from './totalizadores.ts';

// ─── B1 configuración ─────────────────────────────────────────────────────────

export const ZONA_DEFAULT = 'America/Tegucigalpa';

export const PLANTILLAS_DEFAULT: PlantillaTurno[] = [
  { id: 'T1', name: 'Mañana', start: '06:00', end: '14:00' },
  { id: 'T2', name: 'Tarde', start: '14:00', end: '22:00' },
  { id: 'T3', name: 'Noche', start: '22:00', end: '06:00' },
];

export const OPERACION_DEFAULT: Operacion = { timeZone: ZONA_DEFAULT, shiftsEnabled: false, shiftTemplates: PLANTILLAS_DEFAULT };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_PLANTILLA = /^[A-Za-z0-9]{1,8}$/;

/** settings/operacion tal como venga (o ausente) → valores válidos. Sin doc = flag apagado. */
export function normalizarOperacion(raw: unknown): Operacion {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<Operacion>;
  const plantillas = Array.isArray(o.shiftTemplates) && o.shiftTemplates.length > 0 && validarPlantillas(o.shiftTemplates).length === 0
    ? o.shiftTemplates.map(p => ({ id: p.id, name: p.name, start: p.start, end: p.end }))
    : PLANTILLAS_DEFAULT;
  return {
    timeZone: typeof o.timeZone === 'string' && o.timeZone ? o.timeZone : ZONA_DEFAULT,
    shiftsEnabled: o.shiftsEnabled === true,
    shiftTemplates: plantillas,
  };
}

/** Errores de las plantillas (vacío = válidas). */
export function validarPlantillas(ps: PlantillaTurno[]): string[] {
  const err: string[] = [];
  if (ps.length === 0) err.push('Debe haber al menos un turno.');
  const ids = new Set<string>();
  ps.forEach((p, i) => {
    const n = `Turno ${i + 1}`;
    if (!p || typeof p.id !== 'string' || !ID_PLANTILLA.test(p.id)) err.push(`${n}: código inválido (letras o números, máx. 8).`);
    else if (ids.has(p.id)) err.push(`${n}: código ${p.id} repetido.`);
    else ids.add(p.id);
    if (!p || typeof p.name !== 'string' || !p.name.trim()) err.push(`${n}: falta el nombre.`);
    if (!p || !HHMM.test(p.start) || !HHMM.test(p.end)) err.push(`${n}: horas en formato HH:MM.`);
    else if (p.start === p.end) err.push(`${n}: inicio y fin iguales.`);
  });
  return err;
}

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Minutos desde la medianoche en la zona dada. */
export function minutosLocales(ahora: Date, zona: string = ZONA_DEFAULT): number {
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ahora);
  const h = Number(partes.find(p => p.type === 'hour')?.value ?? 0);
  const m = Number(partes.find(p => p.type === 'minute')?.value ?? 0);
  return (h % 24) * 60 + m;
}

const cruzaMedianoche = (p: PlantillaTurno) => minutos(p.end) <= minutos(p.start);

/** ¿La hora local (minutos) cae dentro de la plantilla? */
export function dentroDe(p: PlantillaTurno, min: number): boolean {
  const s = minutos(p.start), e = minutos(p.end);
  return cruzaMedianoche(p) ? (min >= s || min < e) : (min >= s && min < e);
}

/** Plantilla que corresponde a la hora actual (la primera que la cubra), o null. */
export function plantillaVigente(ps: PlantillaTurno[], ahora: Date, zona: string = ZONA_DEFAULT): PlantillaTurno | null {
  const m = minutosLocales(ahora, zona);
  return ps.find(p => dentroDe(p, m)) ?? null;
}

/** YYYY-MM-DD del día en la zona dada (misma fórmula que lib/fecha.ts, sin importarla para el test). */
export function diaEnZona(ahora: Date, zona: string = ZONA_DEFAULT): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

export function diaAnterior(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Día operativo al que pertenece un turno abierto ahora: el del inicio del turno.
 * Turno nocturno 22–06 abierto a la 01:00 del 22 pertenece al 21.
 */
export function fechaDeTurno(p: PlantillaTurno, ahora: Date, zona: string = ZONA_DEFAULT): string {
  const hoy = diaEnZona(ahora, zona);
  if (cruzaMedianoche(p) && minutosLocales(ahora, zona) < minutos(p.end)) return diaAnterior(hoy);
  return hoy;
}

// ─── IDs deterministas ───────────────────────────────────────────────────────

export const idTurno = (fecha: string, templateId: string) => `${fecha}_${templateId}`;
export const idLecturaTurno = (shiftId: string, dispenserId: string) => `${shiftId}_${dispenserId}`;
export const idArqueo = (shiftId: string, email: string) => `${shiftId}_${email.trim().toLowerCase()}`;

// ─── B3 asignaciones ─────────────────────────────────────────────────────────

// Allowlist: el correo forma parte del id del arqueo (sin '/', espacios ni caracteres raros).
const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** Cada manguera del turno con exactamente un bombero; cada bombero con correo válido y al menos una manguera. */
export function validarAsignaciones(dispenserIds: string[], asignaciones: AsignacionTurno[]): string[] {
  const err: string[] = [];
  if (asignaciones.length === 0) err.push('Asigna al menos un bombero.');
  const correos = new Set<string>();
  const dueño = new Map<string, string>();
  asignaciones.forEach((a, i) => {
    const quien = a.name?.trim() || a.email || `Bombero ${i + 1}`;
    const correo = (a.email || '').trim().toLowerCase();
    if (!EMAIL.test(correo)) err.push(`${quien}: correo inválido.`);
    else if (correos.has(correo)) err.push(`${quien}: correo repetido.`);
    else correos.add(correo);
    if (!a.name?.trim()) err.push(`${quien}: falta el nombre.`);
    if (!Number.isFinite(a.cashFund) || a.cashFund < 0) err.push(`${quien}: fondo de cambio inválido.`);
    if (a.dispenserIds.length === 0) err.push(`${quien}: sin mangueras.`);
    a.dispenserIds.forEach(d => {
      if (!dispenserIds.includes(d)) err.push(`${quien}: manguera ${d} no está en el turno.`);
      else if (dueño.has(d)) err.push(`Manguera ${d} asignada a dos bomberos.`);
      else dueño.set(d, quien);
    });
  });
  const sinBombero = dispenserIds.filter(d => !dueño.has(d));
  if (sinBombero.length > 0) err.push(`Mangueras sin bombero: ${sinBombero.join(', ')}.`);
  return err;
}

// ─── B4 encadenamiento ───────────────────────────────────────────────────────

export interface InicialSugerida {
  valor: number | null;
  /** De dónde sale: final del turno anterior, inicial/final de la lectura diaria, o nada (se digita). */
  origen: 'turno_anterior' | 'lectura_diaria' | null;
}

/**
 * Inicial de una manguera al abrir un turno: la final del turno anterior; si no hay (primer turno o
 * manguera nueva), la final de la lectura diaria del día (si ya se cerró un tramo) o su inicial.
 */
export function inicialEncadenada(
  dispenserId: string,
  anteriores: Pick<ShiftReading, 'dispenserId' | 'finalReading'>[],
  diaria?: Pick<DailyReading, 'initialReading' | 'finalReading'> | null,
): InicialSugerida {
  const prev = anteriores.find(r => r.dispenserId === dispenserId && r.finalReading !== undefined && r.finalReading !== null);
  if (prev) return { valor: prev.finalReading as number, origen: 'turno_anterior' };
  if (diaria) return { valor: diaria.finalReading ?? diaria.initialReading, origen: 'lectura_diaria' };
  return { valor: null, origen: null };
}

/** ¿La inicial digitada rompe el encadenamiento? Exige motivo (igual que A8). */
export const rompeCadena = (inicial: number, sugerida: InicialSugerida) => rompeContinuidad(inicial, sugerida.valor);

// ─── B6 corte de precio y venta por turno ────────────────────────────────────

/** Combustibles del turno cuyo precio vigente difiere del precio con que corre el turno. */
export function preciosCambiados(delTurno: Record<string, number>, vigentes: PreciosPorLitro, fuelIds: string[]): string[] {
  return [...new Set(fuelIds)].filter(f => vigentes[f] !== undefined && round(vigentes[f], 2) !== round(delTurno[f] ?? 0, 2));
}

/** Tramos de una lectura de turno: inicial → corte₁ → … → final, cada uno con su precio. */
export function tramosLectura(sr: Pick<ShiftReading, 'fuelId' | 'fuelPrice' | 'initialReading' | 'finalReading' | 'status' | 'rollover' | 'meterMax' | 'cuts'>): LecturaVenta[] {
  const cortes: CorteLectura[] = sr.cuts ?? [];
  const puntos = [sr.initialReading, ...cortes.map(c => c.reading)];
  const precios = [...cortes.map(c => c.fuelPrice), sr.fuelPrice];
  return puntos.map((ini, i) => {
    const fin = i < cortes.length ? cortes[i].reading : sr.finalReading;
    return {
      fuelId: sr.fuelId, fuelPrice: precios[i], initialReading: ini, finalReading: fin, status: sr.status,
      // La vuelta a cero cae en el tramo donde el fin es menor al inicio.
      rollover: sr.rollover === true && fin !== undefined && fin < ini, meterMax: sr.meterMax,
    };
  });
}

export interface VentaTurno {
  estado: Venta['estado'];
  litros: number;
  total: number;
  tramos: Venta[];
}

/** Venta de una lectura de turno: suma de calcVenta por tramo (cada tramo a su precio). */
export function calcVentaTurno(sr: Parameters<typeof tramosLectura>[0], precios: PreciosPorLitro): VentaTurno {
  const tramos = tramosLectura(sr).map(t => calcVenta(t, precios));
  const mal = tramos.find(t => t.estado !== 'ok');
  if (mal) return { estado: mal.estado, litros: 0, total: 0, tramos };
  return {
    estado: 'ok',
    litros: round(tramos.reduce((s, t) => s + t.litros, 0), 3),
    total: round(tramos.reduce((s, t) => s + t.total, 0), 2),
    tramos,
  };
}

/**
 * Tramos de la lectura diaria tras cerrar un turno: los de otros turnos se conservan y los de este turno
 * se reemplazan (idempotente). Así la venta diaria (calcVenta) = Σ ventas de los turnos.
 */
export function tramosDiarios(previos: TramoVenta[] | undefined, shiftId: string, venta: VentaTurno): TramoVenta[] {
  const otros = (previos ?? []).filter(t => t.shiftId !== shiftId);
  return [...otros, ...venta.tramos.filter(t => t.estado === 'ok').map(t => ({ litros: t.litros, precio: t.precio, shiftId }))];
}

// ─── TASK-022 corrección de una final con el turno cerrado ───────────────────

export type PlanCorreccion =
  | { ok: false; error: string }
  | { ok: true; venta: VentaTurno; diaria: Pick<DailyReading, 'tramos' | 'finalReading' | 'rollover'> | null };

/**
 * Valida y arma la corrección de la final de una manguera en un turno cerrado.
 * - La nueva final debe dar venta válida (≥ inicial o último corte, o vuelta a cero).
 * - Continuidad: si el turno siguiente abrió esta manguera con inicial = final vieja, se bloquea. Ese turno
 *   arrancó del valor viejo: corregir solo este haría que la venta del día deje de cuadrar con el totalizador.
 *   Si el siguiente ya había marcado la diferencia (continuityBreak), la corrección justamente la cierra.
 * - La diaria reemplaza los tramos de este turno; su final se mueve solo si era la final vieja (último cierre).
 * - Si la diaria cuadraba y con la corrección deja de cuadrar, se bloquea.
 */
export function planCorreccion(p: {
  sr: Parameters<typeof tramosLectura>[0] & Pick<ShiftReading, 'shiftId'>;
  nuevaFinal: number; rollover: boolean;
  diaria: (LecturaVenta & Pick<DailyReading, 'initialReading'>) | null;
  siguiente: { nombre: string; initialReading: number } | null;
  precios: PreciosPorLitro;
}): PlanCorreccion {
  const vieja = p.sr.finalReading;
  if (vieja === undefined || vieja === null) return { ok: false, error: 'Esta manguera aún no tiene final en el turno.' };
  if (!Number.isFinite(p.nuevaFinal) || p.nuevaFinal < 0) return { ok: false, error: 'La nueva final debe ser un número mayor o igual a cero.' };
  if (round(p.nuevaFinal, 3) === round(vieja, 3) && p.rollover === (p.sr.rollover === true)) return { ok: false, error: 'La nueva final es igual a la guardada.' };
  const venta = calcVentaTurno({ ...p.sr, finalReading: p.nuevaFinal, rollover: p.rollover }, p.precios);
  if (venta.estado !== 'ok') {
    return { ok: false, error: venta.tramos.some(t => t.motivo === 'tope') ? 'La nueva final da más litros de los posibles en un día. Revísala.' : 'La nueva final queda menor a la inicial o al último corte. Revísala o marca vuelta a cero.' };
  }
  if (p.siguiente && round(p.siguiente.initialReading, 3) === round(vieja, 3)) {
    return { ok: false, error: `El turno ${p.siguiente.nombre} ya abrió esta manguera con inicial ${vieja} (la final que quieres corregir). Corregir solo este turno descuadraría la venta del día contra el totalizador; la venta total del día ya es correcta.` };
  }
  if (!p.diaria) return { ok: true, venta, diaria: null };
  const tramos = tramosDiarios(p.diaria.tramos, p.sr.shiftId, venta);
  const esUltimo = p.diaria.finalReading !== undefined && round(p.diaria.finalReading, 3) === round(vieja, 3);
  const finalReading = esUltimo ? p.nuevaFinal : p.diaria.finalReading;
  // La diaria cubre menos de una vuelta del totalizador: dio la vuelta si la final quedó bajo la inicial.
  const rollover = esUltimo ? (finalReading as number) < p.diaria.initialReading : p.diaria.rollover === true;
  const nueva = { ...p.diaria, tramos, finalReading, rollover };
  if (calcVenta(p.diaria, p.precios).estado === 'ok' && calcVenta(nueva, p.precios).estado !== 'ok') {
    return { ok: false, error: 'Con esta corrección la venta del día deja de cuadrar con el totalizador. Revisa la final.' };
  }
  return { ok: true, venta, diaria: { tramos, finalReading, rollover } };
}

/** Arqueo con el esperado recalculado (lo declarado no cambia). */
export function recalcularArqueo(c: Pick<CashCount, 'cashFund' | 'cash' | 'card' | 'credits' | 'partialDrops'>, expectedSales: number): Pick<CashCount, 'expectedSales' | 'expected' | 'declared' | 'difference' | 'status'> {
  return { expectedSales: round(expectedSales, 2), ...calcArqueo(expectedSales, c.cashFund, c) };
}

export interface VentaBombero {
  email: string;
  name: string;
  litros: number;
  total: number;
  /** Mangueras sin final o con final inválida: el esperado aún no es definitivo. */
  pendientes: number;
}

/** Ventas por bombero en un turno (sus mangueras). */
export function ventasPorBombero(shift: Pick<Shift, 'assignments'>, lecturas: ShiftReading[], precios: PreciosPorLitro): VentaBombero[] {
  return shift.assignments.map(a => {
    let litros = 0, total = 0, pendientes = 0;
    lecturas.filter(r => a.dispenserIds.includes(r.dispenserId)).forEach(r => {
      const v = calcVentaTurno(r, precios);
      if (v.estado === 'ok') { litros += v.litros; total += v.total; } else if (v.estado !== 'mantenimiento') pendientes++;
    });
    return { email: a.email, name: a.name, litros: round(litros, 3), total: round(total, 2), pendientes };
  });
}

// ─── B5 arqueo ───────────────────────────────────────────────────────────────

export interface Declarado { cash: number; card: number; credits: number; partialDrops: number }

/** Esperado = ventas + fondo; declarado = efectivo + POS + créditos/vales + retiros; diferencia = declarado − esperado. */
export function calcArqueo(expectedSales: number, cashFund: number, d: Declarado): Pick<CashCount, 'expected' | 'declared' | 'difference' | 'status'> {
  const expected = round(expectedSales + cashFund, 2);
  const declared = round(d.cash + d.card + d.credits + d.partialDrops, 2);
  const difference = round(declared - expected, 2);
  return { expected, declared, difference, status: difference === 0 ? 'conforme' : 'con_diferencia' };
}

/** Errores del arqueo (vacío = se puede guardar). Con diferencia, la nota es obligatoria. */
export function validarArqueo(d: Declarado, difference: number, notes: string): string[] {
  const err: string[] = [];
  const nombres: Record<keyof Declarado, string> = { cash: 'efectivo', card: 'POS / tarjeta', credits: 'créditos / vales', partialDrops: 'retiros parciales' };
  (Object.keys(nombres) as (keyof Declarado)[]).forEach(k => {
    if (!Number.isFinite(d[k]) || d[k] < 0) err.push(`Monto inválido en ${nombres[k]}.`);
  });
  if (difference !== 0 && notes.trim().length < 5) err.push('Hay diferencia: explica el motivo (mínimo 5 letras).');
  return err;
}

// ─── B7 cierre del día ───────────────────────────────────────────────────────

/** Razones por las que el día no se puede cerrar con turnos activos (vacío = se puede). */
export function bloqueoCierreDia(fecha: string, shifts: Pick<Shift, 'id' | 'date' | 'name' | 'status' | 'assignments'>[], arqueos: Pick<CashCount, 'shiftId' | 'email' | 'receivedBy'>[]): string[] {
  const delDia = shifts.filter(s => s.date === fecha);
  if (delDia.length === 0) return ['No hay turnos registrados en el día.'];
  const out: string[] = [];
  delDia.forEach(s => {
    if (s.status !== 'cerrado') out.push(`Turno ${s.name} sigue abierto.`);
    s.assignments.forEach(a => {
      const c = arqueos.find(x => x.shiftId === s.id && x.email === a.email.trim().toLowerCase());
      if (!c) out.push(`Falta el arqueo de ${a.name} (${s.name}).`);
      else if (!c.receivedBy) out.push(`El arqueo de ${a.name} (${s.name}) no ha sido recibido.`);
    });
  });
  return out;
}

// ─── B8 resumen exportable ───────────────────────────────────────────────────

export interface TurnoConDatos {
  shift: Shift;
  lecturas: ShiftReading[];
  arqueos: CashCount[];
}

const etiquetaManguera = (r: Pick<ShiftReading, 'pumpName' | 'face' | 'dispenserName' | 'fuelName'>) =>
  `${r.pumpName} ${r.face}-${(r.dispenserName.match(/(\d+)\s*$/) || ['', r.dispenserName])[1]} ${r.fuelName}`;

/** Hoja por turno: lecturas por manguera (con tramos) y arqueo por bombero. */
export function turnoAoa(t: TurnoConDatos, precios: PreciosPorLitro): (string | number)[][] {
  const { shift: s } = t;
  const aoa: (string | number)[][] = [
    [`${s.date} · ${s.name}`, s.status === 'cerrado' ? 'CERRADO' : 'ABIERTO', `Abrió: ${s.openedByName}`, s.closedByName ? `Cerró: ${s.closedByName}` : '', '', '', ''],
    ['MANGUERA', 'BOMBERO', 'LECTURA INICIAL', 'LECTURA FINAL', 'LITROS', 'PRECIO', 'TOTAL LPS'],
  ];
  const orden = [...t.lecturas].sort((a, b) => a.dispenserId.localeCompare(b.dispenserId));
  let total = 0;
  orden.forEach(r => {
    const v = calcVentaTurno(r, precios);
    const tramos = tramosLectura(r);
    tramos.forEach((tr, i) => {
      const vt = v.tramos[i];
      aoa.push([
        i === 0 ? etiquetaManguera(r) : '  (tramo tras corte de precio)', i === 0 ? r.attendantName : '',
        tr.initialReading, tr.finalReading ?? '',
        vt.estado === 'ok' ? vt.litros : vt.estado === 'pendiente' ? 'PENDIENTE' : vt.estado === 'mantenimiento' ? 'MANTENIMIENTO' : 'INVÁLIDA',
        vt.precio, vt.estado === 'ok' ? vt.total : '',
      ]);
    });
    if (v.estado === 'ok') total += v.total;
  });
  aoa.push(['', '', '', '', '', 'TOTAL TURNO', round(total, 2)]);
  aoa.push(['', '', '', '', '', '', '']);
  aoa.push(['BOMBERO', 'VENTAS', 'CAMBIO', 'ESPERADO', 'DECLARADO', 'DIFERENCIA', 'ESTADO']);
  ventasPorBombero(s, t.lecturas, precios).forEach(vb => {
    const a = s.assignments.find(x => x.email === vb.email);
    const c = t.arqueos.find(x => x.email === vb.email.trim().toLowerCase());
    const fondo = a?.cashFund ?? 0;
    aoa.push([
      vb.name, vb.total, fondo, round(vb.total + fondo, 2),
      c ? c.declared : '', c ? c.difference : '',
      !c ? 'SIN ARQUEO' : c.status === 'conforme' ? 'CONFORME' : `CON DIFERENCIA${c.notes ? `: ${c.notes}` : ''}`,
    ]);
  });
  return aoa;
}

/** Hoja consolidada del día: una fila por turno y bombero, más el total. */
export function consolidadoAoa(fecha: string, turnos: TurnoConDatos[], precios: PreciosPorLitro): (string | number)[][] {
  const aoa: (string | number)[][] = [[`Resumen por turno y bombero · ${fecha}`, '', '', '', '', '', ''], ['TURNO', 'BOMBERO', 'LITROS', 'VENTAS', 'CAMBIO', 'DECLARADO', 'DIFERENCIA']];
  let litros = 0, ventas = 0, dif = 0;
  turnos.forEach(t => {
    ventasPorBombero(t.shift, t.lecturas, precios).forEach(vb => {
      const a = t.shift.assignments.find(x => x.email === vb.email);
      const c = t.arqueos.find(x => x.email === vb.email.trim().toLowerCase());
      aoa.push([t.shift.name, vb.name, vb.litros, vb.total, a?.cashFund ?? 0, c ? c.declared : '', c ? c.difference : '']);
      litros += vb.litros; ventas += vb.total; dif += c?.difference ?? 0;
    });
  });
  aoa.push(['TOTAL', '', round(litros, 3), round(ventas, 2), '', '', round(dif, 2)]);
  return aoa;
}
