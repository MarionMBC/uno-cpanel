import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCuadro, calcVenta, filasLecturaFinal, finalAnterior, idLectura, lecturasPorDispensador, litrosEntre, LITROS_MAX_DIA,
  METER_MAX_DEFAULT, rompeContinuidad, sumarVentas,
} from './totalizadores.ts';
import type { DailyReading, Dispenser, Pump } from '../types';

const round2 = (n: number) => Math.round(n * 100) / 100;

const PRECIOS = { diesel: 34.05, super: 37.76, regular: 37.06 };

const lectura = (over: Partial<DailyReading> = {}): DailyReading => ({
  date: '2026-11-20', dispenserId: 'p1-A-1', dispenserName: 'Manguera 1', face: 'A', pumpId: 'p1', pumpName: 'Bomba 01',
  fuelId: 'regular', fuelName: 'Regular', fuelPrice: 0, initialReading: 100, status: 'activo', ...over,
});

const disp = (pumpId: string, face: string, n: number, fuel: string, status: Dispenser['status'] = 'activo'): Dispenser => ({
  id: `${pumpId}-${face}-${n}`, name: `Manguera ${n}`, face, pumpId, pumpName: pumpId === 'p1' ? 'Bomba 01' : 'Bomba 02',
  fuel, fuelName: fuel, fuelColor: '#000', status,
});
const pump = (id: string, name: string, dispensers: Dispenser[][], isActive = true): Pump => ({
  id, name, isActive, fuel: { id: 'diesel', name: 'diesel', color: '#000', price: 0 },
  faces: dispensers.map((d, i) => ({ id: i === 0 ? 'A' : 'B', dispensers: d })),
});

// ─── calcVenta (A4) ───
test('calcVenta: litros × precio de la lectura, redondeo round del cuadro', () => {
  const v = calcVenta(lectura({ fuelId: 'diesel', initialReading: 751432.037, finalReading: 751844.537, fuelPrice: 34.05 }), PRECIOS);
  assert.deepEqual(v, { estado: 'ok', litros: 412.5, precio: 34.05, total: 14045.63 });
});

test('calcVenta: precio de la lectura manda; el vigente solo si falta', () => {
  assert.equal(calcVenta(lectura({ finalReading: 110, fuelPrice: 40 }), PRECIOS).total, 400);
  assert.equal(calcVenta(lectura({ finalReading: 110, fuelPrice: 0 }), PRECIOS).total, 370.6);
});

test('calcVenta: pendiente, mantenimiento e inválida no suman', () => {
  assert.equal(calcVenta(lectura(), PRECIOS).estado, 'pendiente');
  assert.equal(calcVenta(lectura({ status: 'mantenimiento', finalReading: 500 }), PRECIOS).total, 0);
  const inv = calcVenta(lectura({ finalReading: 50 }), PRECIOS);
  assert.equal(inv.estado, 'invalida');
  assert.equal(inv.total, 0);
});

test('calcVenta: mismo total que el cuadro al centavo', () => {
  const r = lectura({ id: idLectura('2026-11-20', 'p1-A-1'), initialReading: 1000.123, finalReading: 1333.456, fuelPrice: 37.06 });
  const c = buildCuadro([pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'regular')]])], [r], PRECIOS);
  assert.equal(c.total, calcVenta(r, PRECIOS).total);
});

// ─── Rollover (A7) ───
test('rollover: litros = final + (meterMax + 0.001) − inicial, exacto (módulo 1 000 000)', () => {
  assert.equal(METER_MAX_DEFAULT, 999999.999);
  assert.equal(litrosEntre(999850, 120, true), 270);
  // Un solo paso del contador: 999999.999 → 000000.000 es 0.001 L.
  assert.equal(litrosEntre(999999.999, 0, true), 0.001);
  assert.equal(litrosEntre(999999.5, 0.5, true), 1);
  // Equivale a (final − inicial) mod 1 000 000.
  assert.equal(litrosEntre(999850.123, 120.456, true), 270.333);
});

test('rollover: sin vuelta real (final ≥ inicial) o inicial > máximo es inválido', () => {
  assert.equal(litrosEntre(100, 200, true), null);
  assert.equal(litrosEntre(1000001, 5, true, 999999.999), null);
  assert.equal(litrosEntre(999850, 120, false), null);
});

test('rollover: calcVenta y cuadro respetan el flag', () => {
  const r = lectura({ initialReading: 999850, finalReading: 120, rollover: true, fuelPrice: 37.06 });
  assert.deepEqual(calcVenta(r, PRECIOS), { estado: 'ok', litros: 270, precio: 37.06, total: 10006.2 });
  const c = buildCuadro([pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'regular')]])], [r], PRECIOS);
  assert.equal(c.grupos[0].filas[0].estado, 'ok');
  assert.equal(c.grupos[0].filas[0].rollover, true);
  assert.equal(c.total, 10006.2);
  assert.equal(c.invalidas, 0);
});

