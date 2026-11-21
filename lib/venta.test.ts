import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCuadro, calcVenta, finalAnterior, idLectura, lecturasPorDispensador, litrosEntre, METER_MAX_DEFAULT, rompeContinuidad,
} from './totalizadores.ts';
import type { DailyReading, Dispenser, Pump } from '../types';

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
test('rollover: litros = final + meterMax − inicial', () => {
  assert.equal(litrosEntre(999850, 120, true), 269.999);
  assert.equal(litrosEntre(999850, 120, true, 1000000), 270);
  assert.equal(METER_MAX_DEFAULT, 999999.999);
});

test('rollover: sin vuelta real (final ≥ inicial) o inicial > máximo es inválido', () => {
  assert.equal(litrosEntre(100, 200, true), null);
  assert.equal(litrosEntre(1000001, 5, true, 999999.999), null);
  assert.equal(litrosEntre(999850, 120, false), null);
});

test('rollover: calcVenta y cuadro respetan el flag', () => {
  const r = lectura({ initialReading: 999850, finalReading: 120, rollover: true, meterMax: 1000000, fuelPrice: 37.06 });
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
  assert.equal(hoy.grupos[1].filas[0].estado, 'mantenimiento');
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
