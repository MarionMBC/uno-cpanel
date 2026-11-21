// Precio oficial de referencia (Secretaría de Energía de Honduras, plaza Tegucigalpa).
// La SEN publica una imagen; los medios publican el texto el viernes. Este módulo extrae los números
// del texto de una nota (HTML de WordPress). Puro y sin imports de runtime: se prueba con `npm test`.

export type ProductoOficial = 'super' | 'regular' | 'diesel' | 'kerosene';
export const PRODUCTOS_OFICIALES: ProductoOficial[] = ['super', 'regular', 'diesel', 'kerosene'];

export interface PreciosNota {
  /** L/galón en Tegucigalpa. null si la nota no trae ese producto. */
  porGalon: Record<ProductoOficial, number | null>;
  /** Fecha de vigencia (YYYY-MM-DD) si la nota la menciona. */
  vigencia: string | null;
}

const LITROS_POR_GALON = 3.78541;
/** Rango plausible de un precio por galón de Súper/Regular/Diésel/Kerosene (deja afuera variaciones y GLP). */
const MIN_GAL = 80;
const MAX_GAL = 250;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const ENTIDADES: Record<string, string> = {
  '&nbsp;': ' ', '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&oacute;': 'ó', '&uacute;': 'ú',
  '&ntilde;': 'ñ', '&Aacute;': 'Á', '&Eacute;': 'É', '&Iacute;': 'Í', '&Oacute;': 'Ó', '&Uacute;': 'Ú',
  '&iquest;': '¿', '&iexcl;': '¡', '&amp;': '&', '&quot;': '"', '&#8220;': '"', '&#8221;': '"', '&#8217;': "'",
};

export function textoPlano(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-zA-Z]+;|&#\d+;/g, e => ENTIDADES[e] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tramo del texto que habla de Tegucigalpa (hasta que empieza San Pedro Sula). */
function tramoTegucigalpa(txt: string): string {
  const i = txt.search(/Tegucigalpa/i);
  if (i < 0) return '';
  const resto = txt.slice(i);
  const j = resto.search(/San Pedro Sula/i);
  return j < 0 ? resto : resto.slice(0, j);
}

// Montos en las redacciones vistas: "L137.43", "L 137.43", "142 lempiras y 91 centavos", "128 lempiras con 05 centavo".
const MONTO = /L\s?(\d{2,3}(?:[.,]\d{1,2})?)|(\d{2,3})\s+lempiras?\s+(?:y|con)\s+(\d{1,2})\s+centavos?/gi;

const CLAVES: Record<ProductoOficial, RegExp> = {
  super: /s[uú]per(?:ior)?\b/i,
  regular: /regular\b/i,
  diesel: /di[eé]sel\b/i,
  kerosene: /(?:keros[eé]ne|queroseno)\b/i,
};

/** Primer monto plausible (MIN_GAL–MAX_GAL) tras alguna mención del producto, sin pasar al siguiente producto. */
function precioTras(tramo: string, clave: RegExp): number | null {
  const global = new RegExp(clave.source, 'gi');
  for (const m of tramo.matchAll(global)) {
    const inicio = (m.index ?? 0) + m[0].length;
    const ventana = tramo.slice(inicio, inicio + 220);
    // El precio de un producto no se busca más allá del nombre del siguiente producto.
    const corte = Math.min(...Object.values(CLAVES).map(r => {
      const k = new RegExp(r.source, 'i').exec(ventana);
      return k ? k.index : Infinity;
    }));
    const zona = ventana.slice(0, Number.isFinite(corte) ? corte : ventana.length);
    for (const x of zona.matchAll(MONTO)) {
      const v = x[1] !== undefined ? parseFloat(x[1].replace(',', '.')) : Number(x[2]) + Number(x[3]) / 100;
      if (v < MIN_GAL || v > MAX_GAL) continue;
      const antes = zona.slice(Math.max(0, (x.index ?? 0) - 30), x.index ?? 0);
      const despues = zona.slice((x.index ?? 0) + x[0].length, (x.index ?? 0) + x[0].length + 12);
      // "pasa de L142.91 a L137.43", "de 142.91 hasta 137.43": el primero es el precio anterior.
      if (/\bde\s*$/i.test(antes) && /^\s*(?:a|hasta)\b/i.test(despues)) continue;
      // "antes L142.91", "costaba L142.91", "precio anterior de L142.91".
      if (/(?:antes|anterior(?:mente)?|costaba|era de|estaba en|semana pasada)[^0-9]{0,12}$/i.test(antes)) continue;
      // Variaciones: "sube L65.00", "aumento de L90", "rebaja de 85 lempiras".
      if (/(?:sub(?:e|i[oó]|ir[aá])|baj(?:a|[oó]|ar[aá])|aument\w*|increment\w*|rebaja|disminu\w*|reducci[oó]n)\s*(?:de\s*)?$/i.test(antes)) continue;
      return Math.round(v * 100) / 100;
    }
  }
  return null;
}

