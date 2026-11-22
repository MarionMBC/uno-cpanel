// Precio por litro con vigencia (A9). Funciones puras: se prueban con `npm test`.
// Regla: una lectura conserva el precio con que se abrió (fuelPrice); un precio nuevo solo aplica a las
// lecturas iniciales que se registren desde su vigencia.
import type { FuelPrice } from '../types';
import { diaOperativo, instanteHN, OFFSET_HN, sumarDias } from './fecha.ts';

export type ClavePrecio = 'super' | 'regular' | 'diesel';
export const CLAVES_PRECIO: ClavePrecio[] = ['super', 'regular', 'diesel'];
export type Precios = Record<ClavePrecio, number>;

/** Tope de cordura por litro (los precios reales rondan L 30–45/L). */
export const PRECIO_MAX_POR_LITRO = 200;
/** Variación contra el precio vigente que exige confirmación explícita. */
export const UMBRAL_VARIACION_PCT = 15;

type ConVigencia = Pick<FuelPrice, 'vigenteDesde' | 'timestamp'>;

/** Instante ISO desde el que rige. Entradas viejas (sin vigenteDesde) regían desde que se guardaron. */
export function vigenciaDe(p: ConVigencia): string {
  if (p.vigenteDesde) return p.vigenteDesde;
  if (typeof p.timestamp === 'number' && Number.isFinite(p.timestamp)) return new Date(p.timestamp).toISOString();
  return '';
}

/** Milisegundos de una vigencia ISO (con o sin milisegundos: se compara como fecha, no como texto). NaN si no hay. */
const ms = (iso: string) => (iso ? Date.parse(iso) : NaN);

/** Historial ordenado por vigencia, más reciente primero (empate: la registrada después). */
export function ordenarPorVigencia<T extends ConVigencia>(historial: T[]): T[] {
  return [...historial].sort((a, b) => {
    const va = ms(vigenciaDe(a)), vb = ms(vigenciaDe(b));
    const na = Number.isNaN(va), nb = Number.isNaN(vb);
    if (na !== nb) return na ? 1 : -1;
    if (!na && va !== vb) return vb - va;
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  });
}

/** Entrada que rige en `instante` (ISO): la de vigencia más reciente que ya empezó. */
export function precioVigente<T extends ConVigencia>(historial: T[], instante: string): T | null {
  const t = ms(instante);
  return ordenarPorVigencia(historial).find(p => ms(vigenciaDe(p)) <= t) ?? null;
}

/** Precios (Súper/Regular/Diésel) que rigen en `instante` (ISO), o null si aún no había ninguno. */
export function preciosVigentesEn<T extends ConVigencia & Precios>(historial: T[], instante: string): Precios | null {
  const p = precioVigente(historial, instante);
  return p ? { super: p.super, regular: p.regular, diesel: p.diesel } : null;
}

/** Precios que regían justo antes de `instante` (excluye un precio que empieza exactamente ahí). */
export function preciosAntesDe<T extends ConVigencia & Precios>(historial: T[], instante: string): Precios | null {
  const t = Date.parse(instante);
  return Number.isFinite(t) ? preciosVigentesEn(historial, new Date(t - 1).toISOString()) : null;
}

/**
 * Precios con que se abrió una lectura vieja sin fuelPrice (TASK-023): los vigentes en su hora de creación
 * o, sin hora (o si se creó lejos de su día, p. ej. cargada después), al inicio (00:00 Honduras) de su día.
 * Null si no se puede saber (se usa el vigente de hoy).
 */
export function preciosDeLectura<T extends ConVigencia & Precios>(historial: T[], r: { date?: string; createdAt?: string }): Precios | null {
  const fechaOk = !!r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date);
  const creada = r.createdAt ? Date.parse(r.createdAt) : NaN;
  const diaCreada = Number.isFinite(creada) ? diaOperativo(new Date(creada)) : null;
  const creadaEnSuDia = diaCreada !== null && (!fechaOk || [sumarDias(r.date as string, -1), r.date, sumarDias(r.date as string, 1)].includes(diaCreada));
  const instante = creadaEnSuDia ? new Date(creada).toISOString() : fechaOk ? instanteHN(r.date as string) : null;
  return instante ? preciosVigentesEn(historial, instante) : null;
}

