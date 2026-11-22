import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bloqueoCierreDia, calcArqueo, calcVentaTurno, fechaDeTurno, idArqueo, idLecturaTurno, idTurno, inicialEncadenada,
  normalizarOperacion, OPERACION_DEFAULT, planCorreccion, plantillaVigente, PLANTILLAS_DEFAULT, preciosCambiados, recalcularArqueo, rompeCadena,
  tramosDiarios, turnoAoa, validarArqueo, validarAsignaciones, validarPlantillas, ventasPorBombero,
} from './turnos.ts';
import { calcVenta } from './totalizadores.ts';
import type { Shift, ShiftReading } from '../types';

const lectura = (over: Partial<ShiftReading> = {}): ShiftReading => ({
  shiftId: '2026-11-21_T1', date: '2026-11-21', dispenserId: 'p1-A-1', dispenserName: 'Manguera 1', face: 'A', pumpId: 'p1',
  pumpName: 'Bomba 01', fuelId: 'diesel', fuelName: 'Diésel', fuelPrice: 34.05, initialReading: 1000, status: 'activo',
  attendantEmail: 'b1@uno.local', attendantName: 'Bombero 1', ...over,
});

const turno = (over: Partial<Shift> = {}): Shift => ({
  id: '2026-11-21_T1', date: '2026-11-21', templateId: 'T1', name: 'Mañana', status: 'cerrado', openedBy: 'a', openedByName: 'A',
  openedAt: '', prices: { diesel: 34.05 }, assignments: [
    { email: 'b1@uno.local', name: 'Bombero 1', dispenserIds: ['p1-A-1', 'p1-A-2'], cashFund: 2000 },
    { email: 'b2@uno.local', name: 'Bombero 2', dispenserIds: ['p1-B-1'], cashFund: 1500 },
  ], attendantEmails: ['b1@uno.local', 'b2@uno.local'], dispenserIds: ['p1-A-1', 'p1-A-2', 'p1-B-1'], ...over,
});

// ─── B1 ───
test('sin settings/operacion el flag queda apagado y con plantillas por defecto', () => {
  assert.deepEqual(normalizarOperacion(undefined), OPERACION_DEFAULT);
  assert.equal(normalizarOperacion({ shiftsEnabled: 'true' }).shiftsEnabled, false);
  assert.equal(normalizarOperacion({ shiftsEnabled: true }).shiftsEnabled, true);
  // plantillas inválidas → las de siempre (no se rompe la pantalla)
  assert.deepEqual(normalizarOperacion({ shiftTemplates: [{ id: 'x', name: '', start: '25:00', end: '1' }] }).shiftTemplates, PLANTILLAS_DEFAULT);
});

test('validarPlantillas: formato y códigos únicos', () => {
  assert.deepEqual(validarPlantillas(PLANTILLAS_DEFAULT), []);
  assert.ok(validarPlantillas([{ id: 'T1', name: 'A', start: '06:00', end: '06:00' }]).length > 0);
  assert.ok(validarPlantillas([{ id: 'T1', name: 'A', start: '06:00', end: '14:00' }, { id: 'T1', name: 'B', start: '14:00', end: '22:00' }]).length > 0);
  assert.ok(validarPlantillas([]).length > 0);
});

test('plantilla vigente y fecha del turno nocturno en hora de Honduras', () => {
  // 21/11 10:00 HN = 16:00 UTC
  assert.equal(plantillaVigente(PLANTILLAS_DEFAULT, new Date('2026-11-21T16:00:00Z'))?.id, 'T1');
  // 21/11 22:30 HN = 22/11 04:30 UTC → Noche del 21
  const noche = new Date('2026-11-22T04:30:00Z');
  assert.equal(plantillaVigente(PLANTILLAS_DEFAULT, noche)?.id, 'T3');
  assert.equal(fechaDeTurno(PLANTILLAS_DEFAULT[2], noche), '2026-11-21');
  // 22/11 01:00 HN = 07:00 UTC → sigue siendo la Noche del 21
  const madrugada = new Date('2026-11-22T07:00:00Z');
  assert.equal(plantillaVigente(PLANTILLAS_DEFAULT, madrugada)?.id, 'T3');
  assert.equal(fechaDeTurno(PLANTILLAS_DEFAULT[2], madrugada), '2026-11-21');
  // 22/11 06:00 HN → Mañana del 22; fin de mes
  assert.equal(fechaDeTurno(PLANTILLAS_DEFAULT[0], new Date('2026-11-22T12:00:00Z')), '2026-11-22');
  assert.equal(fechaDeTurno(PLANTILLAS_DEFAULT[2], new Date('2026-12-01T07:00:00Z')), '2026-11-30');
});

