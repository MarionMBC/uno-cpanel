// Tablas de calibración de tanques horizontales · UNO Guaimaca Centro.
// Transcritas tal cual de las hojas plastificadas de la estación ("TABLAS DER CALIBRACION
// TANQUE HORIZONTAL · UBICACIÓN: GUAIMACA"). Varilla en pulgadas (pasos de 0.25) → galones.
// Sin imports de runtime: se prueba con `npm test`.

export type TanqueId = 'diesel' | 'super';

export interface TablaCalibracion {
  id: TanqueId;
  nombre: string;
  capacidad: number;
  /** Pares [pulgadas, galones] ordenados por pulgadas. */
  puntos: [number, number][];
}

export interface Anomalia {
  tanque: TanqueId;
  pulgadas: number;
  galones: number;
  nota: string;
}

/** Une tramos de la hoja: cada tramo arranca en `desde` y avanza de 0.25 en 0.25. */
function tramos(...cols: [number, number[]][]): [number, number][] {
  return cols.flatMap(([desde, gal]) => gal.map((g, i): [number, number] => [Math.round((desde + i * 0.25) * 100) / 100, g]));
}

const DIESEL = tramos(
  [0.25, [2, 5, 9, 14, 20, 26, 32, 39, 47, 55, 63, 72, 81, 91, 100, 111, 121, 132, 143, 154, 165, 177, 189, 201, 214, 226, 239, 252, 266, 279, 293, 307, 321, 336, 350, 365, 380, 395, 410, 425]],
  [10.25, [441, 456, 472, 488, 504, 521, 537, 554, 570, 587, 604, 621, 639, 656, 674, 691, 709, 727, 745, 763, 781, 799, 818, 836, 855, 874, 893, 911, 930, 950, 969, 988, 1007, 1027, 1046, 1066, 1086, 1106, 1126, 1146]],
  [20.25, [1166, 1186, 1206, 1226, 1246, 1267, 1287, 1308, 1328, 1349, 1370, 1391, 1412, 1432, 1453, 1474, 1495, 1517, 1538, 1559, 1580, 1602, 1623, 1644, 1666, 1687, 1709, 1731, 1752, 1774, 1796, 1817, 1839, 1861, 1883, 1905, 1926, 1948, 1970, 1992]],
  [30.25, [2014, 2036, 2050, 2081, 2103, 2125, 2147, 2169, 2191, 2213, 2236, 2258, 2280, 2302, 2325, 2347, 2369, 2391, 2414, 2436, 2458, 2481, 2503, 2525, 2547, 2570, 2592, 2614, 2637, 2659, 2681, 2703, 2726, 2748, 2770, 2792, 2815, 2837, 2859, 2881]],
  [40.25, [2903, 2925, 2947, 2969, 2991, 3014, 3036, 3057, 3079, 3131, 3123, 3145, 3167, 3189, 3210, 3232, 3254, 3276, 3297, 3319, 3340, 3362, 3383, 3405, 3426, 3447, 3468, 3490, 3511, 3532, 3553, 3574, 3595, 3616, 3637, 3657, 3678, 3699, 3719, 3740]],
  [50.25, [3760, 3781, 3801, 3821, 3841, 3861, 3881, 3901, 3921, 3941, 3961, 3980, 4000, 4019, 4038, 4058, 4077, 4096, 4115, 4134, 4153, 4171, 4190, 4208, 4227, 4245, 4263, 4281, 4299, 4317, 4334, 4352, 4369, 4387, 4404, 4421, 4438, 4455, 4471, 4488]],
  // Hoja 2: la columna "GAL" junto a 60.25…70.00 trae 54071…59875 (fuera de escala para 5016 gal);
  // se usa la columna siguiente, que continúa la serie desde 4488.
  [60.25, [4504, 4520, 4536, 4552, 4568, 4584, 4599, 4615, 4630, 4645, 4659, 4675, 4688, 4703, 4717, 4731, 4744, 4758, 4771, 4784, 4797, 4809, 4822, 4834, 4846, 4857, 4869, 4880, 4890, 4901, 4911, 4921, 4931, 4940, 4949, 4958, 4966, 4973, 4981, 4988]],
  [70.25, [4994, 5000, 5005, 5010, 5013, 5016]],
);

