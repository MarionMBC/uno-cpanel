// Escrituras de turnos (TASK-019). Transacciones para que apertura, cierre y traspaso sean atómicos.
import { collection, doc, getDocs, query, runTransaction, setDoc, where, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import type { AsignacionTurno, CashCount, CortePrecio, DailyReading, Operacion, Shift, ShiftReading } from '@/types';
import { idLectura, round } from './totalizadores';
import { bloqueoCierreDia, idArqueo, idLecturaTurno, idTurno } from './turnos';

const limpio = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([k, v]) => k !== 'id' && v !== undefined));

export const refEstado = () => doc(db, 'shiftState', 'actual');

export async function guardarOperacion(op: Operacion): Promise<void> {
  await setDoc(doc(db, 'settings', 'operacion'), op, { merge: true });
}

export interface Autor { email: string; name: string }

export interface AperturaManguera {
  base: Omit<ShiftReading, 'shiftId' | 'date' | 'attendantEmail' | 'attendantName' | 'fuelPrice' | 'initialReading'>;
  initialReading: number;
  previousFinal: number | null;
  continuityReason?: string;
}

/**
 * B2/B4: abre el turno, crea sus lecturas encadenadas y, si es el primer turno del día, las
 * lecturas diarias (inicial = inicial del primer turno; no pisa las existentes).
 */
export async function abrirTurno(p: {
  fecha: string; templateId: string; name: string; prices: Record<string, number>;
  assignments: AsignacionTurno[]; mangueras: AperturaManguera[]; autor: Autor;
}): Promise<string> {
  const shiftId = idTurno(p.fecha, p.templateId);
  const ahora = new Date().toISOString();
  const assignments = p.assignments.map(a => ({ ...a, email: a.email.trim().toLowerCase(), name: a.name.trim() }));
  const dueño = new Map<string, AsignacionTurno>();
  assignments.forEach(a => a.dispenserIds.forEach(d => dueño.set(d, a)));
  return runTransaction(db, async tx => {
    const est = await tx.get(refEstado());
    const abierto = est.exists() ? (est.data().openShiftId as string | null) : null;
    if (abierto) throw new Error(`Ya hay un turno abierto (${abierto}). Ciérralo antes de abrir otro.`);
    const sref = doc(db, 'shifts', shiftId);
    if ((await tx.get(sref)).exists()) throw new Error(`El turno ${p.name} del ${p.fecha} ya existe.`);
    const drefs = p.mangueras.map(m => doc(db, 'readings', idLectura(p.fecha, m.base.dispenserId)));
    const diarias = await Promise.all(drefs.map(r => tx.get(r)));
    const shift: Shift = {
      date: p.fecha, templateId: p.templateId, name: p.name, status: 'abierto',
      openedBy: p.autor.email, openedByName: p.autor.name, openedAt: ahora,
      prices: p.prices, prevShiftId: est.exists() ? (est.data().lastShiftId as string | null) ?? null : null,
      assignments, attendantEmails: assignments.map(a => a.email), dispenserIds: p.mangueras.map(m => m.base.dispenserId),
    };
    tx.set(sref, limpio(shift));
    p.mangueras.forEach((m, i) => {
      const a = dueño.get(m.base.dispenserId) as AsignacionTurno;
      const precio = p.prices[m.base.fuelId] ?? 0;
      const rompe = m.previousFinal !== null && round(m.previousFinal, 3) !== round(m.initialReading, 3);
      const sr: ShiftReading = {
        ...m.base, shiftId, date: p.fecha, fuelPrice: precio, initialReading: m.initialReading,
        attendantEmail: a.email, attendantName: a.name, previousFinal: m.previousFinal,
        ...(rompe ? { continuityBreak: true, continuityReason: m.continuityReason } : {}),
      };
      tx.set(doc(db, 'shiftReadings', idLecturaTurno(shiftId, m.base.dispenserId)), limpio(sr));
      if (!diarias[i].exists()) {
        const d: DailyReading = {
          date: p.fecha, dispenserId: m.base.dispenserId, dispenserName: m.base.dispenserName, face: m.base.face,
          pumpId: m.base.pumpId, pumpName: m.base.pumpName, fuelId: m.base.fuelId, fuelName: m.base.fuelName,
          fuelPrice: precio, initialReading: m.initialReading, status: 'activo', createdBy: p.autor.email, createdAt: ahora,
          ...(m.base.meterMax !== undefined ? { meterMax: m.base.meterMax } : {}),
        };
        tx.set(drefs[i], limpio(d));
      }
    });
    tx.set(refEstado(), { openShiftId: shiftId, lastShiftId: shift.prevShiftId ?? null, updatedAt: ahora, updatedBy: p.autor.email });
    return shiftId;
  });
}

