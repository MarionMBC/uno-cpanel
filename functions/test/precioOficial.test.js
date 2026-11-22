"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const path = require("node:path");
const {
  debeEjecutar, lecturaDePosts, validar, armarDoc, mismoDoc, ejecutar,
} = require("../precioOficial");
const {extraerPrecios} = require("../preciosOficiales");

const fx = (n) => readFileSync(
    path.join(__dirname, "../../lib/__fixtures__", `${n}.html`), "utf-8");
const post = (n, date, titulo = "Rebaja en los combustibles") => ({
  date, link: `https://medio.hn/${n}`,
  title: {rendered: titulo}, content: {rendered: fx(n)},
});
// Sábado 21/11/2026 11:00 en Tegucigalpa (UTC-6).
const SAB = new Date("2026-11-21T17:00:00Z");
const lect = (medio, n) => ({
  medio, link: `https://medio.hn/${n}`, fecha: "2026-11-20",
  precios: extraerPrecios(fx(n), 2026, 11),
});

test("horario: vie/sáb/dom siempre, lunes solo 05:00, resto nunca", () => {
  assert.ok(debeEjecutar(new Date("2026-11-20T11:00:00Z"))); // vie 05
  assert.ok(debeEjecutar(SAB));
  assert.ok(debeEjecutar(new Date("2026-11-23T05:00:00Z"))); // dom 23 h
  assert.ok(debeEjecutar(new Date("2026-11-23T11:00:00Z"))); // lun 05
  assert.ok(!debeEjecutar(new Date("2026-11-23T17:00:00Z"))); // lun 11
  assert.ok(!debeEjecutar(new Date("2026-11-24T11:00:00Z"))); // mar
});

test("lecturaDePosts: filtra viejas, ajenas y sin datos; https only", () => {
  const posts = [
    post("once-2026-11-16", "2026-11-01T10:00:00"), // vieja
    {...post("once-2026-11-23", "2026-11-20T10:00:00"), title: {rendered: "Combustibles en Chile"}},
    {...post("once-2026-11-23", "2026-11-20T10:00:00"), link: "javascript:alert(1)"},
  ];
  const l = lecturaDePosts("Once", posts, SAB);
  assert.equal(l.precios.vigencia, "2026-11-23");
  assert.equal(l.link, null);
  assert.equal(lecturaDePosts("X", {error: 1}, SAB), null);
  assert.equal(lecturaDePosts("X", [{date: "x"}], SAB), null);
});

test("validar: dos fuentes que coinciden → ok, coinciden true", () => {
  const v = validar({
    lecturas: [lect("HCH", "hch-2026-11-16"), lect("Once", "once-2026-11-16")],
    anterior: null, ahora: new Date("2026-11-14T17:00:00Z"),
  });
  assert.equal(v.ok, true);
  assert.equal(v.vigencia, "2026-11-16");
  assert.equal(v.coinciden, true);
  assert.deepEqual(v.porGalon, {super: 142.91, regular: 128.05, diesel: 153.53});
  assert.equal(v.fuentes.length, 2);
});

test("validar: vigencias distintas → manda la más nueva, una fuente", () => {
  const v = validar({
    lecturas: [lect("HCH", "hch-2026-11-16"), lect("Once", "once-2026-11-23")],
    anterior: {vigencia: "2026-11-16", porGalon: {super: 142.91, regular: 128.05, diesel: 153.53}},
    ahora: SAB,
  });
  assert.equal(v.ok, true);
  assert.equal(v.vigencia, "2026-11-23");
  assert.equal(v.coinciden, null);
  assert.deepEqual(v.fuentes, [{medio: "Once", url: "https://medio.hn/once-2026-11-23"}]);
});

test("validar: rechazos", () => {
  const base = lect("Once", "once-2026-11-23");
  const con = (porGalon, vigencia = "2026-11-23") =>
    ({...base, precios: {porGalon: {...base.precios.porGalon, ...porGalon}, vigencia}});
  const m = (lecturas, anterior = null, ahora = SAB) =>
    validar({lecturas, anterior, ahora}).motivo;
  assert.equal(m([null, null]), "sin-nota");
  assert.equal(m([con({}, null)]), "sin-vigencia");
  assert.equal(m([con({}, "2026-10-01")]), "vigencia-fuera-de-rango");
  assert.equal(m([con({diesel: 300})]), "fuera-de-rango");
  assert.equal(m([con({regular: null})]), "fuera-de-rango");
  assert.equal(m([base, con({super: 140})]), "fuentes-no-coinciden");
  const ant = {vigencia: "2026-11-16", porGalon: {super: 100, regular: 122.81, diesel: 152.7}};
  assert.equal(m([base], ant), "variacion-excesiva");
  // misma vigencia que la anterior no cuenta como variación (es una corrección)
  assert.equal(validar({lecturas: [base], anterior: {...ant, vigencia: "2026-11-23"}, ahora: SAB}).ok, true);
  // 14.9 % pasa
  const ant2 = {vigencia: "2026-11-16", porGalon: {super: 137.43 / 1.149, regular: 122.81, diesel: 152.7}};
  assert.equal(validar({lecturas: [base], anterior: ant2, ahora: SAB}).ok, true);
});

