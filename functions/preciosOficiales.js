/* eslint-disable max-len, require-jsdoc, valid-jsdoc */
// COPIA CommonJS de lib/preciosOficiales.ts (el paquete de Functions se
// despliega solo y no puede importar ../lib). Mantener línea a línea igual al
// original: test/paridad.test.mjs compara ambas copias con las fixtures reales.
// Regex largas y sin JSDoc a propósito, para que el diff con el .ts sea legible.
"use strict";

const PRODUCTOS_OFICIALES = ["super", "regular", "diesel", "kerosene"];

const LITROS_POR_GALON = 3.78541;
const MIN_GAL = 80;
const MAX_GAL = 250;

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const ENTIDADES = {
  "&nbsp;": " ", "&aacute;": "á", "&eacute;": "é", "&iacute;": "í", "&oacute;": "ó", "&uacute;": "ú",
  "&ntilde;": "ñ", "&Aacute;": "Á", "&Eacute;": "É", "&Iacute;": "Í", "&Oacute;": "Ó", "&Uacute;": "Ú",
  "&iquest;": "¿", "&iexcl;": "¡", "&amp;": "&", "&quot;": "\"", "&#8220;": "\"", "&#8221;": "\"", "&#8217;": "'",
};

function textoPlano(html) {
  return html
      .replace(/<[^>]+>/g, " ")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&[a-zA-Z]+;|&#\d+;/g, (e) => ENTIDADES[e] ?? " ")
      .replace(/\s+/g, " ")
      .trim();
}

function tramoTegucigalpa(txt) {
  const i = txt.search(/Tegucigalpa/i);
  if (i < 0) return "";
  const resto = txt.slice(i);
  const j = resto.search(/San Pedro Sula/i);
  return j < 0 ? resto : resto.slice(0, j);
}

const MONTO = /L\s?(\d{2,3}(?:[.,]\d{1,2})?)|(\d{2,3})\s+lempiras?\s+(?:y|con)\s+(\d{1,2})\s+centavos?/gi;

const CLAVES = {
  super: /s[uú]per(?:ior)?\b/i,
  regular: /regular\b/i,
  diesel: /di[eé]sel\b/i,
  kerosene: /(?:keros[eé]ne|queroseno)\b/i,
};

function precioTras(tramo, clave) {
  const global = new RegExp(clave.source, "gi");
  for (const m of tramo.matchAll(global)) {
    const inicio = (m.index ?? 0) + m[0].length;
    const ventana = tramo.slice(inicio, inicio + 220);
    const corte = Math.min(...[...Object.values(CLAVES), /\b(?:GLP|LPG|gas licuado)\b/i].map((r) => {
      const k = new RegExp(r.source, "i").exec(ventana);
      return k ? k.index : Infinity;
    }));
    const zona = ventana.slice(0, Number.isFinite(corte) ? corte : ventana.length);
    const candidatos = [];
    for (const x of zona.matchAll(MONTO)) {
      const v = x[1] !== undefined ? parseFloat(x[1].replace(",", ".")) : Number(x[2]) + Number(x[3]) / 100;
      if (v < MIN_GAL || v > MAX_GAL) continue;
      const antes = zona.slice(Math.max(0, (x.index ?? 0) - 40), x.index ?? 0);
      const despues = zona.slice((x.index ?? 0) + x[0].length, (x.index ?? 0) + x[0].length + 14);
      if (/\b(?:de|desde)\s*$/i.test(antes) && /^\s*(?:a|hasta)\s+(?:L\s?)?\d/i.test(despues)) continue;
      if (/(?:antes|anterior(?:mente)?|costaba|cotizaba|era de|estaba en|semana pasada|dejar[aá] de costar)[^0-9]{0,14}$/i.test(antes)) continue;
      if (/(?:sub(?:e|i[oó]|ir[aá])|baj(?:a|[oó]|ar[aá])|alza|aument\w*|increment\w*|rebaja|disminu\w*|reducci[oó]n)\s*(?:de\s*)?$/i.test(antes)) continue;
      const destino = /(?:costar[aá]|quedar[aá]|quedando|quedar|ubicar(?:se|[aá])|cotizar[aá]|vender[aá]|precio(?: ser[aá])?(?: de)?|pasar[aá] a costar|mantendr[aá]|mantiene|ahora|nuevo|hasta|\ba|\ben|:)[^0-9]{0,14}$/i.test(antes);
      candidatos.push({v: Math.round(v * 100) / 100, destino});
    }
    if (candidatos.length === 1) return candidatos[0].v;
    if (candidatos.length > 1) {
      const d = candidatos.find((c) => c.destino);
      return d ? d.v : null;
    }
  }
  return null;
}

