import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesesHasta, nombreMes, rangoDias, rangoMes, totalesPorGrupo, ventasPorDia } from './reportes.ts';
import { idLectura } from './totalizadores.ts';
import type { DailyReading } from '../types';

const PRECIOS = { super: 37.42, regular: 32.84, diesel: 40.05 };
const L = (date: string, disp: string, fuelId: string, ini: number, fin: number | undefined, fuelPrice: number, over: Partial<DailyReading> = {}): DailyReading => ({
  id: idLectura(date, disp), date, dispenserId: disp, dispenserName: 'Manguera 1', face: 'A', pumpId: disp.split('-')[0],
  pumpName: disp.startsWith('p1') ? 'Bomba 01' : 'Bomba 02', fuelId, fuelName: fuelId, fuelPrice,
  initialReading: ini, finalReading: fin, status: 'activo', ...over,
});

test('rangoDias: 14 días que terminan hoy, cruzando mes', () => {
  const d = rangoDias('2026-12-03', 14);
  assert.equal(d.length, 14);
  assert.equal(d[0], '2026-11-20');
  assert.equal(d[13], '2026-12-03');
});

test('ventasPorDia: calcVenta con el precio de la lectura, una por dispensador, pendientes aparte', () => {
  const r = [
    L('2026-11-20', 'p1-A-1', 'regular', 100, 200, 30),
    L('2026-11-20', 'p1-A-2', 'super', 0, 10.5, 40),
    L('2026-11-20', 'p1-A-1', 'regular', 100, 999, 30, { id: 'viejo-aleatorio' }), // duplicada: manda la determinista
    L('2026-11-21', 'p1-A-1', 'regular', 200, undefined, 30),
    L('2026-11-21', 'p2-A-1', 'diesel', 0, 0, 0, { status: 'mantenimiento' }),
  ];
  const v = ventasPorDia(r, ['2026-11-19', '2026-11-20', '2026-11-21'], PRECIOS);
  assert.deepEqual(v[0], { fecha: '2026-11-19', litros: 0, total: 0, pendientes: 0, lecturas: 0 });
  assert.deepEqual(v[1], { fecha: '2026-11-20', litros: 110.5, total: 3420, pendientes: 0, lecturas: 2 });
  assert.deepEqual(v[2], { fecha: '2026-11-21', litros: 0, total: 0, pendientes: 1, lecturas: 2 });
});

test('ventasPorDia: sin fuelPrice usa el vigente como respaldo', () => {
  const v = ventasPorDia([L('2026-11-20', 'p1-A-1', 'regular', 0, 100, 0)], ['2026-11-20'], PRECIOS);
  assert.equal(v[0].total, 3284);
});

test('totalesPorGrupo: por bomba y por producto desde la lectura (no desde la config)', () => {
  const r = [
    L('2026-11-01', 'p1-A-1', 'regular', 0, 100, 30),
    L('2026-11-02', 'p1-A-1', 'regular', 100, 150, 31),
    L('2026-11-02', 'p2-A-1', 'diesel', 0, 10, 40),
    L('2026-11-02', 'p2-A-2', 'diesel', 0, undefined, 40),
  ];
  const t = totalesPorGrupo(r, PRECIOS);
  assert.deepEqual(t.bombas, [
    { id: 'p1', nombre: 'Bomba 01', litros: 150, total: 4550 },
    { id: 'p2', nombre: 'Bomba 02', litros: 10, total: 400 },
  ]);
  assert.deepEqual(t.productos.map(p => [p.id, p.litros, p.total]), [['diesel', 10, 400], ['regular', 150, 4550]]);
  assert.equal(t.total, 4950);
  assert.equal(t.litros, 160);
});

test('rangoMes / mesesHasta / nombreMes', () => {
  assert.deepEqual({ ...rangoMes('2028-02'), dias: rangoMes('2028-02').dias.length }, { desde: '2028-02-01', hasta: '2028-02-29', dias: 29 });
  assert.deepEqual(mesesHasta('2026-01', 3), ['2026-01', '2025-12', '2025-11']);
  assert.equal(nombreMes('2026-11'), 'Noviembre 2026');
});
