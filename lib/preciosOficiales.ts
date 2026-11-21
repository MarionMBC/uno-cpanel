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
/** Rango plausible de un precio por galón; deja afuera variaciones ("bajará 5.48") y el cilindro de GLP. */
const MIN_GAL = 60;
const MAX_GAL = 300;

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
      if (v >= MIN_GAL && v <= MAX_GAL) return Math.round(v * 100) / 100;
    }
  }
  return null;
}

/** Fecha "a partir del lunes 23 de noviembre (de 2026)" → YYYY-MM-DD. Sin año: el de `anioRef`. */
function vigenciaDe(txt: string, anioRef: number): string | null {
  const m = /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(\d{4}))?/i
    .exec(txt.slice(Math.max(0, txt.search(/(?:a partir|vigen|entra)/i))));
  if (!m) return null;
  const mes = MESES.indexOf(m[2].toLowerCase()) + 1;
  const anio = m[3] ? Number(m[3]) : anioRef;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`;
}

export function extraerPrecios(html: string, anioRef = new Date().getFullYear()): PreciosNota {
  const txt = textoPlano(html);
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
