// Paridad: la copia CommonJS (functions/preciosOficiales.js) y el original
// (lib/preciosOficiales.ts) deben dar exactamente lo mismo.
// Requiere node --experimental-strip-types (ver "test" en package.json).
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";
import {createRequire} from "node:module";
import * as original from "../../lib/preciosOficiales.ts";

const copia = createRequire(import.meta.url)("../preciosOficiales.js");
const dirFx = new URL("../../lib/__fixtures__/", import.meta.url);
const P = "<p>A partir del lunes 23 de noviembre. ";
const casos = [
  ...readdirSync(dirFx).filter((f) => f.endsWith(".html"))
      .map((f) => [f, readFileSync(new URL(f, dirFx), "utf-8")]),
  ["pasa de/a", P + "En Tegucigalpa la súper pasa de L142.91 a L137.43, la regular de L128.05 a L122.81 y el diésel de L153.53 hasta L152.70.</p>"],
  ["antes", P + "En Tegucigalpa la súper, que antes costaba L142.91, ahora queda en L137.43.</p>"],
  ["glp", P + "En Tegucigalpa el GLP vehicular costará L63.08 y la súper sube L65.00.</p>"],
  ["centavos", "<p>En Tegucigalpa la súper costará 130 lempiras con 5 centavos, la regular 120 lempiras y 40 centavos y el diésel L150.00.</p>"],
  ["ambiguo", P + "En Tegucigalpa la súper L142.91 L137.43 sin contexto.</p>"],
  ["tabla", "<p>Vigentes desde el 23 de noviembre de 2026.</p><table><tr><th>Producto</th><th>San Pedro Sula</th><th>Tegucigalpa</th></tr><tr><td>Súper</td><td>L132.24</td><td>L137.43</td></tr><tr><td>Regular</td><td>L117.63</td><td>L122.81</td></tr><tr><td>Diésel</td><td>L147.44</td><td>L152.70</td></tr></table>"],
  ["tabla sin tgu", "<table><tr><th>Producto</th><th>SPS</th></tr><tr><td>Súper</td><td>132.24</td></tr></table>"],
  ["tabla ajena", "<table><tr><td>Publicidad</td></tr></table><p>En Tegucigalpa la súper costará L137.43, la regular L122.81 y el diésel L152.70.</p>"],
  ["vacío", "<p>Nada que ver</p>"],
];

for (const [nombre, html] of casos) {
  test(`paridad extraerPrecios: ${nombre}`, () => {
    for (const [anio, mes] of [[2026, 11], [2026, 12]]) {
      assert.deepEqual(copia.extraerPrecios(html, anio, mes),
          original.extraerPrecios(html, anio, mes));
    }
    assert.equal(copia.textoPlano(html), original.textoPlano(html));
  });
}

test("paridad: año nuevo, porLitro, diferencias, títulos, constantes", () => {
  const h = "<p>Rigen a partir del lunes 4 de enero.</p>";
  assert.deepEqual(copia.extraerPrecios(h, 2026, 12), original.extraerPrecios(h, 2026, 12));
  for (const g of [80, 122.81, 137.43, 152.7, 250]) assert.equal(copia.porLitro(g), original.porLitro(g));
  const [a, b] = casos.slice(0, 2).map(([, x]) => original.extraerPrecios(x, 2026, 11));
  assert.deepEqual(copia.diferencias(a, b), original.diferencias(a, b));
  assert.equal(copia.notaCompleta(a), original.notaCompleta(a));
  for (const t of ["Gasolinas bajan", "Combustibles en Chile", "Precio del café"]) {
    assert.equal(copia.esNotaDePrecios(t), original.esNotaDePrecios(t));
  }
  assert.deepEqual(copia.PRODUCTOS_OFICIALES, original.PRODUCTOS_OFICIALES);
});
