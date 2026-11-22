// Escrituras de turnos (TASK-019). Transacciones para que apertura, cierre y traspaso sean atómicos.
import { collection, deleteField, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, where, arrayUnion, type Timestamp, type Transaction } from 'firebase/firestore';
import { db } from './firebase';
import type { AsignacionTurno, CashCount, CortePrecio, DailyReading, Operacion, Shift, ShiftReading } from '@/types';
import { idLectura, round, type PreciosPorLitro } from './totalizadores';
import { bloqueoCierreDia, calcVentaTurno, idArqueo, idLecturaTurno, idTurno, inicialEncadenada, planCorreccion, posterioresDeManguera, recalcularArqueo, tramosDiarios, ventasPorBombero } from './turnos';

const limpio = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([k, v]) => k !== 'id' && v !== undefined));

export const refEstado = () => doc(db, 'shiftState', 'actual');

const fechaHN = (iso: string) => iso.split('-').reverse().join('/');

/** Con el día cerrado no se abre, corta ni cierra un turno: hay que reabrir el día (con motivo). */
async function exigirDiaAbierto(tx: Transaction, fecha: string): Promise<void> {
  const d = await tx.get(doc(db, 'dayStatus', fecha));
  if (d.exists() && d.data().status === 'cerrado') {
    throw new Error(`El día ${fechaHN(fecha)} está cerrado. Reábrelo (con motivo) antes de operar turnos en él.`);
  }
}

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
    await exigirDiaAbierto(tx, p.fecha);
    const sref = doc(db, 'shifts', shiftId);
    if ((await tx.get(sref)).exists()) throw new Error(`El turno ${p.name} del ${p.fecha} ya existe.`);
    const drefs = p.mangueras.map(m => doc(db, 'readings', idLectura(p.fecha, m.base.dispenserId)));
    const diarias = await Promise.all(drefs.map(r => tx.get(r)));
    // La inicial sugerida se calculó al preparar el modal: si entretanto se corrigió la final del turno anterior
    // (TASK-022) o cambió la diaria, la cadena ya no es la que vio quien abre → se rechaza y se vuelve a preparar.
    const prevId = est.exists() ? (est.data().lastShiftId as string | null) ?? null : null;
    const previas = prevId ? await Promise.all(p.mangueras.map(m => tx.get(doc(db, 'shiftReadings', idLecturaTurno(prevId, m.base.dispenserId))))) : [];
    p.mangueras.forEach((m, i) => {
      const ant = previas[i]?.exists() ? [previas[i].data() as ShiftReading] : [];
      const esperado = inicialEncadenada(m.base.dispenserId, ant, diarias[i].exists() ? (diarias[i].data() as DailyReading) : null).valor;
      const vista = m.previousFinal;
      if ((esperado === null) !== (vista === null) || (esperado !== null && vista !== null && round(esperado, 3) !== round(vista, 3))) {
        throw new Error(`${m.base.pumpName} ${m.base.dispenserName}: la final del turno anterior cambió (ahora ${esperado ?? 'sin dato'}). Cierra y vuelve a abrir el formulario de apertura.`);
      }
    });
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
 * queda con la final del último turno cerrado) junto con los tramos vendidos del turno, para que la venta
 * diaria sea Σ turnos aunque cambie el precio entre turnos o haya cortes. El puntero queda libre.
 * Las lecturas del turno se releen en la transacción (cortes hechos desde otra tablet).
 */
