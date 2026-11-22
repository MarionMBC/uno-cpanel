// Estado del día (dayStatus): reabrir con motivo y cerrar completando mangueras en mantenimiento (TASK-023).
// Ambos en transacción: la reapertura escribe su auditoría en la misma transacción; el cierre relee las
// lecturas que va a escribir para no pisar una que otro equipo creó entretanto.
import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where, type DocumentSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { DailyReading, Pump } from '@/types';
import { idLectura, lecturasMantenimientoCierre, lecturasPorDispensador, manguerasEnMantenimiento, type PreciosPorLitro } from './totalizadores';
import { instanteHN } from './fecha';

export const MOTIVO_REAPERTURA_MAX = 500;

/**
 * Reabre un día cerrado (hoy o pasado) y deja la auditoría en la misma transacción. Las reglas exigen
 * canCloseDay, motivo 5–500, reopenedBy = correo de la sesión y reopenedAt = hora del servidor.
 */
export async function reabrirDia(fecha: string, motivo: string, autorEmail: string, auditoria: Record<string, unknown>): Promise<void> {
  const m = motivo.trim();
  if (m.length < 5) throw new Error('Escribe el motivo de la reapertura (mínimo 5 letras).');
  if (m.length > MOTIVO_REAPERTURA_MAX) throw new Error(`El motivo admite hasta ${MOTIVO_REAPERTURA_MAX} caracteres.`);
  if (!autorEmail) throw new Error('Sin sesión: vuelve a iniciar sesión.');
  const ref = doc(db, 'dayStatus', fecha);
  await runTransaction(db, async tx => {
    const d = await tx.get(ref);
    if (d.data()?.status !== 'cerrado') throw new Error('El día ya no está cerrado.');
    tx.update(ref, { status: 'en_proceso', reopenedBy: autorEmail.toLowerCase(), reopenedAt: serverTimestamp(), reopenReason: m });
    tx.set(doc(collection(db, 'auditLog')), auditoria);
  });
}

/** Lecturas de un dispensador (consulta de un solo campo: sin índice compuesto ni tope de días). */
async function historialDe(dispenserId: string): Promise<DailyReading[]> {
  const s = await getDocs(query(collection(db, 'readings'), where('dispenserId', '==', dispenserId)));
  return s.docs.map(d => d.data() as DailyReading);
}

/**
 * Cierra el día en una transacción: completa las lecturas de mantenimiento sin final y, solo si el día es hoy,
 * crea la de cada manguera en mantenimiento real sin lectura (con la última final conocida, el precio vigente
 * de esa fecha y la hora de apertura del día). Devuelve cuántas lecturas de mantenimiento escribió.
 */
export async function cerrarDiaConMantenimiento(p: { fecha: string; hoy: string; pumps: Pump[]; autorEmail: string; precios: PreciosPorLitro }): Promise<number> {
  const { fecha } = p;
  if (!p.autorEmail) throw new Error('Sin sesión: vuelve a iniciar sesión.');
  const dia = await getDocs(query(collection(db, 'readings'), where('date', '==', fecha)));
  const diarias0 = dia.docs.map(d => ({ id: d.id, ...d.data() } as DailyReading));
  const conLectura = lecturasPorDispensador(diarias0);
  // En días pasados la configuración actual no dice qué estaba en mantenimiento ese día: no se fabrica nada.
  const enMant = fecha === p.hoy ? manguerasEnMantenimiento(p.pumps).filter(m => !conLectura.has(m.dispenserId)) : [];
  const previas = (await Promise.all(enMant.map(m => historialDe(m.dispenserId)))).flat();
  const autor = p.autorEmail.toLowerCase();
  const plan0 = lecturasMantenimientoCierre({ fecha, diarias: diarias0, enMantenimiento: enMant, previas, autor, ahora: '', precios: p.precios, creadaEn: instanteHN(fecha) });
  const dref = doc(db, 'dayStatus', fecha);
  return runTransaction(db, async tx => {
    const d = await tx.get(dref);
    if (d.data()?.status === 'cerrado') throw new Error('El día ya está cerrado.');
    const refs = plan0.map(r => doc(db, 'readings', r.id || idLectura(fecha, r.dispenserId)));
    const actuales: DocumentSnapshot[] = await Promise.all(refs.map(r => tx.get(r)));
    const ahora = new Date().toISOString();
    // Con lo releído: la existente que ya tiene final, o la fabricada que otro equipo creó entretanto, no se toca.
    const diarias = actuales.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() } as DailyReading));
    const faltan = enMant.filter(m => !actuales.some(s => s.exists() && (s.data() as DailyReading).dispenserId === m.dispenserId));
    const plan = lecturasMantenimientoCierre({ fecha, diarias, enMantenimiento: faltan, previas, autor, ahora, precios: p.precios, creadaEn: instanteHN(fecha) });
    plan.forEach(r => {
      const { id, ...datos } = r;
      const ref = doc(db, 'readings', id || idLectura(fecha, r.dispenserId));
      if (id) tx.update(ref, { finalReading: r.finalReading, liters: 0, gallons: 0, total: 0, closedBy: autor, closedAt: ahora });
      else tx.set(ref, Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined)));
    });
    tx.set(dref, { date: fecha, status: 'cerrado', closedBy: autor, closedAt: serverTimestamp() }, { merge: true });
    return plan.length;
  });
}
