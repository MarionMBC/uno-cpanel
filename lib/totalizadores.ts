// Cálculo del cuadro de totalizadores (formato del correo diario de la estación).
// Función pura y sin imports de runtime: se prueba con `npm test`.
import type { DailyReading, Pump } from '../types';

export type EstadoFila = 'ok' | 'pendiente' | 'sin_inicial' | 'invalida' | 'mantenimiento';

export interface FilaCuadro {
  key: string;
  pumpId: string;
  pumpName: string;
  pumpNumber: number;
  cara: number;
  manguera: number;
  /** Etiqueta estilo hoja de Tito: `cara-manguera` dentro de cada bomba. */
  label: string;
  fuelId: string;
  fuelName: string;
  fuelColor: string;
  inicial: number | null;
  final: number | null;
  litros: number;
  /** Lempiras por litro. */
  precio: number;
  total: number;
  estado: EstadoFila;
  /** Litros calculados con vuelta a cero del totalizador. */
  rollover?: boolean;
  /** La inicial no coincide con la final anterior (con motivo). */
  continuityBreak?: boolean;
}

export interface GrupoBomba {
  pumpId: string;
  pumpName: string;
  filas: FilaCuadro[];
  litros: number;
  total: number;
}

export interface ResumenProducto {
  fuelId: string;
  fuelName: string;
  fuelColor: string;
  litros: number;
  total: number;
}

export interface Cuadro {
  grupos: GrupoBomba[];
  productos: ResumenProducto[];
  litros: number;
  total: number;
  pendientes: number;
  invalidas: number;
  sinInicial: number;
}

export type PreciosPorLitro = Record<string, number>;

// Redondeo comercial (half-up) robusto a errores binarios: 412.5 × 34.05 = 14045.624999… → 14045.63.
export const round = (n: number, d: number) => {
  const limpio = Number(n.toFixed(9));
  if (Math.abs(limpio) < 1e-6) return 0; // evita notación exponencial ('1e-7e2' = NaN)
  return Number(Math.round(Number(`${limpio}e${d}`)) + `e-${d}`);
};

function numeroDe(texto: string, fallback: number): number {
  const m = /(\d+)\s*$/.exec(texto);
  return m ? Number(m[1]) : fallback;
}

// ─── Identidad de lecturas (A3) ──────────────────────────────────────────────

/** ID determinista: una lectura por dispensador y día operativo. */
export const idLectura = (fecha: string, dispenserId: string) => `${fecha}_${dispenserId}`;

/**
 * Una lectura por dispensador. Manda la de ID determinista; si solo hay lecturas viejas con ID
 * aleatorio (antes de A3), manda la primera que llegó (mismo criterio que antes en todas las pantallas).
 */
export function lecturasPorDispensador<T extends Pick<DailyReading, 'id' | 'date' | 'dispenserId'>>(readings: T[]): Map<string, T> {
  const m = new Map<string, T>();
  readings.forEach(r => {
    const actual = m.get(r.dispenserId);
    if (!actual) m.set(r.dispenserId, r);
    else if (actual.id !== idLectura(actual.date, actual.dispenserId) && r.id === idLectura(r.date, r.dispenserId)) m.set(r.dispenserId, r);
  });
  return m;
}

// ─── Cálculo único de venta (A4) y vuelta a cero (A7) ────────────────────────

/** Máximo del totalizador por defecto (6 enteros, 3 decimales). */
export const METER_MAX_DEFAULT = 999999.999;

/**
 * Litros entre inicial y final, o null si no cuadran.
 * - Normal: final − inicial (final ≥ inicial).
 * - Rollover (el totalizador pasó por cero): final + meterMax − inicial.
 *   Ej.: inicial 999850, final 120, meterMax 999999.999 → 270 L (aprox.: el valor exacto suma la resolución, 0.001 L).
 *   Solo es válido si final < inicial (si no, no hubo vuelta).
 */
export function litrosEntre(inicial: number, final: number, rollover = false, meterMax = METER_MAX_DEFAULT): number | null {
  if (rollover) {
    if (final >= inicial || inicial > meterMax) return null;
    return round(final + meterMax - inicial, 3);
  }
  if (final < inicial) return null;
  return round(final - inicial, 3);
}

export type LecturaVenta = Pick<DailyReading, 'fuelId' | 'fuelPrice' | 'initialReading' | 'finalReading' | 'status' | 'rollover' | 'meterMax'>;

export interface Venta {
  estado: 'ok' | 'pendiente' | 'invalida' | 'mantenimiento';
  litros: number;
  /** Lempiras por litro: el de la lectura (fijado al abrir) y el vigente solo si falta. */
  precio: number;
  /** round(litros × precio, 2). */
  total: number;
}

