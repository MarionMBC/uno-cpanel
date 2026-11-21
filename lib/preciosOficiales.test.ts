import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extraerPrecios, diferencias, notaCompleta, porLitro, esNotaDePrecios } from './preciosOficiales.ts';

const fx = (n: string) => readFileSync(new URL(`./__fixtures__/${n}.html`, import.meta.url), 'utf-8');

test('Once Noticias 23/11/2026 ("L137.43"): Tegucigalpa, no San Pedro Sula ni variaciones', () => {
  const p = extraerPrecios(fx('once-2026-11-23'), 2026);
  assert.deepEqual(p.porGalon, { super: 137.43, regular: 122.81, diesel: 152.7, kerosene: 140.8 });
  assert.equal(p.vigencia, '2026-11-23');
  assert.ok(notaCompleta(p));
});

test('Once Noticias 16/11/2026 ("142 lempiras y 91 centavos")', () => {
  const p = extraerPrecios(fx('once-2026-11-16'), 2026);
  assert.deepEqual(p.porGalon, { super: 142.91, regular: 128.05, diesel: 153.53, kerosene: 146.69 });
  assert.equal(p.vigencia, '2026-11-16');
});

test('HCH 16/11/2026 ("baja L4.99 y costará L142.91") coincide con Once Noticias', () => {
  const hch = extraerPrecios(fx('hch-2026-11-16'), 2026);
  assert.deepEqual(hch.porGalon, { super: 142.91, regular: 128.05, diesel: 153.53, kerosene: 146.69 });
  assert.equal(hch.vigencia, '2026-11-16');
  assert.deepEqual(diferencias(hch, extraerPrecios(fx('once-2026-11-16'), 2026)), []);
  assert.deepEqual(diferencias(hch, extraerPrecios(fx('once-2026-11-23'), 2026)), ['super', 'regular', 'diesel']);
});

test('sin datos → nulls; conversión a litro; filtro de títulos', () => {
  const p = extraerPrecios('<p>Nada que ver</p>', 2026);
  assert.equal(notaCompleta(p), false);
  assert.equal(porLitro(137.43), 36.31);
  assert.ok(esNotaDePrecios('¡Nueva rebaja en los combustibles! Gasolinas bajan casi cinco lempiras'));
  assert.ok(!esNotaDePrecios('Combustibles en Chile tendrán un tope hasta abril'));
});

test('centavos de un dígito: "con 5 centavos" = 0.05', () => {
  const p = extraerPrecios('<p>En Tegucigalpa la súper costará 130 lempiras con 5 centavos, la regular 120 lempiras y 40 centavos y el diésel L150.00.</p>', 2026);
  assert.equal(p.porGalon.super, 130.05);
  assert.equal(p.porGalon.regular, 120.4);
  assert.equal(p.porGalon.diesel, 150);
});

const T = (cuerpo: string) => extraerPrecios(`<p>A partir del lunes 23 de noviembre. ${cuerpo}</p>`, 2026).porGalon;

test('review r1: "pasa de X a Y", "antes", variaciones y rango', () => {
  assert.deepEqual(T('En Tegucigalpa la súper pasa de L142.91 a L137.43, la regular de L128.05 a L122.81 y el diésel de L153.53 hasta L152.70.'),
    { super: 137.43, regular: 122.81, diesel: 152.7, kerosene: null });
  assert.equal(T('En Tegucigalpa la súper, que antes costaba L142.91, ahora queda en L137.43.').super, 137.43);
  assert.equal(T('En Tegucigalpa la súper subió L85.00 y quedará en L137.43.').super, 137.43);
  assert.equal(T('En Tegucigalpa el GLP vehicular costará L63.08 y la súper sube L65.00.').super, null);
});

test('review r1: tabla con San Pedro Sula antes que Tegucigalpa se lee por columna', () => {
  const html = `<p>Vigentes desde el 23 de noviembre de 2026.</p><table>
    <tr><th>Producto</th><th>San Pedro Sula</th><th>Tegucigalpa</th></tr>
    <tr><td>Súper</td><td>L132.24</td><td>L137.43</td></tr>
    <tr><td>Regular</td><td>L117.63</td><td>L122.81</td></tr>
    <tr><td>Diésel</td><td>L147.44</td><td>L152.70</td></tr></table>`;
  const p = extraerPrecios(html, 2026);
  assert.deepEqual(p.porGalon, { super: 137.43, regular: 122.81, diesel: 152.7, kerosene: null });
  assert.equal(p.vigencia, '2026-11-23');
  const sinTgu = extraerPrecios('<table><tr><th>Producto</th><th>SPS</th></tr><tr><td>Súper</td><td>132.24</td></tr></table>', 2026);
  assert.equal(notaCompleta(sinTgu), false);
});

test('review r1: vigencia ignora la fecha de publicación', () => {
  const p = extraerPrecios('<p>Publicado el 20 de noviembre. Los precios rigen desde el 23 de noviembre.</p>', 2026);
  assert.equal(p.vigencia, '2026-11-23');
});