const SUPER = tramos(
  [0.25, [2, 5, 9, 14, 20, 26, 33, 40, 48, 56, 65, 74, 83, 93, 102, 113, 123, 134, 145, 157, 169, 181, 193, 205, 218, 231, 244, 258, 271, 285, 299, 313, 328, 342, 357, 372, 387, 403, 418, 434]],
  [10.25, [450, 466, 482, 498, 515, 531, 548, 565, 582, 599, 617, 634, 652, 669, 687, 705, 723, 741, 760, 778, 797, 815, 834, 853, 872, 891, 910, 930, 949, 969, 988, 1008, 1027, 1047, 1067, 1087, 1107, 1128, 1148, 1168]],
  [20.25, [1189, 1209, 1230, 1250, 1271, 1292, 1313, 1334, 1355, 1376, 1397, 1418, 1439, 1460, 1482, 1503, 1525, 1546, 1568, 1589, 1611, 1633, 1654, 1676, 1698, 1720, 1742, 1764, 1786, 1808, 1830, 1852, 1874, 1896, 1919, 1941, 1963, 1986, 2008, 2030]],
  [30.25, [2053, 2075, 2097, 2120, 2142, 2165, 2187, 2210, 2232, 2255, 2278, 2300, 2323, 2345, 2368, 2391, 2413, 2436, 2458, 2481, 2504, 2526, 2549, 2572, 2594, 2617, 2640, 2662, 2685, 2707, 2730, 2753, 2775, 2798, 2820, 2843, 2865, 2888, 2910, 2933]],
  [40.25, [2955, 2978, 3000, 3022, 3045, 3067, 3089, 3112, 3134, 3156, 3178, 3200, 3223, 3245, 3267, 3289, 3311, 3332, 3354, 3376, 3398, 3420, 3441, 3463, 3485, 3506, 3528, 3549, 3570, 3592, 3613, 3634, 3655, 3676, 3697, 3718, 3739, 3760, 3781, 3801]],
  [50.25, [3822, 3843, 3863, 3883, 3904, 3924, 3944, 3964, 3984, 4004, 4024, 4044, 4063, 4083, 4102, 4121, 4141, 4160, 4179, 4198, 4217, 4235, 4254, 4272, 4291, 4309, 4327, 4345, 4363, 4381, 4399, 4416, 4433, 4451, 4468, 4485, 4502, 4518, 4535, 4551]],
  [60.25, [4568, 4584, 4600, 4615, 4631, 4664, 4662, 4677, 4692, 4706, 4721, 4735, 4749, 4763, 4777, 4790, 4804, 4817, 4830, 4842, 4855, 4867, 4878, 4890, 4901, 4912, 4923, 4934, 4944, 4954, 4963, 4972, 4981, 4989, 4997, 5005, 5012, 5018, 5024, 5029]],
  // La hoja imprime "7050" en la columna PULG: es 70.50.
  [70.25, [5034, 5038, 5040]],
);

export const TABLAS: Record<TanqueId, TablaCalibracion> = {
  diesel: { id: 'diesel', nombre: 'Diésel', capacidad: 5016, puntos: [[0, 0], ...DIESEL] },
  super: { id: 'super', nombre: 'Súper', capacidad: 5040, puntos: [[0, 0], ...SUPER] },
};

/** Valores de la hoja impresa que rompen la serie; se respetan pero se muestran para revisión. */
export const ANOMALIAS: Anomalia[] = [
  { tanque: 'diesel', pulgadas: 30.75, galones: 2050, nota: 'Salto irregular (2036 → 2050 → 2081); lo esperable es ≈2058.' },
  { tanque: 'diesel', pulgadas: 42.5, galones: 3131, nota: 'Mayor que 42.75 (3123); lo esperable es ≈3101.' },
  { tanque: 'super', pulgadas: 61.5, galones: 4664, nota: 'Mayor que 61.75 (4662); lo esperable es ≈4646.' },
];

export const esAnomalia = (tanque: TanqueId, pulgadas: number) =>
  ANOMALIAS.some(a => a.tanque === tanque && a.pulgadas === pulgadas);

export const maxPulgadas = (t: TablaCalibracion) => t.puntos[t.puntos.length - 1][0];

/**
 * Galones para una lectura de varilla. Exacto en los puntos de la tabla e interpolación lineal
 * entre ellos. Devuelve null si la lectura es negativa, no numérica o supera la tabla.
 */
export function galonesDesdePulgadas(t: TablaCalibracion, pulgadas: number): number | null {
  if (!Number.isFinite(pulgadas) || pulgadas < 0 || pulgadas > maxPulgadas(t)) return null;
  const pts = t.puntos;
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid][0] <= pulgadas) lo = mid; else hi = mid;
  }
  const [p0, g0] = pts[lo];
  if (p0 === pulgadas) return g0;
  const [p1, g1] = pts[hi];
  if (p1 === pulgadas) return g1;
  return Math.round((g0 + ((g1 - g0) * (pulgadas - p0)) / (p1 - p0)) * 100) / 100;
}

export const LITROS_POR_GALON = 3.78541;

export interface CuadreTanque {
  inicialGal: number;
  recibidoGal: number;
  vendidoGal: number;
  teoricoGal: number;
  finalGal: number;
  /** final − teórico. Negativo = faltante (evaporación/merma); positivo = sobrante. */
  diferenciaGal: number;
  diferenciaL: number;
  /** Diferencia sobre lo vendido, en %. null si no hubo ventas. */
  porcentaje: number | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function cuadreTanque(p: { inicialGal: number; recibidoGal: number; vendidoL: number; finalGal: number }): CuadreTanque {
  const vendidoGal = p.vendidoL / LITROS_POR_GALON;
  const teoricoGal = p.inicialGal + p.recibidoGal - vendidoGal;
  const diferenciaGal = p.finalGal - teoricoGal;
  return {
    inicialGal: r2(p.inicialGal),
    recibidoGal: r2(p.recibidoGal),
    vendidoGal: r2(vendidoGal),
    teoricoGal: r2(teoricoGal),
    finalGal: r2(p.finalGal),
    diferenciaGal: r2(diferenciaGal),
    diferenciaL: r2(diferenciaGal * LITROS_POR_GALON),
    porcentaje: vendidoGal > 0 ? Math.round((diferenciaGal / vendidoGal) * 10000) / 100 : null,
  };
}

/** Galones de una pipa: campo `gallons`, o el legado `amount` (litros) de registros anteriores. */
export const galonesPipa = (r: { gallons?: number; amount: number }) =>
  r.gallons !== undefined ? r.gallons : r.amount / LITROS_POR_GALON;

/** Galones recibidos en un tanque: `refueledGallons`, o el legado `refueledAmount` en litros. */
export const galonesRecibidos = (tk?: { refueledGallons?: number; refueledAmount?: number }) =>
  tk?.refueledGallons !== undefined ? tk.refueledGallons : (tk?.refueledAmount || 0) / LITROS_POR_GALON;