/** Único cálculo de venta de una lectura. Lo usan Lectura final, Dashboard, Cuadro y (luego) Reportes. */
export function calcVenta(r: LecturaVenta, precios: PreciosPorLitro): Venta {
  const precio = r.fuelPrice > 0 ? r.fuelPrice : precios[r.fuelId] || 0;
  if (r.status === 'mantenimiento') return { estado: 'mantenimiento', litros: 0, precio, total: 0 };
  if (r.finalReading === undefined || r.finalReading === null || Number.isNaN(r.finalReading)) return { estado: 'pendiente', litros: 0, precio, total: 0 };
  const litros = litrosEntre(r.initialReading, r.finalReading, r.rollover === true, r.meterMax ?? METER_MAX_DEFAULT);
  if (litros === null) return { estado: 'invalida', litros: 0, precio, total: 0 };
  return { estado: 'ok', litros, precio, total: round(litros * precio, 2) };
}

// ─── Continuidad (A8) ─────────────────────────────────────────────────────────

/**
 * Última lectura final conocida del dispensador en una fecha anterior a `fecha`.
 * Ignora mantenimiento (su totalizador no es fiable) y lecturas sin final.
 */
export function finalAnterior(readings: Pick<DailyReading, 'date' | 'dispenserId' | 'finalReading' | 'status'>[], dispenserId: string, fecha: string): { fecha: string; valor: number } | null {
  let mejor: { fecha: string; valor: number } | null = null;
  readings.forEach(r => {
    if (r.dispenserId !== dispenserId || r.date >= fecha || r.status === 'mantenimiento') return;
    if (r.finalReading === undefined || r.finalReading === null) return;
    if (!mejor || r.date > mejor.fecha) mejor = { fecha: r.date, valor: r.finalReading };
  });
  return mejor;
}

/** Hay ruptura de continuidad si se conoce la final anterior y la inicial difiere de ella. */
export const rompeContinuidad = (inicial: number, anterior: number | null | undefined) =>
  anterior !== null && anterior !== undefined && round(inicial, 3) !== round(anterior, 3);

// ─── Cuadro ───────────────────────────────────────────────────────────────────

const caraDe = (face: string, fallback: number) => {
  const t = (face || '').trim().toUpperCase();
  if (/^[A-Z]$/.test(t)) return t.charCodeAt(0) - 64;
  return numeroDe(t, fallback);
};

export interface OpcionesCuadro {
  /**
   * Fecha pasada: las filas salen de las lecturas de esa fecha (traen pumpName/face/fuelId),
   * no de la configuración actual. Una bomba inactiva o borrada hoy no oculta ventas pasadas.
   */
  historico?: boolean;
}