// ─── ID determinista y compatibilidad (A3) ───
test('idLectura y lecturas viejas con ID aleatorio', () => {
  assert.equal(idLectura('2026-11-21', 'p1-A-1'), '2026-11-21_p1-A-1');
  const vieja = lectura({ id: 'xYz123', date: '2026-11-21', finalReading: 99 });
  const vieja2 = lectura({ id: 'aaa', date: '2026-11-21', finalReading: 77 });
  assert.equal(lecturasPorDispensador([vieja, vieja2]).get('p1-A-1')?.id, 'xYz123');
  const nueva = lectura({ id: '2026-11-21_p1-A-1', date: '2026-11-21' });
  assert.equal(lecturasPorDispensador([vieja, nueva]).get('p1-A-1')?.id, '2026-11-21_p1-A-1');
});

// ─── Continuidad (A8) ───
test('finalAnterior: última final de fecha previa del mismo dispensador', () => {
  const rs = [
    lectura({ date: '2026-11-18', finalReading: 150000 }),
    lectura({ date: '2026-11-20', finalReading: 152300 }),
    lectura({ date: '2026-11-19', finalReading: 151000 }),
    lectura({ date: '2026-11-21', finalReading: 160000 }), // mismo día: no cuenta
    lectura({ date: '2026-11-20', dispenserId: 'p1-A-2', finalReading: 5 }),
  ];
  assert.deepEqual(finalAnterior(rs, 'p1-A-1', '2026-11-21'), { fecha: '2026-11-20', valor: 152300 });
});

test('finalAnterior: ignora mantenimiento y sin final; null si no hay', () => {
  const rs = [
    lectura({ date: '2026-11-19', finalReading: 151000 }),
    lectura({ date: '2026-11-20', status: 'mantenimiento', finalReading: 0 }),
    lectura({ date: '2026-11-20', dispenserId: 'p1-A-1' }),
  ];
  assert.deepEqual(finalAnterior(rs, 'p1-A-1', '2026-11-21'), { fecha: '2026-11-19', valor: 151000 });
  assert.equal(finalAnterior(rs, 'p9', '2026-11-21'), null);
});

test('rompeContinuidad: solo si se conoce la anterior y difiere', () => {
  assert.equal(rompeContinuidad(152420, 152300), true);
  assert.equal(rompeContinuidad(152300, 152300), false);
  assert.equal(rompeContinuidad(152300.0004, 152300), false);
  assert.equal(rompeContinuidad(152300, null), false);
});

test('cuadro marca la ruptura de continuidad', () => {
  const r = lectura({ initialReading: 152420, finalReading: 152500, continuityBreak: true, previousFinal: 152300 });
  const c = buildCuadro([pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'regular')]])], [r], PRECIOS);
  assert.equal(c.grupos[0].filas[0].continuityBreak, true);
});

// ─── Cuadro histórico (A10 / TASK-015) ───
test('histórico: bomba inactiva hoy no oculta ventas pasadas', () => {
  const pumps = [pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'regular')]]), pump('p2', 'Bomba 02', [[disp('p2', 'A', 1, 'regular', 'inactivo')]], false)];
  const rs = [
    lectura({ dispenserId: 'p1-A-1', initialReading: 0, finalReading: 10, fuelPrice: 37.06 }),
    lectura({ dispenserId: 'p2-A-1', pumpId: 'p2', pumpName: 'Bomba 02', initialReading: 0, finalReading: 5, fuelPrice: 37.06 }),
  ];
  const hoy = buildCuadro(pumps, rs, PRECIOS);
  // Con lectura del día manda la lectura, aunque la bomba esté inactiva hoy (TASK-009).
  assert.equal(hoy.grupos[1].filas[0].estado, 'ok');
  assert.equal(hoy.total, 555.9);
  const pasado = buildCuadro(pumps, rs, PRECIOS, { historico: true });
  assert.deepEqual(pasado.grupos.map(g => g.pumpName), ['Bomba 01', 'Bomba 02']);
  assert.equal(pasado.grupos[1].filas[0].estado, 'ok');
  assert.equal(pasado.total, 555.9);
});

test('histórico: dispensador que ya no existe sale desde la lectura (cara/manguera de la lectura)', () => {
  const rs = [lectura({ dispenserId: 'p3-B-2', dispenserName: 'Manguera 2', face: 'B', pumpId: 'p3', pumpName: 'Bomba 03', fuelId: 'super', fuelName: 'Súper', initialReading: 0, finalReading: 10, fuelPrice: 40 })];
  const c = buildCuadro([pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'regular')]])], rs, PRECIOS, { historico: true });
  assert.equal(c.grupos.length, 1);
  const f = c.grupos[0].filas[0];
  assert.equal(f.pumpName, 'Bomba 03');
  assert.equal(f.label, '2-2');
  assert.equal(f.total, 400);
  assert.equal(c.sinInicial, 0);
});

test('hoy: lectura de un dispensador borrado sigue sumando', () => {
  const rs = [lectura({ dispenserId: 'p9-A-1', pumpId: 'p9', pumpName: 'Bomba 09', initialReading: 0, finalReading: 1, fuelPrice: 10 })];
  const c = buildCuadro([pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'regular')]])], rs, PRECIOS);
  assert.equal(c.total, 10);
  assert.equal(c.grupos.at(-1)?.pumpName, 'Bomba 09');
});