/** Fecha "a partir del lunes 23 de noviembre (de 2026)" → YYYY-MM-DD. Sin año: el de `anioRef`. */
function vigenciaDe(txt: string, anioRef: number): string | null {
  // Solo frases de vigencia ("a partir del lunes 23 de noviembre", "vigentes desde el 23 de…", "entran en
  // vigencia … 16 de noviembre"); nunca la fecha de publicación de la nota.
  const m = /(?:a partir del?|vigentes? desde el?|en vigencia(?: a partir)?(?: del?)?|rigen desde el?)\s+(?:(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(\d{4}))?/i
    .exec(txt);
  if (!m) return null;
  const mes = MESES.indexOf(m[2].toLowerCase()) + 1;
  const anio = m[3] ? Number(m[3]) : anioRef;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
}

/** Nota con tabla HTML: se lee la columna "Tegucigalpa". Sin esa columna → todo null (falla seguro). */
function preciosDeTabla(html: string): Record<ProductoOficial, number | null> {
  const vacio = Object.fromEntries(PRODUCTOS_OFICIALES.map(p => [p, null])) as Record<ProductoOficial, number | null>;
  const filas = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(f =>
    [...f[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c => textoPlano(c[1])));
  const iCab = filas.findIndex(f => f.some(c => /Tegucigalpa/i.test(c)));
  if (iCab < 0) return vacio;
  const col = filas[iCab].findIndex(c => /Tegucigalpa/i.test(c));
  const out = { ...vacio };
  for (const f of filas.slice(iCab + 1)) {
    const prod = PRODUCTOS_OFICIALES.find(p => CLAVES[p].test(f[0] ?? ''));
    const celda = f[col];
    if (!prod || out[prod] !== null || !celda) continue;
    const n = parseFloat(celda.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (n >= MIN_GAL && n <= MAX_GAL) out[prod] = Math.round(n * 100) / 100;
  }
  return out;
}

export function extraerPrecios(html: string, anioRef = new Date().getFullYear()): PreciosNota {
  const txt = textoPlano(html);
  if (/<table/i.test(html)) return { porGalon: preciosDeTabla(html), vigencia: vigenciaDe(txt, anioRef) };
  const tgu = tramoTegucigalpa(txt);
  const porGalon = Object.fromEntries(
    PRODUCTOS_OFICIALES.map(p => [p, tgu ? precioTras(tgu, CLAVES[p]) : null]),
  ) as Record<ProductoOficial, number | null>;
  return { porGalon, vigencia: vigenciaDe(txt, anioRef) };
}

export const porLitro = (galon: number) => Math.round((galon / LITROS_POR_GALON) * 100) / 100;

/** Una nota sirve si trae los tres combustibles de la estación. */
export const notaCompleta = (p: PreciosNota) =>
  p.porGalon.super !== null && p.porGalon.regular !== null && p.porGalon.diesel !== null;

/** Productos en los que dos notas difieren (por más de 1 centavo). Vacío = coinciden. */
export function diferencias(a: PreciosNota, b: PreciosNota): ProductoOficial[] {
  return (['super', 'regular', 'diesel'] as ProductoOficial[]).filter(p => {
    const x = a.porGalon[p];
    const y = b.porGalon[p];
    return x === null || y === null || Math.abs(x - y) > 0.01;
  });
}

/** Filtro de títulos de notas de precios semanales. */
export const esNotaDePrecios = (titulo: string) =>
  /combustible|gasolina/i.test(titulo) && !/chile|el salvador|guatemala|costa rica|m[eé]xico|nicaragua/i.test(titulo);
