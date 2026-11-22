"use strict";
// Flujo del precio oficial semanal (TASK-020): consulta medios, valida y arma
// la sugerencia `prices_official/{vigencia}`. Las dependencias de E/S (db,
// fetch, timestamp) se inyectan para probar el flujo sin red ni Firebase.

const {
  extraerPrecios, notaCompleta, diferencias, esNotaDePrecios, porLitro,
  MIN_GAL, MAX_GAL,
} = require("./preciosOficiales");

const MEDIOS = [
  {nombre: "Once Noticias", api: "https://oncenoticias.hn/wp-json/wp/v2/posts"},
  {nombre: "HCH", api: "https://hch.tv/wp-json/wp/v2/posts"},
];
const SEN_MEDIA = "https://sen.hn/wp-json/wp/v2/media?search=Precios" +
  "&orderby=date&order=desc&per_page=1&_fields=date,source_url";
const COMBUSTIBLES = ["super", "regular", "diesel"];
const DIAS_VALIDEZ = 10;
const DIA_MS = 86400000;
const FETCH_TIMEOUT_MS = 10000;
/** Variación máxima aceptada contra la última sugerencia. */
const VARIACION_MAX = 0.15;
const ZONA = "America/Tegucigalpa";

const httpsOnly = (u) =>
  (typeof u === "string" && /^https:\/\//i.test(u) ? u : null);
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Día de la semana (0 = domingo) y hora en Tegucigalpa.
 * @param {Date} fecha Instante a convertir.
 * @return {{dia: number, hora: number}} Día y hora locales.
 */
function horaTegucigalpa(fecha) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA, weekday: "short", hour: "numeric", hourCycle: "h23",
  }).formatToParts(fecha);
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const valor = (t) => partes.find((p) => p.type === t).value;
  return {dia: dias.indexOf(valor("weekday")), hora: Number(valor("hour"))};
}

/**
 * El cron corre vie–lun a las 05/11/17/23; el lunes solo vale la de las 05.
 * @param {Date} fecha Instante de la ejecución.
 * @return {boolean} true si la ejecución debe trabajar.
 */
function debeEjecutar(fecha) {
  const {dia, hora} = horaTegucigalpa(fecha);
  if (dia === 1) return hora === 5;
  return dia === 5 || dia === 6 || dia === 0;
}

/**
 * Primera nota reciente y completa de un medio (misma regla que el panel).
 * @param {string} medio Nombre del medio.
 * @param {Array<object>} posts Respuesta de WP REST.
 * @param {Date} ahora Instante actual.
 * @return {object|null} Lectura {medio, link, fecha, precios} o null.
 */
function lecturaDePosts(medio, posts, ahora) {
  if (!Array.isArray(posts)) return null;
  const limite = ahora.getTime() - DIAS_VALIDEZ * DIA_MS;
  for (const p of posts) {
    const fecha = new Date(p && p.date);
    const titulo = p && p.title && p.title.rendered;
    const html = p && p.content && p.content.rendered;
    if (Number.isNaN(fecha.getTime()) || fecha.getTime() < limite) continue;
    if (typeof titulo !== "string" || typeof html !== "string") continue;
    if (!esNotaDePrecios(titulo)) continue;
    const precios = extraerPrecios(
        html, fecha.getFullYear(), fecha.getMonth() + 1);
    if (notaCompleta(precios)) {
      return {medio, link: httpsOnly(p.link), fecha: p.date, precios};
    }
  }
  return null;
}

/**
 * Valida las lecturas y elige la de la vigencia más reciente.
 * @param {object} e {lecturas, anterior, ahora}: lecturas de los medios,
 *   última sugerencia previa (o null) y el instante actual.
 * @return {object} {ok: true, vigencia, porGalon, fuentes, coinciden} o
 *   {ok: false, motivo, detalle}.
 */