export async function cerrarTurno(p: { shift: Shift; finales: { dispenserId: string; finalReading: number; rollover: boolean }[]; precios: PreciosPorLitro; autor: Autor }): Promise<void> {
  const shiftId = p.shift.id as string;
  const ahora = new Date().toISOString();
  await runTransaction(db, async tx => {
    const sref = doc(db, 'shifts', shiftId);
    const s = await tx.get(sref);
    if (!s.exists() || s.data().status !== 'abierto') throw new Error('El turno ya no está abierto.');
    const fecha = s.data().date as string;
    await exigirDiaAbierto(tx, fecha);
    const lrefs = p.finales.map(f => doc(db, 'shiftReadings', idLecturaTurno(shiftId, f.dispenserId)));
    const lecturas = await Promise.all(lrefs.map(r => tx.get(r)));
    const drefs = p.finales.map(f => doc(db, 'readings', idLectura(fecha, f.dispenserId)));
    const diarias = await Promise.all(drefs.map(r => tx.get(r)));
    const ventas = p.finales.map((f, i) => {
      if (!lecturas[i].exists()) throw new Error(`No existe la lectura del turno para ${f.dispenserId}.`);
      const sr = lecturas[i].data() as ShiftReading;
      const v = calcVentaTurno({ ...sr, finalReading: f.finalReading, rollover: f.rollover }, p.precios);
      if (v.estado !== 'ok') throw new Error(`${sr.pumpName} ${sr.dispenserName}: la final no cuadra con la inicial o el último corte. Revísala.`);
      return v;
    });
    p.finales.forEach((f, i) => {
      tx.update(lrefs[i], { finalReading: f.finalReading, rollover: f.rollover });
      if (diarias[i].exists()) {
        const d = diarias[i].data() as DailyReading;
        tx.update(drefs[i], {
          finalReading: f.finalReading, rollover: d.rollover === true || f.rollover,
          tramos: tramosDiarios(d.tramos, shiftId, ventas[i]),
          closedBy: p.autor.email, closedAt: ahora,
        });
      }
    });
    tx.update(sref, { status: 'cerrado', closedBy: p.autor.email, closedByName: p.autor.name, closedAt: ahora });
    tx.set(refEstado(), { openShiftId: null, lastShiftId: shiftId, updatedAt: ahora, updatedBy: p.autor.email });
  });
}

/** B6: lectura de corte por cambio de precio con el turno abierto. El tramo anterior queda al precio viejo. */
export async function cortarPrecio(p: { shift: Shift; cortes: { dispenserId: string; reading: number; newPrice: number }[]; newPrices: Record<string, number>; autor: Autor }): Promise<void> {
  const shiftId = p.shift.id as string;
  const ahora = new Date().toISOString();
  await runTransaction(db, async tx => {
    const sref = doc(db, 'shifts', shiftId);
    const s = await tx.get(sref);
    if (!s.exists() || s.data().status !== 'abierto') throw new Error('El turno ya no está abierto.');
    await exigirDiaAbierto(tx, s.data().date as string);
    const lrefs = p.cortes.map(c => doc(db, 'shiftReadings', idLecturaTurno(shiftId, c.dispenserId)));
    const lecturas = await Promise.all(lrefs.map(r => tx.get(r)));
    p.cortes.forEach((c, i) => {
      if (!lecturas[i].exists()) throw new Error(`No existe la lectura del turno para ${c.dispenserId}.`);
      const sr = lecturas[i].data() as ShiftReading;
      // Revalida con lo guardado: otro corte pudo entrar desde otra tablet. El tramo viejo va al precio guardado.
      const desde = sr.cuts?.length ? sr.cuts[sr.cuts.length - 1].reading : sr.initialReading;
      if (!(c.reading >= desde)) throw new Error(`${sr.pumpName} ${sr.dispenserName}: el corte debe ser mayor o igual a ${desde}.`);
      tx.update(lrefs[i], {
        cuts: arrayUnion({ reading: c.reading, fuelPrice: sr.fuelPrice, at: ahora }), fuelPrice: c.newPrice,
      });
    });
    const corte: CortePrecio = { at: ahora, by: p.autor.email, oldPrices: s.data().prices as Record<string, number>, newPrices: p.newPrices };
    tx.update(sref, { prices: p.newPrices, priceCuts: arrayUnion(corte) });
  });
}

export interface ResultadoCorreccion {
  antes: number; rolloverAntes: boolean;
  /** Final de la lectura diaria antes → después (null si no cambió: la del día es de un turno posterior). */
  finalDiaria: { antes: number | null; despues: number } | null;
  arqueo: { recepcionAnulada: boolean; antes: { expected: number; difference: number }; despues: { expected: number; difference: number } } | null;
  cierraRuptura: boolean;
  avisoContinuidad: string | null;
}

