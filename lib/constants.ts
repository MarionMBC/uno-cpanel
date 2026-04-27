import { Fuel, Pump } from '@/types';

export const LITERS_PER_GALLON = 3.78541;

export const FUELS: Fuel[] = [
  { id: 'super', name: 'Súper', color: '#ef4444', price: 108.42 },
  { id: 'regular', name: 'Regular', color: '#22c55e', price: 102.18 },
  { id: 'diesel', name: 'Diésel', color: '#f59e0b', price: 96.74 },
];

export const INITIAL_PUMPS: Pump[] = [
  {
    id: 'p1',
    name: 'Bomba 01',
    isActive: true,
    fuel: FUELS[0],
    faces: [
      {
        id: 'A',
        dispensers: [
          { id: 'p1-A-1', name: 'Dispensador 1', face: 'A', pumpId: 'p1', pumpName: 'Bomba 01', fuel: 'super', fuelName: 'Súper', fuelColor: '#ef4444', status: 'activo' },
          { id: 'p1-A-2', name: 'Dispensador 2', face: 'A', pumpId: 'p1', pumpName: 'Bomba 01', fuel: 'super', fuelName: 'Súper', fuelColor: '#ef4444', status: 'activo' },
          { id: 'p1-A-3', name: 'Dispensador 3', face: 'A', pumpId: 'p1', pumpName: 'Bomba 01', fuel: 'super', fuelName: 'Súper', fuelColor: '#ef4444', status: 'activo' },
        ],
      },
      {
        id: 'B',
        dispensers: [
          { id: 'p1-B-1', name: 'Dispensador 1', face: 'B', pumpId: 'p1', pumpName: 'Bomba 01', fuel: 'super', fuelName: 'Súper', fuelColor: '#ef4444', status: 'activo' },
          { id: 'p1-B-2', name: 'Dispensador 2', face: 'B', pumpId: 'p1', pumpName: 'Bomba 01', fuel: 'super', fuelName: 'Súper', fuelColor: '#ef4444', status: 'activo' },
          { id: 'p1-B-3', name: 'Dispensador 3', face: 'B', pumpId: 'p1', pumpName: 'Bomba 01', fuel: 'super', fuelName: 'Súper', fuelColor: '#ef4444', status: 'activo' },
        ],
      },
    ],
  },
  {
    id: 'p2',
    name: 'Bomba 02',
    isActive: true,
    fuel: FUELS[1],
    faces: [
      {
        id: 'A',
        dispensers: [
          { id: 'p2-A-1', name: 'Dispensador 1', face: 'A', pumpId: 'p2', pumpName: 'Bomba 02', fuel: 'regular', fuelName: 'Regular', fuelColor: '#22c55e', status: 'activo' },
          { id: 'p2-A-2', name: 'Dispensador 2', face: 'A', pumpId: 'p2', pumpName: 'Bomba 02', fuel: 'regular', fuelName: 'Regular', fuelColor: '#22c55e', status: 'activo' },
          { id: 'p2-A-3', name: 'Dispensador 3', face: 'A', pumpId: 'p2', pumpName: 'Bomba 02', fuel: 'regular', fuelName: 'Regular', fuelColor: '#22c55e', status: 'mantenimiento' },
        ],
      },
      {
        id: 'B',
        dispensers: [
          { id: 'p2-B-1', name: 'Dispensador 1', face: 'B', pumpId: 'p2', pumpName: 'Bomba 02', fuel: 'regular', fuelName: 'Regular', fuelColor: '#22c55e', status: 'activo' },
          { id: 'p2-B-2', name: 'Dispensador 2', face: 'B', pumpId: 'p2', pumpName: 'Bomba 02', fuel: 'regular', fuelName: 'Regular', fuelColor: '#22c55e', status: 'activo' },
          { id: 'p2-B-3', name: 'Dispensador 3', face: 'B', pumpId: 'p2', pumpName: 'Bomba 02', fuel: 'regular', fuelName: 'Regular', fuelColor: '#22c55e', status: 'activo' },
        ],
      },
    ],
  },
  {
    id: 'p3',
    name: 'Bomba 03',
    isActive: false,
    fuel: FUELS[2],
    faces: [
      {
        id: 'A',
        dispensers: [
          { id: 'p3-A-1', name: 'Dispensador 1', face: 'A', pumpId: 'p3', pumpName: 'Bomba 03', fuel: 'diesel', fuelName: 'Diésel', fuelColor: '#f59e0b', status: 'activo' },
          { id: 'p3-A-2', name: 'Dispensador 2', face: 'A', pumpId: 'p3', pumpName: 'Bomba 03', fuel: 'diesel', fuelName: 'Diésel', fuelColor: '#f59e0b', status: 'activo' },
          { id: 'p3-A-3', name: 'Dispensador 3', face: 'A', pumpId: 'p3', pumpName: 'Bomba 03', fuel: 'diesel', fuelName: 'Diésel', fuelColor: '#f59e0b', status: 'activo' },
        ],
      },
      {
        id: 'B',
        dispensers: [
          { id: 'p3-B-1', name: 'Dispensador 1', face: 'B', pumpId: 'p3', pumpName: 'Bomba 03', fuel: 'diesel', fuelName: 'Diésel', fuelColor: '#f59e0b', status: 'activo' },
          { id: 'p3-B-2', name: 'Dispensador 2', face: 'B', pumpId: 'p3', pumpName: 'Bomba 03', fuel: 'diesel', fuelName: 'Diésel', fuelColor: '#f59e0b', status: 'activo' },
          { id: 'p3-B-3', name: 'Dispensador 3', face: 'B', pumpId: 'p3', pumpName: 'Bomba 03', fuel: 'diesel', fuelName: 'Diésel', fuelColor: '#f59e0b', status: 'activo' },
        ],
      },
    ],
  },
];