test('IDs deterministas', () => {
  assert.equal(idTurno('2026-11-21', 'T2'), '2026-11-21_T2');
  assert.equal(idLecturaTurno('2026-11-21_T2', 'p1-A-1'), '2026-11-21_T2_p1-A-1');
  assert.equal(idArqueo('2026-11-21_T2', ' B1@Uno.Local '), '2026-11-21_T2_b1@uno.local');
});

// ─── B3 ───
test('asignaciones: cada manguera con exactamente un bombero', () => {
  const t = turno();
  assert.deepEqual(validarAsignaciones(t.dispenserIds, t.assignments), []);
  const sinUna = validarAsignaciones([...t.dispenserIds, 'p2-A-1'], t.assignments);
  assert.ok(sinUna.some(e => e.includes('p2-A-1')));
  const doble = validarAsignaciones(t.dispenserIds, [...t.assignments, { email: 'b3@uno.local', name: 'B3', dispenserIds: ['p1-A-1'], cashFund: 0 }]);
  assert.ok(doble.some(e => e.includes('dos bomberos')));
  assert.ok(validarAsignaciones(['p1-A-1'], [{ email: 'malo', name: 'X', dispenserIds: ['p1-A-1'], cashFund: -1 }]).length >= 2);
});

// ─── B4 ───
test('encadenamiento: inicial = final del turno anterior; si no hay, la lectura diaria', () => {
  const ant = [lectura({ dispenserId: 'p1-A-1', finalReading: 1500.5 }), lectura({ dispenserId: 'p1-A-2' })];
  assert.deepEqual(inicialEncadenada('p1-A-1', ant), { valor: 1500.5, origen: 'turno_anterior' });
  // sin final en el turno anterior → cae a la diaria
  assert.deepEqual(inicialEncadenada('p1-A-2', ant, { initialReading: 900 }), { valor: 900, origen: 'lectura_diaria' });
  assert.deepEqual(inicialEncadenada('p1-A-2', ant, { initialReading: 900, finalReading: 950 }), { valor: 950, origen: 'lectura_diaria' });
  assert.deepEqual(inicialEncadenada('p9', ant), { valor: null, origen: null });
  assert.equal(rompeCadena(1500.5, inicialEncadenada('p1-A-1', ant)), false);
  assert.equal(rompeCadena(1501, inicialEncadenada('p1-A-1', ant)), true);
  assert.equal(rompeCadena(1501, { valor: null, origen: null }), false);
});

test('3 turnos encadenados suman lo mismo que la lectura diaria (inicial del 1.º, final del último)', () => {
  const t1 = lectura({ initialReading: 1000, finalReading: 1200 });
  const t2 = lectura({ initialReading: inicialEncadenada('p1-A-1', [t1]).valor as number, finalReading: 1450.25 });
  const t3 = lectura({ initialReading: inicialEncadenada('p1-A-1', [t2]).valor as number, finalReading: 1500 });
  const suma = [t1, t2, t3].reduce((s, r) => s + calcVentaTurno(r, {}).litros, 0);
  assert.equal(Math.round(suma * 1000) / 1000, 500);
  assert.equal(calcVentaTurno(lectura({ initialReading: 1000, finalReading: 1500 }), {}).litros, 500);
});

