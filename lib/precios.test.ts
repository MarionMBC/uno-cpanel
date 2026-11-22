import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularVigencia, leerPrecio, ordenarPorVigencia, preciosAntesDe, preciosDeLectura, preciosVigentesEn, precioVigente, proximoPrecio, validarPrecios, vigenciaDe } from './precios.ts';
import { calcVenta } from './totalizadores.ts';

const P = (id: string, vigenteDesde: string | undefined, timestamp: number, superP = 37) =>
  ({ id, vigenteDesde, timestamp, super: superP, regular: 32, diesel: 40, date: '', registeredBy: 'x' });

test('vigenciaDe: entrada vieja sin vigenteDesde rige desde su timestamp', () => {
  assert.equal(vigenciaDe({ timestamp: Date.parse('2026-11-20T12:00:00Z') }), '2026-11-20T12:00:00.000Z');
  assert.equal(vigenciaDe({ vigenteDesde: '2026-11-23T06:00:00.000Z', timestamp: 1 }), '2026-11-23T06:00:00.000Z');
  assert.equal(vigenciaDe({}), '');
});

test('precioVigente: la de vigencia más reciente ya empezada; la futura no aplica todavía', () => {
  const h = [
    P('vieja', undefined, Date.parse('2026-11-16T12:00:00Z'), 36),
    P('hoy', '2026-11-21T14:00:00.000Z', Date.parse('2026-11-21T14:00:00Z'), 37),
    P('lunes', '2026-11-23T06:00:00.000Z', Date.parse('2026-11-21T15:00:00Z'), 38),
  ];
  assert.equal(precioVigente(h, '2026-11-21T13:59:00.000Z')?.id, 'vieja');
  assert.equal(precioVigente(h, '2026-11-22T10:00:00.000Z')?.id, 'hoy');
  assert.equal(precioVigente(h, '2026-11-23T06:00:00.000Z')?.id, 'lunes');
  assert.equal(proximoPrecio(h, '2026-11-22T10:00:00.000Z')?.id, 'lunes');
  assert.equal(proximoPrecio(h, '2026-11-24T00:00:00.000Z'), null);
  assert.equal(precioVigente(h, '2026-11-01T00:00:00.000Z'), null);
});

test('ordenarPorVigencia: desc por vigencia, no por fecha de registro', () => {
  const h = [P('a', '2026-11-23T06:00:00.000Z', 100), P('b', '2026-11-21T14:00:00.000Z', 200), P('c', '2026-11-23T06:00:00.000Z', 300)];
  assert.deepEqual(ordenarPorVigencia(h).map(x => x.id), ['c', 'a', 'b']);
});

test('calcularVigencia: ahora, mañana 00:00 HN y fecha futura', () => {
  const ahora = new Date('2026-11-21T23:30:00-06:00'); // ya es 22 en UTC
  assert.deepEqual(calcularVigencia('ahora', ahora), { iso: ahora.toISOString() });
  assert.deepEqual(calcularVigencia('manana', ahora), { iso: '2026-11-22T06:00:00.000Z' });
  assert.deepEqual(calcularVigencia('fecha', ahora, '2026-11-23', '06:00'), { iso: '2026-11-23T12:00:00.000Z' });
  assert.ok('error' in calcularVigencia('fecha', ahora, '2026-11-20', '06:00'));
  assert.ok('error' in calcularVigencia('fecha', ahora, ''));
});

test('leerPrecio / validarPrecios: > 0, tope, sin reemplazo silencioso, variación > 15 % pide confirmación', () => {
  assert.equal(leerPrecio('37,5'), 37.5);
  assert.equal(leerPrecio('abc'), null);
  const vig = { super: 37.42, regular: 32.84, diesel: 40.05 };
  const ok = validarPrecios({ super: '38.00', regular: '33', diesel: '40.05' }, vig);
  assert.deepEqual(ok.precios, { super: 38, regular: 33, diesel: 40.05 });
  assert.equal(ok.requiereConfirmacion, false);
  const malo = validarPrecios({ super: '0', regular: '-5', diesel: 'x' }, vig);
  assert.equal(malo.precios, null);
  assert.deepEqual(Object.keys(malo.errores).sort(), ['diesel', 'regular', 'super']);
  assert.equal(validarPrecios({ super: '250', regular: '33', diesel: '40' }, vig).errores.super !== undefined, true);
  const salto = validarPrecios({ super: '44', regular: '33', diesel: '40' }, vig);
  assert.equal(salto.requiereConfirmacion, true);
  assert.ok((salto.variaciones.super ?? 0) > 15);
  // Exactamente 15 % no pide confirmación.
  assert.equal(validarPrecios({ super: '115', regular: '33', diesel: '40' }, { super: 100, regular: 33, diesel: 40 }).requiereConfirmacion, false);
});

