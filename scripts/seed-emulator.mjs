// Siembra datos de ejemplo en los emuladores LOCALES de Firebase (nunca en producción).
// Uso: `npm run emulators` en otra terminal, luego `npm run seed:emu`.
// Datos: estación con 2 bombas × 2 caras × 3 mangueras (Diésel, Súper, Regular),
// lecturas iniciales del cuadro de totalizadores del 27/04/2026 y precios por litro
// 34.05 / 37.76 / 37.06 (la app guarda y calcula precio por litro).

const PROJECT = 'demo-uno-panel';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099';
const LITERS_PER_GALLON = 3.78541;

// Credenciales FALSAS, solo existen en el emulador local.
export const SEED_USER = { email: 'admin@uno.local', password: 'uno12345', name: 'Admin Local' };
const EXTRA_USERS = [
  { email: 'operador@uno.local', password: 'uno12345', name: 'Operador Uno', roleId: 'operador', status: 'activo' },
  { email: 'operador2@uno.local', password: 'uno12345', name: 'Operador Dos', roleId: 'operador', status: 'activo' },
  { email: 'inactivo@uno.local', password: 'uno12345', name: 'Usuario Inactivo', roleId: 'operador', status: 'inactivo' },
];

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
}

async function setDoc(path, data) {
  const res = await fetch(`${FS}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) }),
  });
  if (!res.ok) throw new Error(`setDoc ${path}: ${res.status} ${await res.text()}`);
}

async function ensureAuthUser({ email, password, name }) {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName: name, returnSecureToken: false }),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (!txt.includes('EMAIL_EXISTS')) throw new Error(`signUp ${email}: ${res.status} ${txt}`);
  }
}

const FUELS = {
  diesel: { id: 'diesel', name: 'Diésel', color: '#f59e0b', pricePerLiter: 34.05 },
  super: { id: 'super', name: 'Súper', color: '#ef4444', pricePerLiter: 37.76 },
  regular: { id: 'regular', name: 'Regular', color: '#22c55e', pricePerLiter: 37.06 },
};
const HOSE_FUEL = ['diesel', 'super', 'regular']; // manguera 1, 2, 3

// Lecturas iniciales del correo "cuadro de totalizadores" (27/04/2026), en litros.
// Clave: `${bomba}-${cara}-${manguera}`.
const INITIAL = {
  '1-1-1': 751432.037, '1-1-2': 1298024.048, '1-1-3': 1682312.613,
  '1-2-1': 755626.271, '1-2-2': 1520025.384, '1-2-3': 1641699.83,
  '2-1-1': 1101668.905, '2-1-2': 1069988.068, '2-1-3': 1482017.608,
  '2-2-1': 2239220.802, '2-2-2': 1281141.406, '2-2-3': 2313465.657,
};
// Litros vendidos de ejemplo; null = lectura final pendiente.
const SOLD = {
  '1-1-1': 412.5, '1-1-2': 268.75, '1-1-3': 190.2,
  '1-2-1': 377.1, '1-2-2': 301.4, '1-2-3': 155.9,
  '2-1-1': 289.0, '2-1-2': 344.65, '2-1-3': 120.3,
  '2-2-1': 455.8, '2-2-2': 233.15, '2-2-3': null,
};

function buildPumps() {
  return [1, 2].map(b => {
    const pumpId = `p${b}`;
    const pumpName = `Bomba 0${b}`;
    return {
      id: pumpId,
      name: pumpName,
      isActive: true,
      fuel: { id: 'diesel', name: 'Diésel', color: '#f59e0b', price: FUELS.diesel.pricePerLiter },
      faces: ['A', 'B'].map((face, fi) => ({
        id: face,
        dispensers: HOSE_FUEL.map((fid, hi) => ({
          id: `${pumpId}-${face}-${hi + 1}`,
          name: `Manguera ${hi + 1}`,
          face,
          pumpId,
          pumpName,
          fuel: fid,
          fuelName: FUELS[fid].name,
          fuelColor: FUELS[fid].color,
          status: 'activo',
          serialNumber: `${b}-${fi + 1}-${hi + 1}`,
        })),
      })),
    };
  });
}

async function main() {
  const today = new Date().toISOString().split('T')[0]; // misma convención que AppContext
  const pricePerLiter = Object.fromEntries(Object.values(FUELS).map(f => [f.id, f.pricePerLiter]));

  await ensureAuthUser(SEED_USER);
  await setDoc(`users/${SEED_USER.email}`, { email: SEED_USER.email, name: SEED_USER.name, roleId: 'admin', status: 'activo' });
  for (const u of EXTRA_USERS) {
    await ensureAuthUser(u);
    await setDoc(`users/${u.email}`, { email: u.email, name: u.name, roleId: u.roleId, status: u.status });
  }
  await setDoc('roles/admin', {
    id: 'admin', name: 'Administrador',
    permissions: { canManageUsers: true, canManagePumps: true, canCloseDay: true, canEditPrices: true, canViewAudit: true, canManageInventory: true },
  });
  await setDoc('roles/operador', {
    id: 'operador', name: 'Operador',
    permissions: { canManageUsers: false, canManagePumps: false, canCloseDay: true, canEditPrices: false, canViewAudit: false, canManageInventory: true },
  });

  for (const p of buildPumps()) await setDoc(`pumps/${p.id}`, p);

  await setDoc('prices/seed_local', {
    date: today.split('-').reverse().join('/'),
    ...pricePerLiter,
    registeredBy: 'Semilla local',
    timestamp: Date.now(),
  });

  // Tanques: Diésel y Súper por varilla (pulgadas → galones de la tabla de calibración);
  // Regular sin tabla, en galones. Una pipa de Súper de 1000 gal.
  await setDoc(`dayStatus/${today}`, {
    date: today,
    status: 'en_proceso',
    cashFund: 1500,
    tanks: {
      diesel: { initialInches: 45.5, initialGallons: 3362, finalInches: 40.75, finalGallons: 2947, refueledAmount: 0 },
      super: { initialInches: 38.25, initialGallons: 2775, finalInches: 46, finalGallons: 3463, refueledAmount: 1000 },
      regular: { initialGallons: 2800, finalGallons: 2672, refueledAmount: 0 },
    },
    receipts: [
      { id: 'rec-seed-1', fuelId: 'super', fuelName: 'Súper', amount: 1000, invoice: '001-001-01-00017456', plate: 'C 123456', driver: 'Conductor de prueba', timestamp: new Date().toISOString() },
    ],
  });

  for (const [key, initial] of Object.entries(INITIAL)) {
    const [b, c, h] = key.split('-').map(Number);
    const pumpId = `p${b}`;
    const face = c === 1 ? 'A' : 'B';
    const fid = HOSE_FUEL[h - 1];
    const sold = SOLD[key];
    const reading = {
      date: today,
      dispenserId: `${pumpId}-${face}-${h}`,
      dispenserName: `Manguera ${h}`,
      face,
      pumpId,
      pumpName: `Bomba 0${b}`,
      fuelId: fid,
      fuelName: FUELS[fid].name,
      fuelPrice: pricePerLiter[fid],
      initialReading: initial,
      status: 'activo',
      createdBy: SEED_USER.name,
      createdAt: new Date().toISOString(),
    };
    if (sold !== null) {
      const gallons = sold / LITERS_PER_GALLON;
      Object.assign(reading, {
        finalReading: +(initial + sold).toFixed(3),
        liters: sold,
        gallons,
        total: +(sold * pricePerLiter[fid]).toFixed(2),
      });
    }
    await setDoc(`readings/${today}_${pumpId}-${face}-${h}`, reading);
  }

  console.log(`Semilla lista (${today}). Usuarios: ${[SEED_USER, ...EXTRA_USERS].map(u => u.email).join(', ')} · clave ${SEED_USER.password}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