/** Firestore Timestamp (serverTimestamp ya resuelto) o ISO → ISO; lo demás, undefined. */
export const aIso = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : v && typeof (v as Timestamp).toDate === 'function' ? (v as Timestamp).toDate().toISOString() : undefined;

/** Lectura de turno desde Firestore con correctedAt normalizado a ISO. */
export const lecturaTurnoDe = (id: string, d: Record<string, unknown>): ShiftReading =>
  ({ id, ...d, ...(d.correctedAt !== undefined ? { correctedAt: aIso(d.correctedAt) } : {}) } as ShiftReading);

const puntero = (d: { exists(): boolean; data(): Record<string, unknown> | undefined }) =>
  d.exists() ? `${d.data()?.openShiftId ?? ''}|${d.data()?.lastShiftId ?? ''}` : '|';

/**
 * TASK-022: corrige la final de una manguera en un turno cerrado (canCloseDay, día abierto o reabierto, motivo).
 * Antes de la transacción busca las lecturas posteriores de esa manguera (el SDK no consulta dentro de una tx);
 * adentro relee el puntero (si se abrió o cerró otro turno entretanto, falla y se reintenta), la lectura, la
 * próxima lectura de la manguera, la diaria y el arqueo. La diaria reemplaza los tramos del turno (y su final si
 * fue el último cierre del día). El arqueo del bombero se recalcula; si estaba recibido, se quita la recepción.
 * Si la corrección cierra la diferencia que había marcado el turno siguiente, su continuityBreak se limpia.
 */