// ─── TASK-023: lecturas viejas sin fuelPrice al precio de su fecha ───
test('preciosDeLectura: vigente a la hora de creación o, sin hora, a las 00:00 HN de su día', () => {
  const h = [P('a', '2026-10-01T06:00:00.000Z', 1, 35), P('b', '2026-11-01T06:00:00.000Z', 2, 38)];
  assert.equal(preciosDeLectura(h, { date: '2026-10-15' })?.super, 35);
  assert.equal(preciosDeLectura(h, { date: '2026-11-15' })?.super, 38);
  // createdAt manda sobre la fecha (abierta el 31/10 a las 23:00 HN = 01/11 05:00Z, antes del cambio).
  assert.equal(preciosDeLectura(h, { date: '2026-10-31', createdAt: '2026-11-01T05:00:00.000Z' })?.super, 35);
  assert.equal(preciosDeLectura(h, { date: '2026-09-01' }), null); // antes del primer precio: el que use la app (vigente)
  assert.equal(preciosDeLectura(h, {}), null);
  assert.deepEqual(preciosVigentesEn(h, '2026-11-02T00:00:00.000Z'), { super: 38, regular: 32, diesel: 40 });
});

test('calcVenta con respaldo por fecha: la lectura vieja sin fuelPrice usa su precio; con fuelPrice no cambia', () => {
  const h = [P('a', '2026-10-01T06:00:00.000Z', 1, 35), P('b', '2026-11-01T06:00:00.000Z', 2, 38)];
  const resp = (r: { date?: string; createdAt?: string }) => preciosDeLectura(h, r) ?? { super: 99, regular: 99, diesel: 99 };
  const vieja = { date: '2026-10-15', fuelId: 'super', fuelPrice: 0, initialReading: 0, finalReading: 10, status: 'activo' as const };
  assert.equal(calcVenta(vieja, resp).total, 350);
  assert.equal(calcVenta(vieja, { super: 38 }).total, 380); // tabla fija (antes: precio de hoy)
  assert.equal(calcVenta({ ...vieja, fuelPrice: 36 }, resp).total, 360);
});

test('variación (alerta 15 %) contra el precio vigente en la fecha de la vigencia, no el de hoy', () => {
  // Hoy rige 35; ya está programado 42 desde el lunes. Un 44 para el martes varía 4.8 % contra 42 (no 25.7 % contra 35).
  const h = [P('a', '2026-11-01T06:00:00.000Z', 1, 35), P('b', '2026-11-23T06:00:00.000Z', 2, 42)];
  const base = preciosVigentesEn(h, '2026-11-24T06:00:00.000Z');
  assert.ok(base);
  const v = validarPrecios({ super: '44', regular: '32', diesel: '40' }, base);
  assert.equal(v.requiereConfirmacion, false);
  assert.equal(validarPrecios({ super: '44', regular: '32', diesel: '40' }, preciosVigentesEn(h, '2026-11-22T06:00:00.000Z') ?? base).requiereConfirmacion, true);
});

test('vigencia comparada como fecha: sin milisegundos rige desde el mismo instante', () => {
  const h = [P('a', '2026-10-01T06:00:00.000Z', 1, 35), P('b', '2026-11-01T06:00:00Z', 2, 38)];
  assert.equal(preciosDeLectura(h, { date: '2026-11-01' })?.super, 38); // 00:00 HN = 06:00Z
  assert.equal(precioVigente(h, '2026-11-01T05:59:59.999Z')?.id, 'a');
});

test('preciosDeLectura: createdAt lejos de su día (carga tardía) → 00:00 HN de su fecha', () => {
  const h = [P('a', '2026-10-01T06:00:00.000Z', 1, 35), P('b', '2026-11-01T06:00:00.000Z', 2, 38)];
  assert.equal(preciosDeLectura(h, { date: '2026-10-15', createdAt: '2026-11-10T15:00:00.000Z' })?.super, 35);
  assert.equal(preciosDeLectura(h, { date: '2026-10-31', createdAt: '2026-11-01T07:00:00.000Z' })?.super, 38); // ±1 día: manda createdAt
});

test('preciosAntesDe: excluye el precio que empieza justo en esa vigencia', () => {
  const h = [P('a', '2026-11-01T06:00:00.000Z', 1, 35), P('b', '2026-11-23T06:00:00.000Z', 2, 42)];
  assert.equal(preciosAntesDe(h, '2026-11-23T06:00:00.000Z')?.super, 35);
  assert.equal(preciosAntesDe(h, '2026-11-24T06:00:00.000Z')?.super, 42);
});
