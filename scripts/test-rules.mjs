// Pruebas de firestore.rules contra el emulador local (requiere `npm run emulators` + `npm run seed:emu`).
// Uso: npm run test:rules
const PROJECT = 'demo-uno-panel';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

async function token(email, password = 'uno12345') {
  let r = await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!r.ok) {
    r = await fetch(`${AUTH}/accounts:signUp?key=demo-api-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
  }
  const j = await r.json();
  if (!j.idToken) throw new Error(`sin token para ${email}: ${JSON.stringify(j)}`);
  return j.idToken;
}

const val = v => (typeof v === 'number' ? { doubleValue: v } : typeof v === 'string' ? { stringValue: v } : { booleanValue: v });
const body = obj => JSON.stringify({ fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, val(v)])) });

async function op(tk, method, path, data) {
  const headers = { 'Content-Type': 'application/json' };
  if (tk) headers.Authorization = `Bearer ${tk}`;
  const url = method === 'PATCH' && data ? `${FS}/${path}?${Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join('&')}` : `${FS}/${path}`;
  const r = await fetch(url, { method, headers, body: data ? body(data) : undefined });
  return r.status;
}

let fallos = 0;
function caso(nombre, status, esperaPermitido) {
  const ok = esperaPermitido ? status < 300 : status === 403;
  if (!ok) fallos++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${nombre} → HTTP ${status} (esperado ${esperaPermitido ? 'permitido' : '403'})`);
}

const hoy = new Date().toISOString().split('T')[0];
const run = Date.now();
const admin = await token('admin@uno.local');
const operador = await token('operador@uno.local');
const inactivo = await token('inactivo@uno.local');
const extrano = await token('extrano@uno.local');

// CA1: sin sesión
caso('sin sesión lee pumps', await op(null, 'GET', 'pumps/p1'), false);
caso('sin sesión escribe prices', await op(null, 'PATCH', 'prices/x', { super: 1 }), false);
// CA3: inactivo / sin ficha
caso('inactivo lee pumps', await op(inactivo, 'GET', 'pumps/p1'), false);
caso('sin ficha lee pumps', await op(extrano, 'GET', 'pumps/p1'), false);
{ const st = await op(extrano, 'GET', 'users/extrano@uno.local'); caso('sin ficha consulta su propia ficha (lectura permitida, no existe → 404)', st === 404 ? 200 : st, true); }
caso('sin ficha lee ficha ajena', await op(extrano, 'GET', 'users/admin@uno.local'), false);
caso('inactivo lee su propia ficha', await op(inactivo, 'GET', 'users/inactivo@uno.local'), true);
// CA2: operador
caso('operador lee pumps', await op(operador, 'GET', 'pumps/p1'), true);
caso('operador registra lectura', await op(operador, 'PATCH', `readings/test_op_${hoy}`, { date: hoy, initialReading: 100, finalReading: 110 }), true);
caso('operador lectura no numérica', await op(operador, 'PATCH', `readings/test_op2_${hoy}`, { date: hoy, initialReading: 'cien' }), false);
caso('operador borra lectura', await op(operador, 'DELETE', `readings/test_op_${hoy}`), false);
caso('operador guarda fondo del día', await op(operador, 'PATCH', `dayStatus/${hoy}`, { cashFund: 1500 }), true);
caso('operador edita precios', await op(operador, 'PATCH', 'prices/op_test', { super: 1 }), false);
caso('operador edita bombas', await op(operador, 'PATCH', 'pumps/p1', { name: 'X' }), false);
caso('operador crea usuario', await op(operador, 'PATCH', 'users/nuevo@uno.local', { email: 'nuevo@uno.local' }), false);
caso('operador lee auditoría', await op(operador, 'GET', 'auditLog/x'), false);
caso('operador agrega auditoría', await op(operador, 'PATCH', `auditLog/op_entry_${run}`, { action: 'x' }), true);
// CA4: admin
caso('admin crea precio', await op(admin, 'PATCH', `prices/admin_test_${run}`, { super: 37.5 }), true);
caso('admin modifica precio existente', await op(admin, 'PATCH', `prices/admin_test_${run}`, { super: 40 }), false);
caso('admin edita bombas', await op(admin, 'PATCH', 'pumps/p1', { name: 'Bomba 01' }), true);
caso('admin guarda settings', await op(admin, 'PATCH', 'settings/precios', { nota: 'x' }), true);
caso('admin lee auditoría', await op(admin, 'GET', `auditLog/op_entry_${run}`), true);
caso('admin edita auditoría', await op(admin, 'PATCH', `auditLog/op_entry_${run}`, { action: 'y' }), false);
caso('admin borra auditoría', await op(admin, 'DELETE', `auditLog/op_entry_${run}`), false);
caso('colección desconocida', await op(admin, 'GET', 'secretos/x'), false);

console.log(fallos ? `\n${fallos} caso(s) fallaron` : '\nTodas las reglas se comportan como se espera');
process.exit(fallos ? 1 : 0);