function validar({lecturas, anterior, ahora}) {
  const ok = lecturas.filter(Boolean);
  if (ok.length === 0) {
    return {ok: false, motivo: "sin-nota", detalle: "Ningún medio publicó."};
  }
  ok.sort((a, b) => String(b.precios.vigencia || "")
      .localeCompare(String(a.precios.vigencia || "")));
  const vigencia = ok[0].precios.vigencia;
  if (!vigencia || !/^\d{4}-\d{2}-\d{2}$/.test(vigencia)) {
    return {ok: false, motivo: "sin-vigencia",
      detalle: "La nota no indica desde cuándo rigen los precios."};
  }
  const tVig = Date.parse(`${vigencia}T12:00:00Z`);
  if (Number.isNaN(tVig) ||
      Math.abs(tVig - ahora.getTime()) > DIAS_VALIDEZ * DIA_MS) {
    return {ok: false, motivo: "vigencia-fuera-de-rango",
      detalle: `Vigencia ${vigencia} lejos de la fecha actual.`};
  }
  const misma = ok.filter((l) => l.precios.vigencia === vigencia);
  if (misma.length > 1 &&
      diferencias(misma[0].precios, misma[1].precios).length > 0) {
    return {ok: false, motivo: "fuentes-no-coinciden",
      detalle: misma.map((l) => `${l.medio}: ` +
        COMBUSTIBLES.map((c) => l.precios.porGalon[c]).join("/")).join("; ")};
  }
  const porGalon = {};
  for (const c of COMBUSTIBLES) {
    const v = misma[0].precios.porGalon[c];
    if (typeof v !== "number" || !(v >= MIN_GAL && v <= MAX_GAL)) {
      return {ok: false, motivo: "fuera-de-rango",
        detalle: `${c}: ${v} fuera de ${MIN_GAL}–${MAX_GAL} L/gal.`};
    }
    porGalon[c] = r2(v);
  }
  if (anterior && anterior.porGalon && anterior.vigencia !== vigencia) {
    for (const c of COMBUSTIBLES) {
      const a = anterior.porGalon[c];
      if (typeof a !== "number" || a <= 0) continue;
      const variacion = Math.abs(porGalon[c] - a) / a;
      if (variacion >= VARIACION_MAX) {
        return {ok: false, motivo: "variacion-excesiva",
          detalle: `${c}: ${a} → ${porGalon[c]} ` +
            `(${r2(variacion * 100)} % vs ${anterior.vigencia}).`};
      }
    }
  }
  return {
    ok: true, vigencia, porGalon,
    fuentes: misma.map((l) => ({medio: l.medio, url: l.link})),
    coinciden: misma.length > 1 ? true : null,
  };
}

/**
 * Documento `prices_official/{vigencia}`.
 * @param {object} v Resultado ok de validar().
 * @param {object|null} sen Última imagen SEN {date, source_url}.
 * @param {*} extraidoEn Timestamp (serverTimestamp en producción).
 * @return {object} Documento a escribir.
 */
function armarDoc(v, sen, extraidoEn) {
  const url = sen && httpsOnly(sen.source_url);
  return {
    vigencia: v.vigencia,
    porGalon: {...v.porGalon},
    porLitro: Object.fromEntries(
        COMBUSTIBLES.map((c) => [c, porLitro(v.porGalon[c])])),
    fuentes: v.fuentes,
    coinciden: v.coinciden,
    senImagen: url ? {url, fecha: String(sen.date || "").slice(0, 10)} : null,
    extraidoEn,
    estado: "sugerido",
  };
}

/**
 * Un doc existente es "igual" si trae los mismos precios y la misma
 * confirmación de fuentes (no importa cuándo se extrajo).
 * @param {object|undefined} a Documento existente.
 * @param {object} b Documento nuevo.
 * @return {boolean} true si no hace falta reescribir.
 */
function mismoDoc(a, b) {
  if (!a || !a.porGalon) return false;
  return a.coinciden === b.coinciden &&
    COMBUSTIBLES.every((c) => a.porGalon[c] === b.porGalon[c]);
}

