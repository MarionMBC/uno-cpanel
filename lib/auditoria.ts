// Auditoría con fecha-hora real (A12). Funciones puras: se prueban con `npm test`.
import type { AuditEntry } from '../types';
import { diaOperativo, horaHN, OFFSET_HN } from './fecha.ts';

/** Lo que cada pantalla aporta; quién y cuándo lo completa el contexto con la sesión actual. */
export type AuditInput = Pick<AuditEntry, 'action' | 'target' | 'detail' | 'icon'> & Partial<Pick<AuditEntry, 'before' | 'after' | 'reason'>>;

export interface AutorAuditoria { uid: string; name: string; roleName: string }

/**
 * Entrada lista para escribir (sin `at`, que va como serverTimestamp). userId y userName salen siempre
 * de la sesión: las reglas exigen userId == auth.uid y userName == nombre de la ficha.
 * Quita campos undefined (Firestore los rechaza).
 */
export function armarEntrada(input: AuditInput, autor: AutorAuditoria, ahora: Date): Omit<AuditEntry, 'id' | 'at'> {
  const e: Omit<AuditEntry, 'id' | 'at'> = {
    ...input,
    date: diaOperativo(ahora),
    timestamp: horaHN(ahora),
    userId: autor.uid,
    userName: autor.name,
    userRole: autor.roleName,
  };
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined)) as Omit<AuditEntry, 'id' | 'at'>;
}

/** Día ISO de una fecha guardada como YYYY-MM-DD o dd/mm/aaaa (entradas viejas). */
function diaLegacy(date: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (iso) return date;
  const hn = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((date || '').trim());
  if (hn) return `${hn[3]}-${hn[2].padStart(2, '0')}-${hn[1].padStart(2, '0')}`;
  return null;
}

/** HH:MM de 24 h desde "07:05", "7:05 p. m.", "07:05 PM"… (entradas viejas con toLocaleTimeString). */
function horaLegacy(t: string): string {
  const m = /(\d{1,2}):(\d{2})/.exec(t || '');
  if (!m) return '00:00';
  let h = Number(m[1]);
  const txt = (t || '').toLowerCase().replace(/[\s.]/g, '');
  if (/pm$/.test(txt) && h < 12) h += 12;
  if (/am$/.test(txt) && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/**
 * Clave cronológica (ISO UTC). Con `at` manda `at`; las entradas viejas se reconstruyen con
 * date + timestamp en hora de Honduras. Sin fecha legible: '' (quedan al final).
 */
export function claveOrden(e: Pick<AuditEntry, 'at' | 'date' | 'timestamp'>): string {
  if (e.at) return e.at;
  const dia = diaLegacy(e.date);
  if (!dia) return '';
  const d = new Date(`${dia}T${horaLegacy(e.timestamp)}:00${OFFSET_HN}`);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Más reciente primero, entre días distintos (antes se ordenaba solo por "HH:MM"). */
export function ordenarAuditoria<T extends Pick<AuditEntry, 'at' | 'date' | 'timestamp'>>(entradas: T[]): T[] {
  return entradas
    .map((e, i) => ({ e, i, k: claveOrden(e) }))
    .sort((a, b) => (a.k === b.k ? a.i - b.i : a.k < b.k ? 1 : -1))
    .map(x => x.e);
}

/** Día operativo (YYYY-MM-DD, Honduras) de la entrada. */
export function diaDeEntrada(e: Pick<AuditEntry, 'at' | 'date' | 'timestamp'>): string {
  if (e.at) return diaOperativo(new Date(e.at));
  return diaLegacy(e.date) ?? '';
}

/** Hora HH:MM (Honduras) para mostrar. */
export const horaDeEntrada = (e: Pick<AuditEntry, 'at' | 'timestamp'>) => (e.at ? horaHN(e.at) : horaLegacy(e.timestamp));

export interface FiltroAuditoria { fecha?: string; usuario?: string; accion?: string }

export function filtrarAuditoria<T extends AuditEntry>(entradas: T[], f: FiltroAuditoria): T[] {
  return entradas.filter(e =>
    (!f.fecha || diaDeEntrada(e) === f.fecha)
    && (!f.usuario || e.userName === f.usuario)
    && (!f.accion || e.action === f.accion));
}

/** "antes → después" cuando la entrada trae alguno de los dos. */
export function cambioDe(e: Pick<AuditEntry, 'before' | 'after'>): string | null {
  const vacio = (v: unknown) => v === undefined || v === null || v === '';
  if (vacio(e.before) && vacio(e.after)) return null;
  return `${vacio(e.before) ? '—' : e.before} → ${vacio(e.after) ? '—' : e.after}`;
}
