import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCuadro, cuadroAoa } from './totalizadores.ts';
import type { DailyReading, Dispenser, Pump } from '../types';

const disp = (pumpId: string, face: string, n: number, fuel: string, status: Dispenser['status'] = 'activo'): Dispenser => ({
  id: `${pumpId}-${face}-${n}`, name: `Manguera ${n}`, face, pumpId, pumpName: pumpId === 'p1' ? 'Bomba 01' : 'Bomba 02',
  fuel, fuelName: fuel, fuelColor: '#000', status,
});
const pump = (id: string, name: string, dispensers: Dispenser[][]): Pump => ({
  id, name, isActive: true, fuel: { id: 'diesel', name: 'diesel', color: '#000', price: 0 },
  faces: dispensers.map((d, i) => ({ id: i === 0 ? 'A' : 'B', dispensers: d })),
});
const reading = (dispenserId: string, fuelId: string, initialReading: number, finalReading?: number, fuelPrice = 0): DailyReading => ({
  date: '2026-04-27', dispenserId, dispenserName: '', face: '', pumpId: '', pumpName: '', fuelId, fuelName: fuelId,
  fuelPrice, initialReading, finalReading, status: 'activo',
});
const PRECIOS = { diesel: 34.05, super: 37.76, regular: 37.06 };

test('litros = final - inicial y total = litros × precio por litro', () => {
  const pumps = [pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'diesel')]])];
  const c = buildCuadro(pumps, [reading('p1-A-1', 'diesel', 751432.037, 751844.537)], PRECIOS);
  const f = c.grupos[0].filas[0];
  assert.equal(f.estado, 'ok');
  assert.equal(f.litros, 412.5);
  assert.equal(f.precio, 34.05);
  assert.equal(f.total, 14045.63);
  assert.equal(c.total, 14045.63);
  assert.equal(f.label, '1-1');
});

test('lectura final pendiente no suma ni da negativo (error del cuadro original)', () => {
  const pumps = [pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'diesel'), disp('p1', 'A', 2, 'super')]])];
  const c = buildCuadro(pumps, [reading('p1-A-1', 'diesel', 751432.037), reading('p1-A-2', 'super', 100, 110)], PRECIOS);
  assert.equal(c.grupos[0].filas[0].estado, 'pendiente');
  assert.equal(c.grupos[0].filas[0].total, 0);
  assert.equal(c.pendientes, 1);
  assert.equal(c.total, 377.6);
  assert.ok(c.total >= 0);
});

test('final menor que inicial se marca inválida y se excluye', () => {
  const pumps = [pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'diesel')]])];
  const c = buildCuadro(pumps, [reading('p1-A-1', 'diesel', 500, 400)], PRECIOS);
  assert.equal(c.grupos[0].filas[0].estado, 'invalida');
  assert.equal(c.invalidas, 1);
  assert.equal(c.total, 0);
});

test('sin lectura inicial, mantenimiento e inactivo', () => {
  const pumps = [pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'diesel'), disp('p1', 'A', 2, 'super', 'mantenimiento'), disp('p1', 'A', 3, 'regular', 'inactivo')]])];
  const c = buildCuadro(pumps, [], PRECIOS);
  assert.deepEqual(c.grupos[0].filas.map(f => f.estado), ['sin_inicial', 'mantenimiento']);
  assert.equal(c.sinInicial, 1);
});

test('precio de la lectura manda sobre el vigente; orden cara/manguera y por bomba', () => {
  const pumps = [
    pump('p2', 'Bomba 02', [[disp('p2', 'A', 2, 'super'), disp('p2', 'A', 1, 'diesel')], [disp('p2', 'B', 1, 'diesel')]]),
    pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'diesel')]]),
  ];
  const c = buildCuadro(pumps, [reading('p2-A-2', 'super', 0, 10, 40)], PRECIOS);
  assert.deepEqual(c.grupos.map(g => g.pumpName), ['Bomba 01', 'Bomba 02']);
  assert.deepEqual(c.grupos[1].filas.map(f => f.label), ['1-1', '1-2', '2-1']);
  assert.equal(c.grupos[1].filas[1].precio, 40);
  assert.equal(c.productos.find(p => p.fuelId === 'super')?.total, 400);
});

test('exportación en layout de Tito', () => {
  const pumps = [pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'diesel')]])];
  const c = buildCuadro(pumps, [reading('p1-A-1', 'diesel', 0, 10)], PRECIOS);
  const aoa = cuadroAoa(c, { fecha: '27/04/2026', responsable: 'ARIEL', fondoCambio: 1500 });
  assert.deepEqual(aoa[0], ['27/04/2026', 'ARIEL', '', 'CAMBIO', 1500, '']);
  assert.deepEqual(aoa[1], ['MANGUERA', 'LECTURA INICIAL', 'LECTURA FINAL', 'LITROS', 'PRECIO', 'TOTAL LPS']);
  assert.deepEqual(aoa.at(-1), ['', '', '', '', 'TOTAL EN CAJA', 1840.5]);
});

test('lecturas duplicadas: manda la primera; bomba inactiva sin lectura va como mantenimiento', () => {
  const pumps = [pump('p1', 'Bomba 01', [[disp('p1', 'A', 1, 'diesel')]]), { ...pump('p2', 'Bomba 02', [[disp('p2', 'A', 1, 'diesel')]]), isActive: false }];
  const c = buildCuadro(pumps, [reading('p1-A-1', 'diesel', 0, 10), reading('p1-A-1', 'diesel', 0, 99)], PRECIOS);
  assert.equal(c.grupos[0].filas[0].litros, 10);
  assert.equal(c.grupos[1].filas[0].estado, 'mantenimiento');
  assert.equal(c.total, 340.5);
  assert.equal(c.sinInicial + c.pendientes + c.invalidas, 0);
});