/**
 * GET JSON con timeout. Lanza si no responde 2xx.
 * @param {Function} fetchFn fetch inyectado.
 * @param {string} url URL a consultar.
 * @return {Promise<*>} Cuerpo JSON.
 */
async function getJson(fetchFn, url) {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const res = await fetchFn(url, {signal});
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${new URL(url).host}`);
  return res.json();
}

/**
 * Una ejecución completa. Devuelve qué pasó (para logs y pruebas).
 * @param {object} deps {db, fetchFn, ahora, serverTs, logger}: Firestore
 *   (Admin SDK), fetch, instante, timestamp del servidor y logger.
 * @return {Promise<object>} {resultado, ...}.
 */
async function ejecutar({db, fetchFn, ahora, serverTs, logger}) {
  if (!debeEjecutar(ahora)) return {resultado: "fuera-de-horario"};
  const ajustes = await db.doc("settings/precios").get();
  if (!ajustes.exists || ajustes.get("autoOficial") !== true) {
    return {resultado: "apagado"};
  }

  const fallos = [];
  const consulta = `?search=${encodeURIComponent("precios combustibles")}` +
    "&per_page=10&_fields=date,link,title,content";
  const [lecturas, sen] = await Promise.all([
    Promise.all(MEDIOS.map((m) => getJson(fetchFn, m.api + consulta)
        .then((posts) => lecturaDePosts(m.nombre, posts, ahora))
        .catch((e) => {
          fallos.push(`${m.nombre}: ${e.message}`);
          return null;
        }))),
    getJson(fetchFn, SEN_MEDIA)
        .then((a) => (Array.isArray(a) && a[0]) || null)
        .catch(() => null),
  ]);

  const previas = await db.collection("prices_official")
      .orderBy("vigencia", "desc").limit(2).get();
  const candidatas = previas.docs.map((d) => d.data());
  const vigNueva = lecturas.filter(Boolean)
      .map((l) => l.precios.vigencia).sort().pop();
  const anterior = candidatas.find((d) => d.vigencia !== vigNueva) || null;

  const v = validar({lecturas, anterior, ahora});
  if (!v.ok) {
    const {dia} = horaTegucigalpa(ahora);
    // Viernes temprano todavía no hay nota: no es un error. Sí lo es si el
    // lunes 05:00 sigue sin haber nada.
    if (v.motivo === "sin-nota" && dia !== 1) {
      logger.info("precioOficialSemanal: sin nota todavía", {fallos});
      return {resultado: "sin-nota", fallos};
    }
    const error = {
      motivo: v.motivo, detalle: v.detalle, fallos,
      fuentes: lecturas.filter(Boolean)
          .map((l) => ({medio: l.medio, url: l.link,
            vigencia: l.precios.vigencia, porGalon: l.precios.porGalon})),
      extraidoEn: serverTs,
    };
    await db.collection("prices_official_errors")
        .doc(ahora.toISOString()).set(error);
    logger.warn("precioOficialSemanal: validación fallida", error);
    return {resultado: "error", motivo: v.motivo};
  }

  const nuevo = armarDoc(v, sen, serverTs);
  const ref = db.collection("prices_official").doc(v.vigencia);
  const existente = await ref.get();
  if (existente.exists && existente.get("estado") !== "sugerido") {
    return {resultado: "protegido", vigencia: v.vigencia};
  }
  if (existente.exists && mismoDoc(existente.data(), nuevo)) {
    return {resultado: "sin-cambios", vigencia: v.vigencia};
  }
  await ref.set(nuevo);
  logger.info("precioOficialSemanal: sugerencia escrita", {
    vigencia: v.vigencia, porGalon: v.porGalon, coinciden: v.coinciden,
  });
  return {resultado: "escrito", vigencia: v.vigencia};
}

module.exports = {
  MEDIOS, SEN_MEDIA, VARIACION_MAX, horaTegucigalpa, debeEjecutar,
  lecturaDePosts, validar, armarDoc, mismoDoc, ejecutar,
};