function vigenciaDe(txt, anioRef, mesRef) {
  const m = /(?:a partir del?|vigentes? desde el?|en vigencia(?: a partir)?(?: del?)?|rigen desde el?)\s+(?:(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(\d{4}))?/i
      .exec(txt);
  if (!m) return null;
  const mes = MESES.indexOf(m[2].toLowerCase()) + 1;
  const anio = m[3] ? Number(m[3]) : anioRef + (mesRef === 12 && mes === 1 ? 1 : 0);
  return `${anio}-${String(mes).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
}

function preciosDeTabla(html) {
  const vacio = Object.fromEntries(PRODUCTOS_OFICIALES.map((p) => [p, null]));
  const filas = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((f) =>
    [...f[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => textoPlano(c[1])));
  const iCab = filas.findIndex((f) => f.some((c) => /Tegucigalpa/i.test(c)));
  if (iCab < 0) return vacio;
  const col = filas[iCab].findIndex((c) => /Tegucigalpa/i.test(c));
  const out = {...vacio};
  for (const f of filas.slice(iCab + 1)) {
    const prod = PRODUCTOS_OFICIALES.find((p) => CLAVES[p].test(f[0] ?? ""));
    const celda = f[col];
    if (!prod || out[prod] !== null || !celda) continue;
    const mm = /(\d{2,3}(?:[.,]\d{1,2})?)/.exec(celda);
    const n = mm ? parseFloat(mm[1].replace(",", ".")) : NaN;
    if (n >= MIN_GAL && n <= MAX_GAL) out[prod] = Math.round(n * 100) / 100;
  }
  return out;
}

function extraerPrecios(html, anioRef = new Date().getFullYear(), mesRef) {
  const txt = textoPlano(html);
  if (/<table[\s\S]*Tegucigalpa[\s\S]*<\/table>/i.test(html)) return {porGalon: preciosDeTabla(html), vigencia: vigenciaDe(txt, anioRef, mesRef)};
  const tgu = tramoTegucigalpa(txt);
  const porGalon = Object.fromEntries(
      PRODUCTOS_OFICIALES.map((p) => [p, tgu ? precioTras(tgu, CLAVES[p]) : null]),
  );
  return {porGalon, vigencia: vigenciaDe(txt, anioRef, mesRef)};
}

const porLitro = (galon) => Math.round((galon / LITROS_POR_GALON) * 100) / 100;

const notaCompleta = (p) =>
  p.porGalon.super !== null && p.porGalon.regular !== null && p.porGalon.diesel !== null;

function diferencias(a, b) {
  return ["super", "regular", "diesel"].filter((p) => {
    const x = a.porGalon[p];
    const y = b.porGalon[p];
    return x === null || y === null || Math.abs(x - y) > 0.01;
  });
}

const esNotaDePrecios = (titulo) =>
  /combustible|gasolina/i.test(titulo) && !/chile|el salvador|guatemala|costa rica|m[eé]xico|nicaragua/i.test(titulo);

module.exports = {
  PRODUCTOS_OFICIALES, MIN_GAL, MAX_GAL, textoPlano, extraerPrecios, porLitro,
  notaCompleta, diferencias, esNotaDePrecios,
};