// ─── B6 ───
test('corte de precio: cada tramo a su precio', () => {
  // 100 L a 34.05 y 50 L a 35.00
  const r = lectura({ initialReading: 1000, finalReading: 1150, fuelPrice: 35, cuts: [{ reading: 1100, fuelPrice: 34.05, at: '' }] });
  const v = calcVentaTurno(r, {});
  assert.equal(v.estado, 'ok');
  assert.equal(v.litros, 150);
  assert.equal(v.total, 3405 + 1750);
  // pendiente sin final; tramo inválido si el corte es menor a la inicial
  assert.equal(calcVentaTurno(lectura({ cuts: [{ reading: 1100, fuelPrice: 34.05, at: '' }] }), {}).estado, 'pendiente');
  assert.equal(calcVentaTurno(lectura({ finalReading: 1200, cuts: [{ reading: 900, fuelPrice: 34.05, at: '' }] }), {}).estado, 'invalida');
  assert.deepEqual(preciosCambiados({ diesel: 34.05, super: 37.76 }, { diesel: 35, super: 37.76 }, ['diesel', 'super', 'diesel']), ['diesel']);
});

test('vuelta a cero dentro de un tramo', () => {
  const r = lectura({ initialReading: 999900, finalReading: 100, rollover: true, meterMax: 999999.999, fuelPrice: 10 });
  assert.equal(calcVentaTurno(r, {}).litros, 200);
});

// ─── B5 ───
test('arqueo: ejemplo de la auditoría (−L 50,00 con diferencia y nota obligatoria)', () => {
  const a = calcArqueo(45230.5, 2000, { cash: 40000, card: 7180.5, credits: 0, partialDrops: 0 });
  assert.deepEqual(a, { expected: 47230.5, declared: 47180.5, difference: -50, status: 'con_diferencia' });
  assert.ok(validarArqueo({ cash: 40000, card: 7180.5, credits: 0, partialDrops: 0 }, a.difference, '').length > 0);
  assert.deepEqual(validarArqueo({ cash: 40000, card: 7180.5, credits: 0, partialDrops: 0 }, a.difference, 'faltan 50 del vale'), []);
  const ok = calcArqueo(100.1, 0.2, { cash: 0.1, card: 0.2, credits: 0, partialDrops: 100 });
  assert.equal(ok.difference, 0);
  assert.equal(ok.status, 'conforme');
  assert.ok(validarArqueo({ cash: -1, card: 0, credits: 0, partialDrops: 0 }, 0, '').length > 0);
});

test('ventas por bombero: solo sus mangueras; pendientes contados', () => {
  const t = turno();
  const ls = [
    lectura({ dispenserId: 'p1-A-1', initialReading: 0, finalReading: 100, fuelPrice: 10 }),
    lectura({ dispenserId: 'p1-A-2', initialReading: 0, finalReading: 50, fuelPrice: 20 }),
    lectura({ dispenserId: 'p1-B-1', initialReading: 0, fuelPrice: 10 }),
  ];
  const v = ventasPorBombero(t, ls, {});
  assert.deepEqual(v.map(x => [x.email, x.litros, x.total, x.pendientes]), [['b1@uno.local', 150, 2000, 0], ['b2@uno.local', 0, 0, 1]]);
});

// ─── B7 ───
test('cierre de día bloqueado sin turnos, con turno abierto o arqueo sin recibir', () => {
  const t = turno();
  assert.deepEqual(bloqueoCierreDia('2026-11-21', [], []), ['No hay turnos registrados en el día.']);
  assert.ok(bloqueoCierreDia('2026-11-21', [turno({ status: 'abierto' })], []).some(r => r.includes('abierto')));
  const arq = [
    { shiftId: t.id as string, email: 'b1@uno.local', receivedBy: 'admin@uno.local' },
    { shiftId: t.id as string, email: 'b2@uno.local' },
  ];
  assert.deepEqual(bloqueoCierreDia('2026-11-21', [t], arq), ['El arqueo de Bombero 2 (Mañana) no ha sido recibido.']);
  assert.ok(bloqueoCierreDia('2026-11-21', [t], arq.slice(0, 1)).some(r => r.includes('Falta el arqueo de Bombero 2')));
  arq[1].receivedBy = 'admin@uno.local';
  assert.deepEqual(bloqueoCierreDia('2026-11-21', [t], arq), []);
  // turnos de otro día no cuentan
  assert.deepEqual(bloqueoCierreDia('2026-11-22', [t], arq), ['No hay turnos registrados en el día.']);
});

