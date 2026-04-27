// data.jsx — mock state for the prototype
// All numbers in lempiras / liters / gallons. Fuel prices are per liter.

const LITERS_PER_GALLON = 3.78541;

const fmtL = (n) =>
  'L. ' + Number(n || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n, d = 2) =>
  Number(n || 0).toLocaleString('es-HN', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = (n) => Number(n || 0).toLocaleString('es-HN');

// ─── seeded RNG so the prototype is deterministic ────────────────────────────
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FUELS = [
  { id: 'super', name: 'Súper', color: '#ef4444', price: 108.42 },
  { id: 'regular', name: 'Regular', color: '#22c55e', price: 102.18 },
  { id: 'diesel', name: 'Diésel', color: '#f59e0b', price: 96.74 },
];

function makePump(id, name, fuel, seed, isActive = true) {
  const rng = mulberry32(seed);
  const faces = ['A', 'B'].map((face) => ({
    id: face,
    dispensers: [1, 2, 3].map((d) => {
      const initial = Math.floor(120000 + rng() * 60000);
      const liters = Math.floor(180 + rng() * 320);
      return {
        id: `${id}-${face}-${d}`,
        name: `Dispensador ${d}`,
        face,
        pumpId: id,
        pumpName: name,
        fuel: fuel.id,
        fuelName: fuel.name,
        fuelColor: fuel.color,
        status: rng() > 0.92 ? 'mantenimiento' : 'activo',
        initial,
        final: initial + liters,
        liters,
        observations: '',
      };
    }),
  }));
  return { id, name, isActive, fuel, faces };
}

const PUMPS = [
  makePump('p1', 'Bomba 01', FUELS[0], 11),
  makePump('p2', 'Bomba 02', FUELS[1], 27),
  makePump('p3', 'Bomba 03', FUELS[2], 53, false),
];

// flatten readings
function flatReadings(pumps) {
  const rows = [];
  pumps.forEach((p) =>
    p.faces.forEach((f) =>
      f.dispensers.forEach((d) => rows.push({ ...d, pumpName: p.name, pumpActive: p.isActive }))
    )
  );
  return rows;
}

// ─── audit log entries ──────────────────────────────────────────────────────
const AUDIT_LOG = [
  { id: 'a1', t: '06:42', date: '26/04/2026', user: 'Marlon Aguilar', role: 'Operador', action: 'Lectura inicial', target: 'Bomba 01 · Cara A · D1', detail: 'Registrada en 142,318.42 L', icon: 'log-in' },
  { id: 'a2', t: '06:43', date: '26/04/2026', user: 'Marlon Aguilar', role: 'Operador', action: 'Lectura inicial', target: 'Bomba 01 · Cara A · D2', detail: 'Registrada en 138,902.10 L', icon: 'log-in' },
  { id: 'a3', t: '06:51', date: '26/04/2026', user: 'Marlon Aguilar', role: 'Operador', action: 'Lectura inicial', target: 'Bomba 02 · Cara B · D3', detail: 'Estado: mantenimiento', icon: 'wrench' },
  { id: 'a4', t: '07:05', date: '26/04/2026', user: 'Cinthia López', role: 'Admin', action: 'Precio actualizado', target: 'Súper', detail: 'L. 107.10 → L. 108.42', icon: 'tag' },
  { id: 'a5', t: '07:06', date: '26/04/2026', user: 'Cinthia López', role: 'Admin', action: 'Precio actualizado', target: 'Regular', detail: 'L. 101.55 → L. 102.18', icon: 'tag' },
  { id: 'a6', t: '14:18', date: '25/04/2026', user: 'Daniel Ortez', role: 'Supervisor', action: 'Lectura final', target: 'Bomba 02 · Cara A · D1', detail: '+312.40 L · L. 31,919.95', icon: 'log-out' },
  { id: 'a7', t: '14:32', date: '25/04/2026', user: 'Daniel Ortez', role: 'Supervisor', action: 'Cierre del día', target: '25/04/2026', detail: 'Total L. 412,860.71', icon: 'lock' },
  { id: 'a8', t: '08:14', date: '25/04/2026', user: 'Marlon Aguilar', role: 'Operador', action: 'Edición', target: 'Bomba 01 · Cara A · D2', detail: 'Lectura inicial 138,118 → 138,902', icon: 'edit' },
];

// ─── 14-day sales history for trend sparklines ──────────────────────────────
const TREND_14D = (() => {
  const r = mulberry32(7);
  const arr = [];
  for (let i = 13; i >= 0; i--) {
    arr.push({
      day: i,
      liters: Math.floor(2400 + r() * 1200),
      lempiras: Math.floor(240000 + r() * 140000),
    });
  }
  return arr;
})();

const USERS = [
  { id: 'u1', name: 'Marlon Aguilar', email: 'marlon@unoguaimaca.hn', role: 'Operador', initials: 'MA', color: '#f59e0b' },
  { id: 'u2', name: 'Cinthia López', email: 'cinthia@unoguaimaca.hn', role: 'Admin', initials: 'CL', color: '#3b82f6' },
  { id: 'u3', name: 'Daniel Ortez', email: 'daniel@unoguaimaca.hn', role: 'Supervisor', initials: 'DO', color: '#10b981' },
];

Object.assign(window, {
  LITERS_PER_GALLON, fmtL, fmtNum, fmtInt,
  FUELS, PUMPS, flatReadings, AUDIT_LOG, TREND_14D, USERS,
});
