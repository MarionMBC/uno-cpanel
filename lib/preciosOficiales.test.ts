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