test('hoja Excel por turno trae lecturas, tramos y arqueo por bombero', () => {
  const t = turno();
  const ls = [
    lectura({ dispenserId: 'p1-A-1', initialReading: 0, finalReading: 150, fuelPrice: 35, cuts: [{ reading: 100, fuelPrice: 34.05, at: '' }] }),
  ];
  const aoa = turnoAoa({ shift: t, lecturas: ls, arqueos: [] }, {});
  assert.ok(aoa.some(f => f[5] === 'TOTAL TURNO' && f[6] === 5155));
  assert.ok(aoa.some(f => String(f[0]).includes('tramo')));
  assert.ok(aoa.some(f => f[0] === 'Bombero 2' && f[6] === 'SIN ARQUEO'));
});

// ─── Corrección tras review: diaria = Σ turnos; correo seguro para el id del arqueo ───
test('lectura diaria con tramos de los turnos cuadra con la venta de cada turno (cambio de precio entre turnos y corte)', () => {
  const t1 = lectura({ shiftId: 'D_T1', initialReading: 1000, finalReading: 1200, fuelPrice: 34.05 });
  const t2 = lectura({ shiftId: 'D_T2', initialReading: 1200, finalReading: 1450.25, fuelPrice: 35.1, cuts: [{ reading: 1300, fuelPrice: 34.5, at: '' }] });
  const v1 = calcVentaTurno(t1, {}), v2 = calcVentaTurno(t2, {});
  let tramos = tramosDiarios(undefined, 'D_T1', v1);
  tramos = tramosDiarios(tramos, 'D_T2', v2);
  // Cerrar dos veces el mismo turno no duplica tramos.
  assert.deepEqual(tramosDiarios(tramos, 'D_T2', v2), tramos);
  assert.equal(tramos.length, 3);
  const diaria = calcVenta({ fuelId: 'diesel', fuelPrice: 34.05, initialReading: 1000, finalReading: 1450.25, status: 'activo', tramos }, {});
  assert.equal(diaria.litros, 450.25);
  assert.equal(diaria.total, Math.round((v1.total + v2.total) * 100) / 100);
  // Sin tramos (legado) valoriza todo al precio de la lectura: distinto cuando hubo cambio de precio.
  assert.notEqual(calcVenta({ fuelId: 'diesel', fuelPrice: 34.05, initialReading: 1000, finalReading: 1450.25, status: 'activo' }, {}).total, diaria.total);
});

test('correo del bombero: allowlist (no rompe el id del arqueo)', () => {
  const a = (email: string) => validarAsignaciones(['p1-A-1'], [{ email, name: 'X', dispenserIds: ['p1-A-1'], cashFund: 0 }]);
  assert.deepEqual(a('Juan.Perez+t1@uno.local'), []);
  assert.ok(a('a/b@uno.local').some(e => e.includes('correo inválido')));
  assert.ok(a('a@b').some(e => e.includes('correo inválido')));
});

