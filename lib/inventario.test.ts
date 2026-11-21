import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuadreTanque } from './calibracion.ts';
import {
  totalPipas, recibidoTanque, fueraDeUmbral, cuadreParaGuardar, diaAnterior, comparaApertura,
  fusionarBorrador, lecturasAbiertas, abiertasDeBomba, abiertaDeDispensador,
} from './inventario.ts';

const pipas = [
  { fuelId: 'super', gallons: 1000, amount: 3785.41 },
  { fuelId: 'super', gallons: 2500.5, amount: 9465.42, voided: true },
  { fuelId: 'super', amount: 3785.41 }, // legado en litros = 1000 gal
  { fuelId: 'diesel', gallons: 300, amount: 1135.62 },
];

test('A11b total recibido = suma de pipas no anuladas, por producto', () => {
  assert.equal(Math.round(totalPipas(pipas, 'super') * 100) / 100, 2000);
  assert.equal(totalPipas(pipas, 'diesel'), 300);
  assert.equal(totalPipas(pipas, 'regular'), 0);
  assert.equal(totalPipas(undefined, 'super'), 0);
});

test('A11b recibido: con pipas manda la suma; sin pipas el agregado o el legado', () => {
  // refueledGallons desfasado (incluye la anulada): se ignora porque hay pipas del producto.
  assert.equal(Math.round(recibidoTanque(pipas, 'super', { refueledGallons: 4500.5 })), 2000);
  // todas anuladas → 0, aunque el agregado diga otra cosa
  assert.equal(recibidoTanque([{ fuelId: 'regular', gallons: 50, amount: 1, voided: true }], 'regular', { refueledGallons: 50 }), 0);
  assert.equal(recibidoTanque([], 'regular', { refueledGallons: 75 }), 75);
  assert.equal(Math.round(recibidoTanque(undefined, 'regular', { refueledAmount: 3785.41 })), 1000);
});

test('A11d cuadre guardado con alerta por umbral 0,5 %', () => {
  const c = cuadreTanque({ inicialGal: 3000, recibidoGal: 1000, vendidoL: 500 * 3.78541, finalGal: 3490 }); // −2 %
  const g = cuadreParaGuardar(c, { provisional: true, savedAt: '2026-11-21T20:00:00.000Z', savedBy: 'Ana' });
  assert.equal(g.diferenciaGal, -10);
  assert.equal(g.diferenciaL, -37.85);
  assert.equal(g.porcentaje, -2);
  assert.equal(g.alerta, true);
  assert.equal(g.provisional, true);
  assert.equal(g.savedBy, 'Ana');
  const ok = cuadreParaGuardar(cuadreTanque({ inicialGal: 3000, recibidoGal: 0, vendidoL: 1000 * 3.78541, finalGal: 1998 }), { provisional: false, savedAt: 'x', savedBy: 'y' });
  assert.equal(ok.porcentaje, -0.2);
  assert.equal(ok.alerta, false);
});

test('umbral: límite exacto no alerta, sin ventas no alerta', () => {
  assert.equal(fueraDeUmbral(0.5), false);
  assert.equal(fueraDeUmbral(-0.51), true);
  assert.equal(fueraDeUmbral(null), false);
});

test('A11c día anterior y comparación con la final de ayer', () => {
  assert.equal(diaAnterior('2026-11-21'), '2026-11-20');
  assert.equal(diaAnterior('2026-03-01'), '2026-02-28');
  assert.equal(diaAnterior('2028-03-01'), '2028-02-29');
  assert.equal(diaAnterior('2027-01-01'), '2026-12-31');
  assert.deepEqual(comparaApertura(3362, 3362), { difiere: false, diferenciaGal: 0 });
  assert.deepEqual(comparaApertura(3370, 3362), { difiere: true, diferenciaGal: 8 });
  assert.deepEqual(comparaApertura(null, 3362), { difiere: false, diferenciaGal: null });
});

test('A11e snapshot no pisa lo digitado', () => {
  const local = { super: '40.5', regular: '', diesel: '12' };
  const servidor = { super: '38', regular: '2800', diesel: '10' };
  assert.deepEqual(fusionarBorrador(local, servidor, new Set(['super', 'diesel'] as const)), { super: '40.5', regular: '2800', diesel: '12' });
  assert.deepEqual(fusionarBorrador(local, servidor, new Set()), servidor);
});

test('A10 lecturas abiertas por bomba y dispensador', () => {
  const r = [
    { dispenserId: 'p1-A-1', pumpId: 'p1', status: 'activo' },
    { dispenserId: 'p1-A-2', pumpId: 'p1', status: 'activo', finalReading: 100 },
    { dispenserId: 'p2-A-1', pumpId: 'p2', status: 'mantenimiento' },
    { dispenserId: 'p2-B-1', pumpId: 'p2', status: 'activo', finalReading: null },
  ];
  assert.equal(lecturasAbiertas(r).length, 2);
  assert.equal(abiertasDeBomba(r, 'p1').length, 1);
  assert.equal(abiertasDeBomba(r, 'p3').length, 0);
  assert.equal(abiertaDeDispensador(r, 'p1-A-1'), true);
  assert.equal(abiertaDeDispensador(r, 'p1-A-2'), false);
  assert.equal(abiertaDeDispensador(r, 'p2-A-1'), false);
  assert.equal(abiertaDeDispensador(r, 'p2-B-1'), true);
});
