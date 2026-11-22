import { Dispenser, Fuel, Pump } from '@/types';

export const LITERS_PER_GALLON = 3.78541;

// Precios por LITRO (todo el sistema calcula litros × precio por litro).
// Semilla = precio oficial SEN vigente del lunes 16/11/2026 en Tegucigalpa (L/galón ÷ 3.78541; Súper 142.91,
// Regular 128.05, Diésel 153.53)
// + diferencial de Guaimaca derivado del cuadro de la estación del 27/04/2026 (precio estación − SEN).
// El admin los actualiza cada semana desde "Precio del combustible" → "Consultar precio oficial".
export const DEFAULT_DIFERENCIAL_POR_LITRO = { super: 1.11, regular: 0.4, diesel: -0.29 } as const;

export const FUELS: Fuel[] = [
  { id: 'super', name: 'Súper', color: '#ef4444', price: 38.86 },
  { id: 'regular', name: 'Regular', color: '#22c55e', price: 34.23 },
  { id: 'diesel', name: 'Diésel', color: '#f59e0b', price: 40.27 },
];

const fuel = (id: string) => FUELS.find(f => f.id === id) as Fuel;

// Estación UNO Guaimaca Centro (cuadro de totalizadores): 2 bombas × 2 caras × 3 mangueras.
// Manguera 1 = Regular, 2 = Súper, 3 = Diésel.
const MANGUERAS = ['regular', 'super', 'diesel'];

function bomba(n: number): Pump {
  const id = `p${n}`;
  const name = `Bomba 0${n}`;
  return {
    id,
    name,
    isActive: true,
    fuel: fuel('regular'),
    faces: ['A', 'B'].map(face => ({
      id: face,
      dispensers: MANGUERAS.map((fid, i): Dispenser => ({
        id: `${id}-${face}-${i + 1}`,
        name: `Manguera ${i + 1}`,
        face,
        pumpId: id,
        pumpName: name,
        fuel: fid,
        fuelName: fuel(fid).name,
        fuelColor: fuel(fid).color,
        status: 'activo',
      })),
    })),
  };
}

export const INITIAL_PUMPS: Pump[] = [bomba(1), bomba(2)];

/** Primera entrada del historial de precios (por litro). */
export const PRICE_HISTORY = [
  {
    id: 'oficial-2026-11-16',
    date: '16/11/2026',
    super: 38.86,
    regular: 34.23,
    diesel: 40.27,
    registeredBy: 'Precio oficial SEN (Tegucigalpa) + diferencial Guaimaca',
  },
];

/** Productos que despacha una bomba según sus mangueras (una bomba puede tener varios). */
export const productosDeBomba = (p: Pump): Fuel[] => {
  const ids = Array.from(new Set(p.faces.flatMap(f => f.dispensers.map(d => d.fuel))));
  const lista = ids.map(id => FUELS.find(f => f.id === id)).filter((f): f is Fuel => !!f);
  return lista.length ? lista : [p.fuel];
};