test('lecturas sin dispensador no aparecen en el cuadro', () => {
  const m = lecturasPorDispensador([{ id: 'x', date: '2026-11-21', dispenserId: '' } as never, { id: 'y', date: '2026-11-21', dispenserId: 'p1-A-1' } as never]);
  assert.equal(m.size, 1);
});

// ─── Tope de plausibilidad (A7 / TASK-012 review) ───
test('tope: más de LITROS_MAX_DIA en una manguera es inválida (motivo tope)', () => {
  assert.equal(LITROS_MAX_DIA, 20000);
  // Final menor digitada por error + "vuelta a cero" → ~999 900 L: se bloquea.
  const v = calcVenta(lectura({ initialReading: 500, finalReading: 400, rollover: true, fuelPrice: 37.06 }), PRECIOS);
  assert.equal(v.estado, 'invalida');
  assert.equal(v.motivo, 'tope');
  assert.equal(v.total, 0);
  assert.equal(calcVenta(lectura({ initialReading: 0, finalReading: 20000.001, fuelPrice: 1 }), PRECIOS).motivo, 'tope');
  assert.equal(calcVenta(lectura({ initialReading: 0, finalReading: 20000, fuelPrice: 1 }), PRECIOS).estado, 'ok');
  assert.equal(calcVenta(lectura({ finalReading: 50 }), PRECIOS).motivo, 'menor');
  const c = buildCuadro([pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'regular')]])], [lectura({ initialReading: 500, finalReading: 400, rollover: true })], PRECIOS);
  assert.equal(c.invalidas, 1);
  assert.equal(c.total, 0);
});

// ─── Mismo total en Cuadro, Lectura final y Dashboard (TASK-009 review) ───
test('bomba desactivada / dispensador borrado con final guardada: mismo total en las 3 vistas', () => {
  const pumps = [
    pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'regular'), disp('p1', 'A', 2, 'super', 'mantenimiento')]]),
    pump('p2', 'Bomba 02', [[disp('p2', 'A', 1, 'regular'), disp('p2', 'A', 2, 'diesel', 'inactivo')]], false),
  ];
  const rs = [
    lectura({ id: idLectura('2026-11-20', 'p1-A-1'), dispenserId: 'p1-A-1', initialReading: 0, finalReading: 10, fuelPrice: 37.06 }),
    // Dispensador pasado a mantenimiento después de guardar la final.
    lectura({ id: idLectura('2026-11-20', 'p1-A-2'), dispenserId: 'p1-A-2', fuelId: 'super', initialReading: 0, finalReading: 4, fuelPrice: 37.76 }),
    // Bomba desactivada después de guardar la final.
    lectura({ id: idLectura('2026-11-20', 'p2-A-1'), dispenserId: 'p2-A-1', pumpId: 'p2', pumpName: 'Bomba 02', initialReading: 10, finalReading: 20, fuelPrice: 100 }),
    // Dispensador inactivo con lectura.
    lectura({ id: idLectura('2026-11-20', 'p2-A-2'), dispenserId: 'p2-A-2', pumpId: 'p2', pumpName: 'Bomba 02', fuelId: 'diesel', initialReading: 0, finalReading: 2, fuelPrice: 34.05 }),
    // Dispensador borrado de la configuración.
    lectura({ id: idLectura('2026-11-20', 'p9-B-1'), dispenserId: 'p9-B-1', pumpId: 'p9', pumpName: 'Bomba 09', face: 'B', initialReading: 0, finalReading: 1, fuelPrice: 50 }),
  ];
  const esperado = { litros: 27, total: round2(370.6 + 151.04 + 1000 + 68.1 + 50) };

  const cuadro = buildCuadro(pumps, rs, PRECIOS);
  assert.deepEqual({ litros: cuadro.litros, total: cuadro.total }, esperado);

  // Lectura final: filas = operables ∪ con lectura de hoy; total = sumarVentas de sus lecturas.
  const filas = filasLecturaFinal(pumps, rs);
  assert.deepEqual(filas.map(f => f.id).sort(), ['p1-A-1', 'p1-A-2', 'p2-A-1', 'p2-A-2', 'p9-B-1']);
  const porDisp = lecturasPorDispensador(rs);
  const final = sumarVentas(filas.map(f => porDisp.get(f.id)).filter((r): r is DailyReading => !!r), PRECIOS);
  assert.deepEqual(final, esperado);

  // Dashboard: sumarVentas de una lectura por dispensador.
  assert.deepEqual(sumarVentas(porDisp.values(), PRECIOS), esperado);
});

test('filasLecturaFinal: sin lectura, solo operables (bomba activa y dispensador no inactivo)', () => {
  const pumps = [
    pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'regular'), disp('p1', 'A', 2, 'super', 'inactivo'), disp('p1', 'A', 3, 'diesel', 'mantenimiento')]]),
    pump('p2', 'Bomba 02', [[disp('p2', 'A', 1, 'regular')]], false),
  ];
  assert.deepEqual(filasLecturaFinal(pumps, []).map(f => f.id), ['p1-A-1', 'p1-A-3']);
});