export async function corregirFinalTurno(p: {
  shiftId: string; dispenserId: string; finalReading: number; rollover: boolean; motivo: string; precios: PreciosPorLitro; autor: Autor;
}): Promise<ResultadoCorreccion> {
  const motivo = p.motivo.trim();
  if (motivo.length < 5) throw new Error('Escribe el motivo de la corrección (mínimo 5 letras).');
  const s0 = await getDoc(doc(db, 'shifts', p.shiftId));
  if (!s0.exists()) throw new Error('El turno no existe.');
  const turno0 = { id: s0.id, ...s0.data() } as Shift;
  const [est0, ss, ls] = await Promise.all([
    getDoc(refEstado()),
    // Un solo campo por consulta (sin índice compuesto) y sin traer todo lo posterior a un día viejo.
    getDocs(query(collection(db, 'shifts'), where('dispenserIds', 'array-contains', p.dispenserId))),
    getDocs(query(collection(db, 'shiftReadings'), where('dispenserId', '==', p.dispenserId))),
  ]);
  const desde = <T extends { date: string }>(xs: T[]) => xs.filter(x => x.date >= turno0.date);
  const pos = posterioresDeManguera(turno0, p.dispenserId, desde(ss.docs.map(d => ({ id: d.id, ...d.data() } as Shift))), desde(ls.docs.map(d => lecturaTurnoDe(d.id, d.data()))));
  return runTransaction(db, async tx => {
    const s = await tx.get(doc(db, 'shifts', p.shiftId));
    if (!s.exists() || s.data().status !== 'cerrado') throw new Error('Solo se corrige la final de un turno cerrado.');
    const shift = { id: s.id, ...s.data() } as Shift;
    await exigirDiaAbierto(tx, shift.date);
    if (puntero(await tx.get(refEstado())) !== puntero(est0)) throw new Error('Se abrió o cerró otro turno mientras corregías. Vuelve a intentarlo.');
    const lref = doc(db, 'shiftReadings', idLecturaTurno(p.shiftId, p.dispenserId));
    const l = await tx.get(lref);
    if (!l.exists()) throw new Error('No existe la lectura del turno para esa manguera.');
    const sr = l.data() as ShiftReading;
    const sigRef = pos.siguiente ? doc(db, 'shiftReadings', idLecturaTurno(pos.siguiente.shiftId, p.dispenserId)) : null;
    const sl = sigRef ? await tx.get(sigRef) : null;
    const sig = sl?.exists() ? (sl.data() as ShiftReading) : null;
    const dref = doc(db, 'readings', idLectura(shift.date, p.dispenserId));
    const d = await tx.get(dref);
    const diaria = d.exists() ? (d.data() as DailyReading) : null;
    const asign = shift.assignments.find(a => a.dispenserIds.includes(p.dispenserId));
    const cref = asign ? doc(db, 'cashCounts', idArqueo(p.shiftId, asign.email)) : null;
    const c = cref ? await tx.get(cref) : null;
    const otras = asign && c?.exists()
      ? await Promise.all(asign.dispenserIds.filter(x => x !== p.dispenserId).map(x => tx.get(doc(db, 'shiftReadings', idLecturaTurno(p.shiftId, x)))))
      : [];
    // La ruptura del siguiente se limpia solo si su día no está cerrado (las reglas lo exigen).
    const diaSigAbierto = sig && sig.date !== shift.date
      ? (await tx.get(doc(db, 'dayStatus', sig.date))).data()?.status !== 'cerrado'
      : true;

    const plan = planCorreccion({
      sr, nuevaFinal: p.finalReading, rollover: p.rollover, precios: p.precios, diaria,
      siguiente: sig && pos.siguiente ? { nombre: pos.siguiente.nombre, initialReading: sig.initialReading } : null,
      cierrePosteriorDelDia: pos.cierrePosteriorDelDia,
    });
    if (!plan.ok) throw new Error(plan.error);

    tx.update(lref, { finalReading: p.finalReading, rollover: p.rollover, correctedBy: p.autor.email, correctedAt: serverTimestamp(), correctionReason: motivo });
    if (plan.diaria) tx.update(dref, { tramos: plan.diaria.tramos, finalReading: plan.diaria.finalReading, rollover: plan.diaria.rollover });
    const limpiaRuptura = plan.cierraRuptura && !!sigRef && sig?.continuityBreak === true && diaSigAbierto;
    if (limpiaRuptura && sigRef) tx.update(sigRef, { continuityBreak: false, previousFinal: p.finalReading });
    let arqueo: ResultadoCorreccion['arqueo'] = null;
    if (asign && cref && c?.exists()) {
      const cc = c.data() as CashCount;
      const lecturas = [{ ...sr, finalReading: p.finalReading, rollover: p.rollover }, ...otras.filter(x => x.exists()).map(x => x.data() as ShiftReading)];
      const venta = ventasPorBombero({ assignments: [asign] }, lecturas, p.precios)[0];
      const recibido = !!cc.receivedBy;
      const nuevo = recalcularArqueo(cc, venta.total);
      tx.update(cref, {
        ...nuevo, recalculatedBy: p.autor.email, recalculatedAt: new Date().toISOString(),
        ...(recibido ? { receivedBy: deleteField(), receivedAt: deleteField() } : {}),
      });
      arqueo = { recepcionAnulada: recibido, antes: { expected: cc.expected, difference: cc.difference }, despues: { expected: nuevo.expected, difference: nuevo.difference } };
    }
    const cambioDiaria = !!plan.diaria && plan.diaria.finalReading !== diaria?.finalReading;
    return {
      antes: sr.finalReading as number, rolloverAntes: sr.rollover === true, arqueo,
      finalDiaria: cambioDiaria ? { antes: diaria?.finalReading ?? null, despues: plan.diaria?.finalReading as number } : null,
      cierraRuptura: limpiaRuptura,
      avisoContinuidad: plan.avisoContinuidad
        ?? (plan.cierraRuptura && sig?.continuityBreak === true && !diaSigAbierto
          ? `La diferencia con el turno ${pos.siguiente?.nombre ?? 'siguiente'} quedó cerrada, pero su marca de continuidad se quita al reabrir el día ${sig.date.split('-').reverse().join('/')}.`
          : null),
    };
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
    lecturas: l.docs.map(d => lecturaTurnoDe(d.id, d.data())),
    arqueos: a.docs.map(d => ({ id: d.id, ...d.data() } as CashCount)),
  };
}

/** B7: razones por las que el día no puede cerrarse (consulta Firestore). */
export async function bloqueoCierre(fecha: string): Promise<string[]> {
  const { shifts, arqueos } = await cargarDia(fecha);
  return bloqueoCierreDia(fecha, shifts, arqueos);
}