export function buildCuadro(pumps: Pump[], readings: DailyReading[], precios: PreciosPorLitro, opts: OpcionesCuadro = {}): Cuadro {
  const porDispensador = lecturasPorDispensador(readings);
  const productos = new Map<string, ResumenProducto>();
  const usadas = new Set<string>();

  // Colores y nombres de la configuración actual (solo cosmético en el histórico).
  const config = new Map<string, { pump: Pump; color: string; fuelName: string }>();
  pumps.forEach(p => p.faces.forEach(f => f.dispensers.forEach(d => config.set(d.id, { pump: p, color: d.fuelColor, fuelName: d.fuelName }))));

  const ordenadas = [...pumps].sort((a, b) => numeroDe(a.name, 0) - numeroDe(b.name, 0) || a.id.localeCompare(b.id));
  const gruposMap = new Map<string, GrupoBomba & { pumpNumber: number }>();
  const grupo = (pumpId: string, pumpName: string, pumpNumber: number) => {
    let g = gruposMap.get(pumpId);
    if (!g) { g = { pumpId, pumpName, pumpNumber, filas: [], litros: 0, total: 0 }; gruposMap.set(pumpId, g); }
    return g;
  };

  const fila = (base: Omit<FilaCuadro, 'litros' | 'precio' | 'total' | 'estado'>, r: DailyReading | undefined, forzarMant: boolean): FilaCuadro => {
    let estado: EstadoFila;
    let litros = 0, precio = precios[base.fuelId] || 0, total = 0;
    if (r) {
      const v = calcVenta(r, precios);
      precio = v.precio;
      estado = forzarMant ? 'mantenimiento' : v.estado;
      if (estado === 'ok') { litros = v.litros; total = v.total; }
    } else {
      estado = forzarMant ? 'mantenimiento' : 'sin_inicial';
    }
    const f: FilaCuadro = { ...base, litros, precio, total, estado };
    if (estado === 'ok') {
      const p = productos.get(f.fuelId) || { fuelId: f.fuelId, fuelName: f.fuelName, fuelColor: f.fuelColor, litros: 0, total: 0 };
      p.litros = round(p.litros + litros, 3);
      p.total = round(p.total + total, 2);
      productos.set(f.fuelId, p);
    }
    return f;
  };

  const baseDeLectura = (r: DailyReading, pumpNumber: number) => {
    const c = config.get(r.dispenserId);
    const cara = caraDe(r.face, 1);
    const manguera = numeroDe(r.dispenserName, 1);
    return {
      key: r.dispenserId, pumpId: r.pumpId, pumpName: r.pumpName || c?.pump.name || r.pumpId, pumpNumber, cara, manguera,
      label: `${cara}-${manguera}`, fuelId: r.fuelId, fuelName: r.fuelName || c?.fuelName || r.fuelId, fuelColor: c?.color || '#64748b',
      inicial: r.initialReading, final: r.finalReading ?? null,
      rollover: r.rollover === true, continuityBreak: r.continuityBreak === true,
    };
  };

  if (!opts.historico) {
    ordenadas.forEach((pump, pi) => {
      const pumpNumber = numeroDe(pump.name, pi + 1);
      const g = grupo(pump.id, pump.name, pumpNumber);
      pump.faces.forEach((face, fi) => {
        face.dispensers.forEach((d, di) => {
          const r = porDispensador.get(d.id);
          // Inactivo sin lectura no se muestra; con lectura del día sí (no ocultar ventas).
          if (d.status === 'inactivo' && !r) return;
          if (r) usadas.add(d.id);
          const cara = fi + 1;
          const manguera = numeroDe(d.name, di + 1);
          const fuelId = r?.fuelId || d.fuel;
          g.filas.push(fila({
            key: d.id, pumpId: pump.id, pumpName: pump.name, pumpNumber, cara, manguera, label: `${cara}-${manguera}`,
            fuelId, fuelName: r?.fuelName || d.fuelName, fuelColor: d.fuelColor,
            inicial: r ? r.initialReading : null, final: r?.finalReading ?? null,
            rollover: r?.rollover === true, continuityBreak: r?.continuityBreak === true,
          }, r, !pump.isActive || d.status === 'mantenimiento'));
        });
      });
    });
  }

  // Lecturas sin dispensador en la configuración (histórico, o borrado/movido hoy): fila desde la lectura.
  porDispensador.forEach(r => {
    if (usadas.has(r.dispenserId)) return;
    const pumpNumber = numeroDe(r.pumpName || '', 99);
    const g = grupo(r.pumpId || r.pumpName, r.pumpName || r.pumpId, pumpNumber);
    g.filas.push(fila(baseDeLectura(r, pumpNumber), r, false));
  });

  const grupos: GrupoBomba[] = [...gruposMap.values()]
    .filter(g => g.filas.length > 0 || !opts.historico)
    .sort((a, b) => a.pumpNumber - b.pumpNumber || a.pumpId.localeCompare(b.pumpId))
    .map(({ pumpNumber: _n, ...g }) => {
      g.filas.sort((a, b) => a.cara - b.cara || a.manguera - b.manguera);
      return {
        ...g,
        litros: round(g.filas.reduce((s, f) => s + f.litros, 0), 3),
        total: round(g.filas.reduce((s, f) => s + f.total, 0), 2),
      };
    });

  const todas = grupos.flatMap(g => g.filas);
  return {
    grupos,
    productos: [...productos.values()],
    litros: round(grupos.reduce((s, g) => s + g.litros, 0), 3),
    total: round(grupos.reduce((s, g) => s + g.total, 0), 2),
    pendientes: todas.filter(f => f.estado === 'pendiente').length,
    invalidas: todas.filter(f => f.estado === 'invalida').length,
    sinInicial: todas.filter(f => f.estado === 'sin_inicial').length,
  };
}

/** Filas (array de arrays) para exportar a Excel con el layout del cuadro de Tito. */
export function cuadroAoa(cuadro: Cuadro, opts: { fecha: string; responsable: string; fondoCambio: number }): (string | number)[][] {
  const aoa: (string | number)[][] = [
    [opts.fecha, opts.responsable, '', 'CAMBIO', opts.fondoCambio, ''],
    ['MANGUERA', 'LECTURA INICIAL', 'LECTURA FINAL', 'LITROS', 'PRECIO', 'TOTAL LPS'],
  ];
  cuadro.grupos.forEach((g, i) => {
    if (i > 0) aoa.push(['', '', '', '', '', '']);
    aoa.push([g.pumpName.toUpperCase(), '', '', '', '', '']);
    g.filas.forEach(f => {
      const estadoTxt = f.estado === 'ok' ? f.litros
        : f.estado === 'pendiente' ? 'PENDIENTE'
        : f.estado === 'invalida' ? 'FINAL < INICIAL'
        : f.estado === 'mantenimiento' ? 'MANTENIMIENTO' : 'SIN LECTURA';
      aoa.push([
        `${f.label} ${f.fuelName}`,
        f.inicial ?? '',
        f.final ?? '',
        estadoTxt,
        f.precio,
        f.estado === 'ok' ? f.total : '',
      ]);
    });
    aoa.push(['', '', '', `SUBTOTAL ${g.pumpName.toUpperCase()}`, '', g.total]);
  });
  aoa.push(['', '', '', '', '', '']);
  cuadro.productos.forEach(p => aoa.push(['', '', p.fuelName.toUpperCase(), p.litros, '', p.total]));
  aoa.push(['', '', '', '', 'TOTAL', cuadro.total]);
  aoa.push(['', '', '', '', 'CAMBIO', opts.fondoCambio]);
  aoa.push(['', '', '', '', 'TOTAL EN CAJA', round(cuadro.total + opts.fondoCambio, 2)]);
  return aoa;
}
