import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABLAS, ANOMALIAS, esAnomalia, galonesDesdePulgadas, cuadreTanque, maxPulgadas } from './calibracion.ts';

test('tablas completas: pasos de 0.25 sin huecos hasta la capacidad', () => {
  for (const [id, t, max] of [['diesel', TABLAS.diesel, 71.5], ['super', TABLAS.super, 70.75]] as const) {
    assert.equal(maxPulgadas(t), max, id);
    assert.equal(t.puntos.length, max / 0.25 + 1, id); // + punto [0,0]
    t.puntos.forEach(([p], i) => assert.equal(p, i * 0.25, `${id} ${i}`));
    assert.equal(t.puntos.at(-1)?.[1], t.capacidad, id);
  }
});

test('monotonía: solo rompen la serie las anomalías conocidas de la hoja impresa', () => {
  for (const t of Object.values(TABLAS)) {
    t.puntos.forEach(([p, g], i) => {
      if (i === 0) return;
      const prev = t.puntos[i - 1];
      if (g <= prev[1]) assert.ok(esAnomalia(t.id, prev[0]) || esAnomalia(t.id, p), `${t.id} ${p}`);
    });
  }
  assert.equal(ANOMALIAS.length, 3);
});

test('CA1 valores exactos de la hoja', () => {
  assert.equal(galonesDesdePulgadas(TABLAS.diesel, 20), 1146);
  assert.equal(galonesDesdePulgadas(TABLAS.diesel, 50), 3740);
  assert.equal(galonesDesdePulgadas(TABLAS.diesel, 60.25), 4504);
  assert.equal(galonesDesdePulgadas(TABLAS.diesel, 71.5), 5016);
  assert.equal(galonesDesdePulgadas(TABLAS.super, 20), 1168);
  assert.equal(galonesDesdePulgadas(TABLAS.super, 50.25), 3822);
  assert.equal(galonesDesdePulgadas(TABLAS.super, 70.75), 5040);
  assert.equal(galonesDesdePulgadas(TABLAS.super, 0), 0);
});

test('CA2 interpolación y CA3 fuera de rango', () => {
  assert.equal(galonesDesdePulgadas(TABLAS.diesel, 20.1), 1154);
  assert.equal(galonesDesdePulgadas(TABLAS.super, 0.125), 1);
  assert.equal(galonesDesdePulgadas(TABLAS.diesel, 72), null);
  assert.equal(galonesDesdePulgadas(TABLAS.diesel, -1), null);
  assert.equal(galonesDesdePulgadas(TABLAS.diesel, Number.NaN), null);
});

test('cuadre: inicial + recibido − vendido vs medido', () => {
  // 3000 gal + 1000 recibidos − 1892.705 L (500 gal) = 3500 teórico; medido 3490 → faltan 10 gal (2 %)
  const c = cuadreTanque({ inicialGal: 3000, recibidoGal: 1000, vendidoL: 500 * 3.78541, finalGal: 3490 });
  assert.equal(c.vendidoGal, 500);
  assert.equal(c.teoricoGal, 3500);
  assert.equal(c.diferenciaGal, -10);
  assert.equal(c.diferenciaL, -37.85);
  assert.equal(c.porcentaje, -2);
  assert.equal(cuadreTanque({ inicialGal: 10, recibidoGal: 0, vendidoL: 0, finalGal: 10 }).porcentaje, null);
});