export const AUDIT_LOG_INITIAL = [
  { id: 'a1', timestamp: '06:42', date: '26/04/2026', userName: 'Marlon Aguilar', userRole: 'Operador', action: 'Lectura inicial', target: 'Bomba 01 · Cara A · D1', detail: 'Registrada en 142,318.42 L', icon: 'log-in' },
  { id: 'a2', timestamp: '06:43', date: '26/04/2026', userName: 'Marlon Aguilar', userRole: 'Operador', action: 'Lectura inicial', target: 'Bomba 01 · Cara A · D2', detail: 'Registrada en 138,902.10 L', icon: 'log-in' },
  { id: 'a3', timestamp: '06:51', date: '26/04/2026', userName: 'Marlon Aguilar', userRole: 'Operador', action: 'Lectura inicial', target: 'Bomba 02 · Cara B · D3', detail: 'Estado: mantenimiento', icon: 'wrench' },
  { id: 'a4', timestamp: '07:05', date: '26/04/2026', userName: 'Cinthia López', userRole: 'Admin', action: 'Precio actualizado', target: 'Súper', detail: 'L. 107.10 → L. 108.42', icon: 'tag' },
  { id: 'a5', timestamp: '07:06', date: '26/04/2026', userName: 'Cinthia López', userRole: 'Admin', action: 'Precio actualizado', target: 'Regular', detail: 'L. 101.55 → L. 102.18', icon: 'tag' },
  { id: 'a6', timestamp: '14:18', date: '25/04/2026', userName: 'Daniel Ortez', userRole: 'Supervisor', action: 'Lectura final', target: 'Bomba 02 · Cara A · D1', detail: '+312.40 L · L. 31,919.95', icon: 'log-out' },
  { id: 'a7', timestamp: '14:32', date: '25/04/2026', userName: 'Daniel Ortez', userRole: 'Supervisor', action: 'Cierre del día', target: '25/04/2026', detail: 'Total L. 412,860.71', icon: 'lock' },
  { id: 'a8', timestamp: '08:14', date: '25/04/2026', userName: 'Marlon Aguilar', userRole: 'Operador', action: 'Edición', target: 'Bomba 01 · Cara A · D2', detail: 'Lectura inicial 138,118 → 138,902', icon: 'edit' },
];

export const PRICE_HISTORY = [
  { id: 'ph1', date: '26/04/2026', super: 108.42, regular: 102.18, diesel: 96.74, registeredBy: 'Cinthia López' },
  { id: 'ph2', date: '20/04/2026', super: 107.10, regular: 101.55, diesel: 95.90, registeredBy: 'Cinthia López' },
  { id: 'ph3', date: '13/04/2026', super: 106.74, regular: 100.82, diesel: 95.41, registeredBy: 'Cinthia López' },
  { id: 'ph4', date: '06/04/2026', super: 105.22, regular: 99.65, diesel: 94.18, registeredBy: 'Daniel Ortez' },
  { id: 'ph5', date: '30/03/2026', super: 104.10, regular: 98.40, diesel: 93.05, registeredBy: 'Cinthia López' },
];
