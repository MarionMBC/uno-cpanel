// Estado del día (dayStatus): reabrir con motivo y cerrar completando mangueras en mantenimiento (TASK-023).
import { collection, doc, getDocs, limit, orderBy, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { DailyReading, Pump } from '@/types';
import { idLectura, lecturasMantenimientoCierre, manguerasEnMantenimiento } from './totalizadores';

/** Lecturas anteriores consultadas para la última final conocida (igual que Lectura inicial). */
const LECTURAS_PREVIAS = 120;

/** Reabre un día cerrado (hoy o pasado). Las reglas exigen canCloseDay, motivo ≥ 5 y firma de la sesión. */
export async function reabrirDia(fecha: string, motivo: string, autorEmail: string): Promise<void> {
  const m = motivo.trim();
  if (m.length < 5) throw new Error('Escribe el motivo de la reapertura (mínimo 5 letras).');
  await setDoc(doc(db, 'dayStatus', fecha), {
    date: fecha, status: 'en_proceso', reopenedBy: autorEmail.toLowerCase(), reopenedAt: new Date().toISOString(), reopenReason: m,
  }, { merge: true });
}

/**
 * Cierra el día escribiendo en un solo lote las lecturas de las mangueras en mantenimiento
 * (lecturasMantenimientoCierre) y el estado cerrado. Devuelve cuántas lecturas de mantenimiento escribió.
 */
export async function cerrarDiaConMantenimiento(fecha: string, pumps: Pump[], autorEmail: string): Promise<number> {
  const [dia, previas] = await Promise.all([
    getDocs(query(collection(db, 'readings'), where('date', '==', fecha))),
    getDocs(query(collection(db, 'readings'), where('date', '<', fecha), orderBy('date', 'desc'), limit(LECTURAS_PREVIAS))),
  ]);
  const ahora = new Date().toISOString();
  const mant = lecturasMantenimientoCierre({
    fecha, autor: autorEmail, ahora, enMantenimiento: manguerasEnMantenimiento(pumps),
    diarias: dia.docs.map(d => ({ id: d.id, ...d.data() } as DailyReading)),
    previas: previas.docs.map(d => d.data() as DailyReading),
  });
  const batch = writeBatch(db);
  mant.forEach(r => {
    const { id, ...datos } = r;
    batch.set(doc(db, 'readings', id || idLectura(fecha, r.dispenserId)), Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined)), { merge: true });
  });
  batch.set(doc(db, 'dayStatus', fecha), { date: fecha, status: 'cerrado', closedBy: autorEmail, closedAt: ahora }, { merge: true });
  await batch.commit();
  return mant.length;
}