/**
 * B4: cierra el turno con sus finales; la final de cada manguera pasa a la lectura diaria (la diaria
 * queda con la final del último turno cerrado). El puntero queda libre para el próximo turno.
 */
export async function cerrarTurno(p: { shift: Shift; finales: { dispenserId: string; finalReading: number; rollover: boolean }[]; autor: Autor }): Promise<void> {
  const shiftId = p.shift.id as string;
  const ahora = new Date().toISOString();
  await runTransaction(db, async tx => {
    const sref = doc(db, 'shifts', shiftId);
    const s = await tx.get(sref);
    if (!s.exists() || s.data().status !== 'abierto') throw new Error('El turno ya no está abierto.');
    const drefs = p.finales.map(f => doc(db, 'readings', idLectura(p.shift.date, f.dispenserId)));
    const diarias = await Promise.all(drefs.map(r => tx.get(r)));
    p.finales.forEach((f, i) => {
      tx.update(doc(db, 'shiftReadings', idLecturaTurno(shiftId, f.dispenserId)), { finalReading: f.finalReading, rollover: f.rollover });
      if (diarias[i].exists()) {
        const d = diarias[i].data() as DailyReading;
        // La diaria acumula: litros = final del último turno − inicial del primero (calcVenta en Cuadro/Dashboard).
        tx.update(drefs[i], {
          finalReading: f.finalReading, rollover: d.rollover === true || f.rollover,
          closedBy: p.autor.email, closedAt: ahora,
        });
      }
    });
    tx.update(sref, { status: 'cerrado', closedBy: p.autor.email, closedByName: p.autor.name, closedAt: ahora });
    tx.set(refEstado(), { openShiftId: null, lastShiftId: shiftId, updatedAt: ahora, updatedBy: p.autor.email });
  });
}

/** B6: lectura de corte por cambio de precio con el turno abierto. El tramo anterior queda al precio viejo. */
export async function cortarPrecio(p: { shift: Shift; cortes: { dispenserId: string; reading: number; oldPrice: number; newPrice: number }[]; newPrices: Record<string, number>; autor: Autor }): Promise<void> {
  const shiftId = p.shift.id as string;
  const ahora = new Date().toISOString();
  await runTransaction(db, async tx => {
    const sref = doc(db, 'shifts', shiftId);
    const s = await tx.get(sref);
    if (!s.exists() || s.data().status !== 'abierto') throw new Error('El turno ya no está abierto.');
    p.cortes.forEach(c => {
      tx.update(doc(db, 'shiftReadings', idLecturaTurno(shiftId, c.dispenserId)), {
        cuts: arrayUnion({ reading: c.reading, fuelPrice: c.oldPrice, at: ahora }), fuelPrice: c.newPrice,
      });
    });
    const corte: CortePrecio = { at: ahora, by: p.autor.email, oldPrices: p.shift.prices, newPrices: p.newPrices };
    tx.update(sref, { prices: p.newPrices, priceCuts: arrayUnion(corte) });
  });
}

export async function guardarArqueo(c: CashCount): Promise<void> {
  await setDoc(doc(db, 'cashCounts', idArqueo(c.shiftId, c.email)), limpio(c));
}

export async function cargarDia(fecha: string): Promise<{ shifts: Shift[]; lecturas: ShiftReading[]; arqueos: CashCount[] }> {
  const [s, l, a] = await Promise.all([
    getDocs(query(collection(db, 'shifts'), where('date', '==', fecha))),
    getDocs(query(collection(db, 'shiftReadings'), where('date', '==', fecha))),
    getDocs(query(collection(db, 'cashCounts'), where('date', '==', fecha))),
  ]);
  return {
    shifts: s.docs.map(d => ({ id: d.id, ...d.data() } as Shift)),
    lecturas: l.docs.map(d => ({ id: d.id, ...d.data() } as ShiftReading)),
    arqueos: a.docs.map(d => ({ id: d.id, ...d.data() } as CashCount)),
  };
}

/** B7: razones por las que el día no puede cerrarse (consulta Firestore). */
export async function bloqueoCierre(fecha: string): Promise<string[]> {
  const { shifts, arqueos } = await cargarDia(fecha);
  return bloqueoCierreDia(fecha, shifts, arqueos);
}