/** Próximo precio programado (vigencia futura más cercana), o null. */
export function proximoPrecio<T extends ConVigencia>(historial: T[], instante: string): T | null {
  const futuros = ordenarPorVigencia(historial).filter(p => ms(vigenciaDe(p)) > ms(instante));
  return futuros.length ? futuros[futuros.length - 1] : null;
}

export type ModoVigencia = 'ahora' | 'manana' | 'fecha';

/**
 * Instante ISO de vigencia según el modo elegido.
 * - ahora: el instante actual.
 * - manana: 00:00 (Honduras) del día operativo siguiente.
 * - fecha: `fecha` (YYYY-MM-DD) a la `hora` (HH:MM, Honduras); no puede quedar en el pasado.
 */
export function calcularVigencia(modo: ModoVigencia, ahora: Date, fecha?: string, hora?: string): { iso: string } | { error: string } {
  if (modo === 'ahora') return { iso: ahora.toISOString() };
  if (modo === 'manana') return { iso: instanteHN(sumarDias(diaOperativo(ahora), 1)) };
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Elija la fecha desde la que rige el precio.' };
  const h = hora && /^\d{2}:\d{2}$/.test(hora) ? hora : '00:00';
  const d = new Date(`${fecha}T${h}:00${OFFSET_HN}`);
  if (Number.isNaN(d.getTime())) return { error: 'Fecha u hora inválida.' };
  // Un precio no reprecia lecturas ya abiertas: la vigencia no puede ser anterior a este momento.
  if (d.getTime() < ahora.getTime() - 60_000) return { error: 'La vigencia no puede quedar en el pasado. Use "Desde ahora".' };
  return { iso: d.toISOString() };
}

/** Variación porcentual contra el precio anterior (null si no hay anterior válido). */
export const variacionPct = (nuevo: number, anterior: number | null | undefined) =>
  anterior && anterior > 0 ? ((nuevo - anterior) / anterior) * 100 : null;

export interface ValidacionPrecios {
  precios: Precios | null;
  errores: Partial<Record<ClavePrecio, string>>;
  variaciones: Record<ClavePrecio, number | null>;
  /** Alguna variación supera UMBRAL_VARIACION_PCT: se exige confirmación explícita. */
  requiereConfirmacion: boolean;
}

/** Lee un número digitado ("37.5" o "37,5"). Nunca reemplaza en silencio por el precio actual. */
export function leerPrecio(texto: string): number | null {
  const t = (texto ?? '').trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

export function validarPrecios(draft: Record<ClavePrecio, string>, vigentes: Partial<Precios>): ValidacionPrecios {
  const errores: Partial<Record<ClavePrecio, string>> = {};
  const variaciones = {} as Record<ClavePrecio, number | null>;
  const precios = {} as Precios;
  CLAVES_PRECIO.forEach(k => {
    const n = leerPrecio(draft[k]);
    variaciones[k] = null;
    if (n === null) { errores[k] = 'Ingrese un número.'; return; }
    if (n <= 0) { errores[k] = 'El precio debe ser mayor que 0.'; return; }
    if (n > PRECIO_MAX_POR_LITRO) { errores[k] = `Máximo L ${PRECIO_MAX_POR_LITRO} por litro.`; return; }
    precios[k] = Math.round(n * 100) / 100;
    variaciones[k] = variacionPct(precios[k], vigentes[k]);
  });
  const ok = Object.keys(errores).length === 0;
  return {
    precios: ok ? precios : null,
    errores,
    variaciones,
    requiereConfirmacion: CLAVES_PRECIO.some(k => Math.abs(variaciones[k] ?? 0) > UMBRAL_VARIACION_PCT),
  };
}

/** "Súper 37.42 · Regular 32.84 · Diésel 40.05" para auditoría (antes → después). */
export const resumenPrecios = (p: Precios) => `Súper ${p.super.toFixed(2)} · Regular ${p.regular.toFixed(2)} · Diésel ${p.diesel.toFixed(2)}`;
