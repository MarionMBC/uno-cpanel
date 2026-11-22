import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularVigencia, leerPrecio, ordenarPorVigencia, precioVigente, proximoPrecio, validarPrecios, vigenciaDe } from './precios.ts';

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
