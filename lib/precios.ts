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

/** Historial ordenado por vigencia, más reciente primero (empate: la registrada después). */
export function ordenarPorVigencia<T extends ConVigencia>(historial: T[]): T[] {
  return [...historial].sort((a, b) => {
    const va = vigenciaDe(a), vb = vigenciaDe(b);
    if (va !== vb) return va < vb ? 1 : -1;
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  });
}

/** Entrada que rige en `instante` (ISO): la de vigencia más reciente que ya empezó. */
export function precioVigente<T extends ConVigencia>(historial: T[], instante: string): T | null {
  return ordenarPorVigencia(historial).find(p => { const v = vigenciaDe(p); return v !== '' && v <= instante; }) ?? null;
}

/** Próximo precio programado (vigencia futura más cercana), o null. */
export function proximoPrecio<T extends ConVigencia>(historial: T[], instante: string): T | null {
  const futuros = ordenarPorVigencia(historial).filter(p => vigenciaDe(p) > instante);
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
