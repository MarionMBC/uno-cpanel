// Lógica pura de inventario (pipas, cuadre guardado, arrastre del día anterior) y de bombas con
// lecturas abiertas. Sin imports de runtime de Firebase: se prueba con `npm test`.
import { galonesPipa, galonesRecibidos, type CuadreTanque } from './calibracion.ts';

/** Diferencia de cuadre, en % de lo vendido, a partir de la cual se alerta. */
export const UMBRAL_EVAPORACION_PCT = 0.5;

interface PipaLike {
  fuelId: string;
  gallons?: number;
  amount: number;
  voided?: boolean;
}

/** Galones de las pipas no anuladas de un producto. */
export function totalPipas(receipts: PipaLike[] | undefined, fuelId: string): number {
  return (receipts || [])
    .filter(r => r.fuelId === fuelId && !r.voided)
    .reduce((s, r) => s + galonesPipa(r), 0);
}

/**
 * Recibido en un tanque. Si el día tiene pipas de ese producto, manda la suma de las no anuladas
 * (el agregado `refueledGallons` es solo una copia). Sin pipas, el agregado o el legado en litros.
 */
export function recibidoTanque(
  receipts: PipaLike[] | undefined,
  fuelId: string,
  tk?: { refueledGallons?: number; refueledAmount?: number },
): number {
  const delProducto = (receipts || []).some(r => r.fuelId === fuelId);
  return delProducto ? totalPipas(receipts, fuelId) : galonesRecibidos(tk);
}

/** true si |porcentaje| supera el umbral. Sin ventas (null) no alerta. */
export const fueraDeUmbral = (porcentaje: number | null, umbral = UMBRAL_EVAPORACION_PCT) =>
  porcentaje !== null && Math.abs(porcentaje) > umbral;

export interface CuadreGuardado extends CuadreTanque {
  alerta: boolean;
  /** Había mangueras sin lectura completa al cuadrar. */
  provisional: boolean;
  savedAt: string;
  savedBy: string;
}

/** Lo que se persiste en `dayStatus.tanks[f].cuadre` al "Guardar y Cuadrar". */
export function cuadreParaGuardar(c: CuadreTanque, p: { provisional: boolean; savedAt: string; savedBy: string }): CuadreGuardado {
  return { ...c, alerta: fueraDeUmbral(c.porcentaje), provisional: p.provisional, savedAt: p.savedAt, savedBy: p.savedBy };
}

/** YYYY-MM-DD del día anterior (calendario puro, sin zona horaria). */
export function diaAnterior(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return t.toISOString().slice(0, 10);
}

/** Galones finales del día anterior y si difieren de la apertura de hoy (tolerancia 0,01 gal). */
export function comparaApertura(inicialHoyGal: number | null | undefined, finalAyerGal: number | null | undefined):
  { difiere: boolean; diferenciaGal: number | null } {
  if (inicialHoyGal === null || inicialHoyGal === undefined || finalAyerGal === null || finalAyerGal === undefined) {
    return { difiere: false, diferenciaGal: null };
  }
  const dif = Math.round((inicialHoyGal - finalAyerGal) * 100) / 100;
  return { difiere: Math.abs(dif) > 0.01, diferenciaGal: dif };
}

/**
 * Mezcla lo que llega del servidor con el borrador local: solo se reemplazan los campos que el
 * usuario no tocó. Así un snapshot (pipa de otro equipo, fondo de caja) no borra lo digitado.
 */
export function fusionarBorrador<K extends string>(local: Record<K, string>, servidor: Record<K, string>, tocados: ReadonlySet<K>): Record<K, string> {
  const out = { ...local };
  (Object.keys(servidor) as K[]).forEach(k => { if (!tocados.has(k)) out[k] = servidor[k]; });
  return out;
}

interface LecturaLike {
  dispenserId: string;
  pumpId: string;
  finalReading?: number | null;
  status?: string;
}

/** Lecturas abiertas (inicial sin final) del día. Las de mantenimiento no venden: no cuentan. */
export const lecturasAbiertas = <T extends LecturaLike>(readings: T[]) =>
  readings.filter(r => (r.finalReading === undefined || r.finalReading === null) && r.status !== 'mantenimiento');

export const abiertasDeBomba = <T extends LecturaLike>(readings: T[], pumpId: string) =>
  lecturasAbiertas(readings).filter(r => r.pumpId === pumpId);

export const abiertaDeDispensador = <T extends LecturaLike>(readings: T[], dispenserId: string) =>
  lecturasAbiertas(readings).some(r => r.dispenserId === dispenserId);