// ─── TASK-022 corrección de una final con el turno cerrado ───
{
  // Día con dos turnos: T1 1000→1200 (mal digitada; real 1150) y T2 abrió en 1150 marcando la diferencia.
  const t1 = lectura({ shiftId: 'D_T1', initialReading: 1000, finalReading: 1200 });
  const vT1 = calcVentaTurno(t1, {});
  const vT2 = calcVentaTurno(lectura({ shiftId: 'D_T2', initialReading: 1150, finalReading: 1400 }), {});
  const diaria = { fuelId: 'diesel', fuelPrice: 34.05, initialReading: 1000, finalReading: 1400, status: 'activo' as const, tramos: [...tramosDiarios(undefined, 'D_T1', vT1), ...tramosDiarios(undefined, 'D_T2', vT2)] };

  test('corrección: reemplaza los tramos del turno y la diaria vuelve a cuadrar', () => {
    assert.equal(calcVenta(diaria, {}).estado, 'invalida'); // 450 L de tramos contra 400 L del totalizador
    const p = planCorreccion({ sr: t1, nuevaFinal: 1150, rollover: false, diaria, siguiente: { nombre: 'Tarde', initialReading: 1150 }, precios: {} });
    assert.ok(p.ok);
    if (!p.ok) return;
    assert.equal(p.venta.litros, 150);
    assert.equal(p.diaria?.finalReading, 1400); // la final del día es la del T2: no se toca
    assert.deepEqual(p.diaria?.tramos.filter(t => t.shiftId === 'D_T1'), [{ litros: 150, precio: 34.05, shiftId: 'D_T1' }]);
    assert.equal(calcVenta({ ...diaria, ...p.diaria }, {}).litros, 400);
  });

  test('corrección: siguiente turno encadenado con la final vieja → bloqueada', () => {
    const p = planCorreccion({ sr: t1, nuevaFinal: 1150, rollover: false, diaria, siguiente: { nombre: 'Tarde', initialReading: 1200 }, precios: {} });
    assert.equal(p.ok, false);
    if (!p.ok) assert.match(p.error, /Tarde ya abrió esta manguera con inicial 1200/);
  });

  test('corrección del último turno: mueve también la final diaria', () => {
    const d1 = { fuelId: 'diesel', fuelPrice: 34.05, initialReading: 1000, finalReading: 1200, status: 'activo' as const, tramos: tramosDiarios(undefined, 'D_T1', vT1) };
    const p = planCorreccion({ sr: t1, nuevaFinal: 1180.5, rollover: false, diaria: d1, siguiente: null, precios: {} });
    assert.ok(p.ok);
    if (!p.ok) return;
    assert.equal(p.diaria?.finalReading, 1180.5);
    assert.equal(p.diaria?.rollover, false);
    assert.equal(calcVenta({ ...d1, ...p.diaria }, {}).litros, 180.5);
  });

  test('corrección: final menor a la inicial o al último corte, igual a la guardada, o sin final → error', () => {
    const conCorte = lectura({ shiftId: 'D_T1', initialReading: 1000, finalReading: 1200, cuts: [{ reading: 1100, fuelPrice: 33, at: '' }] });
    assert.equal(planCorreccion({ sr: conCorte, nuevaFinal: 1050, rollover: false, diaria: null, siguiente: null, precios: {} }).ok, false);
    assert.equal(planCorreccion({ sr: t1, nuevaFinal: 1200, rollover: false, diaria: null, siguiente: null, precios: {} }).ok, false);
    assert.equal(planCorreccion({ sr: lectura({ shiftId: 'D_T1' }), nuevaFinal: 1100, rollover: false, diaria: null, siguiente: null, precios: {} }).ok, false);
    assert.equal(planCorreccion({ sr: t1, nuevaFinal: -1, rollover: false, diaria: null, siguiente: null, precios: {} }).ok, false);
  });

  test('corrección: vuelta a cero en el último turno marca rollover en la diaria', () => {
    const sr = lectura({ shiftId: 'D_T1', initialReading: 999900, finalReading: 999990, meterMax: 999999.999 });
    const d = { fuelId: 'diesel', fuelPrice: 34.05, initialReading: 999900, finalReading: 999990, status: 'activo' as const, tramos: tramosDiarios(undefined, 'D_T1', calcVentaTurno(sr, {})) };
    const p = planCorreccion({ sr, nuevaFinal: 50, rollover: true, diaria: d, siguiente: null, precios: {} });
    assert.ok(p.ok);
    if (p.ok) { assert.equal(p.diaria?.rollover, true); assert.equal(calcVenta({ ...d, ...p.diaria, meterMax: 999999.999 }, {}).estado, 'ok'); }
  });

  test('corrección que descuadra una diaria que cuadraba → bloqueada', () => {
    // T1 y T2 encadenados (diaria cuadra); el siguiente no se pasó (p. ej. otra manguera): la diaria lo detecta.
    const vB = calcVentaTurno(lectura({ shiftId: 'D_T2', initialReading: 1200, finalReading: 1400 }), {});
    const d = { ...diaria, tramos: [...tramosDiarios(undefined, 'D_T1', vT1), ...tramosDiarios(undefined, 'D_T2', vB)] };
    assert.equal(calcVenta(d, {}).estado, 'ok');
    const p = planCorreccion({ sr: t1, nuevaFinal: 1150, rollover: false, diaria: d, siguiente: null, precios: {} });
    assert.equal(p.ok, false);
  });
}

test('recalcularArqueo: nuevo esperado, mismo declarado', () => {
  const r = recalcularArqueo({ cashFund: 2000, cash: 7000, card: 0, credits: 0, partialDrops: 0 }, 5107.5);
  assert.deepEqual(r, { expectedSales: 5107.5, expected: 7107.5, declared: 7000, difference: -107.5, status: 'con_diferencia' });
});
