// Agregación de ventas para Dashboard y reportes (A13). Funciones puras: se prueban con `npm test`.
// Todo sale de las lecturas y de calcVenta (precio de la lectura): mismas cifras que el Cuadro.
import type { DailyReading } from '../types';
import { calcVenta, lecturasPorDispensador, round, type PreciosRespaldo } from './totalizadores.ts';
import { sumarDias } from './fecha.ts';

export interface VentaDia {
  fecha: string;
  litros: number;
  total: number;
  /** Lecturas sin final (o inválidas) que todavía no suman. */
  pendientes: number;
  /** Lecturas (una por dispensador) del día. */
  lecturas: number;
}

/** Los `n` días ISO que terminan en `hasta` (incluido), del más viejo al más nuevo. */
export function rangoDias(hasta: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => sumarDias(hasta, i - (n - 1)));
}

/** Agrupa por fecha y deja una lectura por dispensador y día (misma regla que el Cuadro). */
function porDia(readings: DailyReading[]): Map<string, DailyReading[]> {
  const crudo = new Map<string, DailyReading[]>();
  readings.forEach(r => { if (!crudo.has(r.date)) crudo.set(r.date, []); crudo.get(r.date)!.push(r); });
  const m = new Map<string, DailyReading[]>();
  crudo.forEach((lista, fecha) => m.set(fecha, [...lecturasPorDispensador(lista).values()]));
  return m;
}

/** Ventas por día para las fechas dadas (días sin lecturas en 0). */
export function ventasPorDia(readings: DailyReading[], fechas: string[], precios: PreciosRespaldo): VentaDia[] {
  const dias = porDia(readings);
  return fechas.map(fecha => {
    let litros = 0, total = 0, pendientes = 0;
    const lista = dias.get(fecha) ?? [];
    lista.forEach(r => {
      const v = calcVenta(r, precios);
      if (v.estado === 'ok') { litros += v.litros; total += v.total; }
      else if (v.estado === 'pendiente' || v.estado === 'invalida') pendientes++;
    });
    return { fecha, litros: round(litros, 3), total: round(total, 2), pendientes, lecturas: lista.length };
  });
}

export interface TotalGrupo { id: string; nombre: string; litros: number; total: number }

/**
 * Totales por bomba y por producto de un conjunto de lecturas (varios días). Nombre y producto
 * salen de la lectura, no de la configuración actual: una bomba inactiva hoy no borra el mes.
 */
export function totalesPorGrupo(readings: DailyReading[], precios: PreciosRespaldo): { bombas: TotalGrupo[]; productos: TotalGrupo[]; litros: number; total: number } {
  const bombas = new Map<string, TotalGrupo>();
  const productos = new Map<string, TotalGrupo>();
  const sumar = (m: Map<string, TotalGrupo>, id: string, nombre: string, litros: number, total: number) => {
    const g = m.get(id) ?? { id, nombre, litros: 0, total: 0 };
    g.litros = round(g.litros + litros, 3);
    g.total = round(g.total + total, 2);
    m.set(id, g);
  };
  let litros = 0, total = 0;
  porDia(readings).forEach(lista => lista.forEach(r => {
    const v = calcVenta(r, precios);
    if (v.estado !== 'ok') return;
    sumar(bombas, r.pumpId || r.pumpName, r.pumpName || r.pumpId, v.litros, v.total);
    sumar(productos, r.fuelId, r.fuelName || r.fuelId, v.litros, v.total);
    litros += v.litros; total += v.total;
  }));
  const orden = (a: TotalGrupo, b: TotalGrupo) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true });
  return { bombas: [...bombas.values()].sort(orden), productos: [...productos.values()].sort(orden), litros: round(litros, 3), total: round(total, 2) };
}

/** Primer y último día ISO de un mes "YYYY-MM". */
export function rangoMes(mes: string): { desde: string; hasta: string; dias: string[] } {
  const [y, m] = mes.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const desde = `${mes}-01`;
  const dias = Array.from({ length: n }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
  return { desde, hasta: dias[n - 1], dias };
}

/** Los últimos `n` meses "YYYY-MM" hasta `mes` (incluido), del más nuevo al más viejo. */
export function mesesHasta(mes: string, n: number): string[] {
  const [y, m] = mes.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "Noviembre 2026" de "2026-11". */
export function nombreMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  const n = MESES[m - 1] ?? '';
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} ${y}`;
}
