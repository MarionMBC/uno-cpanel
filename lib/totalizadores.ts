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

export function buildCuadro(pumps: Pump[], readings: DailyReading[], precios: PreciosPorLitro): Cuadro {
  // Si hubiera lecturas duplicadas de una manguera, manda la primera (mismo criterio que Lectura final).
  const porDispensador = new Map<string, DailyReading>();
  readings.forEach(r => { if (!porDispensador.has(r.dispenserId)) porDispensador.set(r.dispenserId, r); });
  const productos = new Map<string, ResumenProducto>();

  const ordenadas = [...pumps].sort((a, b) => numeroDe(a.name, 0) - numeroDe(b.name, 0) || a.id.localeCompare(b.id));

  const grupos: GrupoBomba[] = ordenadas.map((pump, pi) => {
    const pumpNumber = numeroDe(pump.name, pi + 1);
    const filas: FilaCuadro[] = [];

    pump.faces.forEach((face, fi) => {
      face.dispensers.forEach((d, di) => {
        if (d.status === 'inactivo') return;
        const cara = fi + 1;
        const manguera = numeroDe(d.name, di + 1);
        const r = porDispensador.get(d.id);
        const fuelId = r?.fuelId || d.fuel;
        const precio = r && r.fuelPrice > 0 ? r.fuelPrice : precios[fuelId] || 0;
        const inicial = r ? r.initialReading : null;
        const final = r && r.finalReading !== undefined && r.finalReading !== null ? r.finalReading : null;

        let estado: EstadoFila;
        if (!pump.isActive || d.status === 'mantenimiento' || r?.status === 'mantenimiento') estado = 'mantenimiento';
        else if (inicial === null) estado = 'sin_inicial';
        else if (final === null) estado = 'pendiente';
        else if (final < inicial) estado = 'invalida';
        else estado = 'ok';

        const litros = estado === 'ok' ? round((final as number) - (inicial as number), 3) : 0;
        const total = round(litros * precio, 2);

        filas.push({
          key: d.id,
          pumpId: pump.id,
          pumpName: pump.name,
          pumpNumber,
          cara,
          manguera,
          label: `${cara}-${manguera}`,
          fuelId,
          fuelName: r?.fuelName || d.fuelName,
          fuelColor: d.fuelColor,
          inicial,
          final,
          litros,
          precio,
          total,
          estado,
        });

        if (estado === 'ok') {
          const p = productos.get(fuelId) || { fuelId, fuelName: r?.fuelName || d.fuelName, fuelColor: d.fuelColor, litros: 0, total: 0 };
          p.litros = round(p.litros + litros, 3);
          p.total = round(p.total + total, 2);
          productos.set(fuelId, p);
        }
      });
    });

    filas.sort((a, b) => a.cara - b.cara || a.manguera - b.manguera);
    return {
      pumpId: pump.id,
      pumpName: pump.name,
      filas,
      litros: round(filas.reduce((s, f) => s + f.litros, 0), 3),
      total: round(filas.reduce((s, f) => s + f.total, 0), 2),
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