test("armarDoc y mismoDoc", () => {
  const v = validar({lecturas: [lect("Once", "once-2026-11-23")], anterior: null, ahora: SAB});
  const d = armarDoc(v, {date: "2026-11-20T09:00:00", source_url: "https://sen.hn/x.jpg"}, "TS");
  assert.deepEqual(d, {
    vigencia: "2026-11-23",
    porGalon: {super: 137.43, regular: 122.81, diesel: 152.7},
    porLitro: {super: 36.31, regular: 32.44, diesel: 40.34},
    fuentes: [{medio: "Once", url: "https://medio.hn/once-2026-11-23"}],
    coinciden: null,
    senImagen: {url: "https://sen.hn/x.jpg", fecha: "2026-11-20"},
    extraidoEn: "TS",
    estado: "sugerido",
  });
  assert.equal(armarDoc(v, {source_url: "http://x"}, 1).senImagen, null);
  assert.ok(mismoDoc({...d, extraidoEn: "otro"}, d));
  assert.ok(!mismoDoc({...d, coinciden: true}, d));
  assert.ok(!mismoDoc({...d, porGalon: {...d.porGalon, super: 1}}, d));
  assert.ok(!mismoDoc(undefined, d));
});

// ---- ejecutar() con Firestore y fetch falsos ----
function fakeDb(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  const snap = (p) => ({
    exists: datos.has(p), data: () => datos.get(p),
    get: (k) => (datos.get(p) || {})[k],
  });
  const col = (c) => ({
    doc: (id) => ({get: async () => snap(`${c}/${id}`),
      set: async (v) => datos.set(`${c}/${id}`, v)}),
    orderBy: (campo) => ({limit: (n) => ({get: async () => ({
      docs: [...datos.entries()].filter(([k]) => k.startsWith(c + "/"))
          .map(([, v]) => v).sort((a, b) => String(b[campo]).localeCompare(String(a[campo])))
          .slice(0, n).map((v) => ({data: () => v})),
    })})}),
  });
  return {datos, doc: (p) => ({get: async () => snap(p)}), collection: col};
}
const fakeFetch = (rutas) => async (url) => {
  const r = Object.entries(rutas).find(([k]) => url.includes(k));
  if (!r) return {ok: false, status: 404, json: async () => ({})};
  if (r[1] instanceof Error) throw r[1];
  return {ok: true, status: 200, json: async () => r[1]};
};
const logger = {info() {}, warn() {}};
const ON = {"settings/precios": {autoOficial: true}};
const RUTAS = {
  "oncenoticias.hn": [post("once-2026-11-23", "2026-11-20T15:00:00")],
  "hch.tv": [],
  "sen.hn": [{date: "2026-11-20T09:00:00", source_url: "https://sen.hn/p.jpg"}],
};
const run = (db, rutas = RUTAS, ahora = SAB) =>
  ejecutar({db, fetchFn: fakeFetch(rutas), ahora, serverTs: "TS", logger});

test("ejecutar: apagado por defecto y fuera de horario no leen nada", async () => {
  let llamadas = 0;
  const f = async () => {
    llamadas += 1; throw new Error("no");
  };
  const db = fakeDb();
  assert.equal((await ejecutar({db, fetchFn: f, ahora: SAB, serverTs: 1, logger})).resultado, "apagado");
  const off = fakeDb({"settings/precios": {autoOficial: false}});
  assert.equal((await ejecutar({db: off, fetchFn: f, ahora: SAB, serverTs: 1, logger})).resultado, "apagado");
  const martes = new Date("2026-11-24T17:00:00Z");
  assert.equal((await ejecutar({db: fakeDb(ON), fetchFn: f, ahora: martes, serverTs: 1, logger})).resultado, "fuera-de-horario");
  assert.equal(llamadas, 0);
  assert.equal(db.datos.size, 0);
});

test("ejecutar: escribe sugerencia, luego sin-cambios, nunca toca prices", async () => {
  const db = fakeDb(ON);
  assert.deepEqual(await run(db), {resultado: "escrito", vigencia: "2026-11-23"});
  const d = db.datos.get("prices_official/2026-11-23");
  assert.equal(d.estado, "sugerido");
  assert.equal(d.senImagen.url, "https://sen.hn/p.jpg");
  assert.equal((await run(db)).resultado, "sin-cambios");
  assert.ok(![...db.datos.keys()].some((k) => k.startsWith("prices/")));
});

test("ejecutar: doc ya aplicado/no sugerido queda protegido", async () => {
  const db = fakeDb({...ON, "prices_official/2026-11-23": {vigencia: "2026-11-23", estado: "usado", porGalon: {}}});
  assert.equal((await run(db)).resultado, "protegido");
  assert.equal(db.datos.get("prices_official/2026-11-23").estado, "usado");
});

test("ejecutar: validación fallida → prices_official_errors, sin sugerencia", async () => {
  const db = fakeDb({...ON, "prices_official/2026-11-16": {vigencia: "2026-11-16", estado: "sugerido", porGalon: {super: 100, regular: 128.05, diesel: 153.53}}});
  assert.deepEqual(await run(db), {resultado: "error", motivo: "variacion-excesiva"});
  const err = db.datos.get(`prices_official_errors/${SAB.toISOString()}`);
  assert.equal(err.motivo, "variacion-excesiva");
  assert.equal(err.fuentes[0].vigencia, "2026-11-23");
  assert.ok(!db.datos.has("prices_official/2026-11-23"));
});

test("ejecutar: sin nota → solo log; lunes 05:00 sin nota → error", async () => {
  const db = fakeDb(ON);
  const caido = {"oncenoticias.hn": new Error("red"), "hch.tv": []};
  const r = await run(db, caido);
  assert.equal(r.resultado, "sin-nota");
  assert.deepEqual(r.fallos, ["Once Noticias: red"]); // HCH respondió vacío
  assert.equal(db.datos.size, 1);
  const lunes = new Date("2026-11-23T11:00:00Z");
  assert.equal((await run(db, caido, lunes)).resultado, "error");
  assert.ok(db.datos.has(`prices_official_errors/${lunes.toISOString()}`));
});
