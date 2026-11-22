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
  uids[email] = j.localId;
  return j.idToken;
}
const uids = {};

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
const futuro = '2099-12-31'; // las pruebas no escriben en el día operativo real
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
caso('operador registra lectura', await op(operador, 'PATCH', `readings/test_op_${futuro}`, { date: futuro, initialReading: 100, finalReading: 110 }), true);
caso('operador lectura no numérica', await op(operador, 'PATCH', `readings/test_op2_${futuro}`, { date: futuro, initialReading: 'cien' }), false);
caso('operador borra lectura', await op(operador, 'DELETE', `readings/test_op_${futuro}`), false);
caso('operador guarda fondo del día', await op(operador, 'PATCH', `dayStatus/${hoy}`, { cashFund: 1500 }), true);
caso('operador edita precios', await op(operador, 'PATCH', 'prices/op_test', { super: 1 }), false);
caso('operador edita bombas', await op(operador, 'PATCH', 'pumps/p1', { name: 'X' }), false);
caso('operador crea usuario', await op(operador, 'PATCH', 'users/nuevo@uno.local', { email: 'nuevo@uno.local' }), false);
caso('operador lee auditoría', await op(operador, 'GET', 'auditLog/x'), false);
caso('operador agrega auditoría', await op(operador, 'PATCH', `auditLog/op_entry_${run}`, { action: 'x', userId: uids['operador@uno.local'], userName: 'Operador Uno' }), true);
// CA4: admin
caso('admin crea precio', await op(admin, 'PATCH', `prices/admin_test_${run}`, { super: 37.5 }), true);
caso('admin modifica precio existente', await op(admin, 'PATCH', `prices/admin_test_${run}`, { super: 40 }), false);
caso('admin edita bombas', await op(admin, 'PATCH', 'pumps/p1', { name: 'Bomba 01' }), true);
caso('admin guarda settings', await op(admin, 'PATCH', 'settings/precios', { nota: 'x' }), true);
caso('admin lee auditoría', await op(admin, 'GET', `auditLog/op_entry_${run}`), true);
caso('admin edita auditoría', await op(admin, 'PATCH', `auditLog/op_entry_${run}`, { action: 'y' }), false);
caso('admin borra auditoría', await op(admin, 'DELETE', `auditLog/op_entry_${run}`), false);
caso('colección desconocida', await op(admin, 'GET', 'secretos/x'), false);

// Review r1 de TASK-006
const consulta = await token('consulta@uno.local');
caso('consulta (sin canCloseDay) cambia inicial ya registrada', await op(consulta, 'PATCH', `readings/test_op_${futuro}`, { date: futuro, initialReading: 50, finalReading: 110 }), false);
// TASK-010: una final ya guardada solo la cambia quien tiene canCloseDay (corrección con motivo).
const fin = `test_fin_${run}_${futuro}`;
caso('operador abre lectura sin final', await op(operador, 'PATCH', `readings/${fin}`, { date: futuro, initialReading: 100 }), true);
caso('consulta guarda final en lectura sin final', await op(consulta, 'PATCH', `readings/${fin}`, { date: futuro, initialReading: 100, finalReading: 120 }), true);
caso('consulta reescribe la misma final (sin cambio)', await op(consulta, 'PATCH', `readings/${fin}`, { date: futuro, initialReading: 100, finalReading: 120 }), true);
caso('consulta (sin canCloseDay) cambia final ya guardada', await op(consulta, 'PATCH', `readings/${fin}`, { date: futuro, initialReading: 100, finalReading: 130 }), false);
caso('consulta marca vuelta a cero con final guardada', await op(consulta, 'PATCH', `readings/${fin}`, { date: futuro, initialReading: 100, finalReading: 120, rollover: true }), false);
{ // borrar el campo finalReading
  const r = await fetch(`${FS}/readings/${fin}?updateMask.fieldPaths=finalReading`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${consulta}` }, body: JSON.stringify({ fields: {} }) });
  caso('consulta borra final ya guardada', r.status, false);
}
caso('admin (canCloseDay) corrige final ya guardada', await op(admin, 'PATCH', `readings/${fin}`, { date: futuro, initialReading: 100, finalReading: 130 }), true);
{ const st = await op(operador, 'GET', 'prices_official/2026-11-23'); caso('operador lee sugerencia oficial (404 = permitido sin doc)', st === 404 ? 200 : st, true); }
caso('admin escribe sugerencia oficial desde cliente', await op(admin, 'PATCH', 'prices_official/x', { a: 1 }), false);
caso('operador lee ficha ajena', await op(operador, 'GET', 'users/admin@uno.local'), false);
// Robo de ficha: el admin crea la ficha de alguien que aún no entró; un tercero se registra con ese correo sin verificar.
const robo = `robo${run}@uno.local`;
caso('admin crea ficha nueva', await op(admin, 'PATCH', `users/${robo}`, { email: robo, roleId: 'admin', status: 'activo' }), true);
const intruso = await token(robo);
caso('registrado sin verificar con correo de ficha admin lee auditoría', await op(intruso, 'GET', `auditLog/op_entry_${run}`), false);
caso('registrado sin verificar crea rol', await op(intruso, 'PATCH', `roles/hack${run}`, { name: 'x' }), false);
// Estado del día
const dia = `2099-01-${String(run % 28 + 1).padStart(2, '0')}`;
caso('operador crea día en proceso', await op(operador, 'PATCH', `dayStatus/${dia}`, { status: 'en_proceso' }), true);
caso('consulta (sin canCloseDay) cierra el día', await op(consulta, 'PATCH', `dayStatus/${dia}`, { status: 'cerrado' }), false);
caso('admin cierra el día', await op(admin, 'PATCH', `dayStatus/${dia}`, { status: 'cerrado' }), true);
{ // borrar el campo status = reabrir
  const r = await fetch(`${FS}/dayStatus/${dia}?updateMask.fieldPaths=status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${consulta}` }, body: JSON.stringify({ fields: {} }) });
  caso('consulta borra status de día cerrado (reabrir)', r.status, false);
}
caso('consulta edita fondo en día cerrado', await op(consulta, 'PATCH', `dayStatus/${dia}`, { cashFund: 1 }), false);
caso('admin edita fondo en día cerrado', await op(admin, 'PATCH', `dayStatus/${dia}`, { cashFund: 2 }), true);
caso('consulta crea lectura en día cerrado', await op(consulta, 'PATCH', `readings/${dia}_p1-A-1`, { date: dia, initialReading: 1 }), false);
caso('admin corrige lectura en día cerrado', await op(admin, 'PATCH', `readings/${dia}_p1-A-1`, { date: dia, initialReading: 1, finalReading: 5 }), true);
caso('consulta modifica lectura de día cerrado', await op(consulta, 'PATCH', `readings/${dia}_p1-A-1`, { date: dia, initialReading: 1, finalReading: 999999 }), false);
// Auditoría a nombre de otro
caso('operador firma auditoría con uid ajeno', await op(operador, 'PATCH', `auditLog/falsa_${run}`, { userId: uids['admin@uno.local'], action: 'Cierre del día' }), false);
caso('operador firma auditoría con su uid y nombre', await op(operador, 'PATCH', `auditLog/propia_${run}`, { userId: uids['operador@uno.local'], userName: 'Operador Uno', action: 'Lectura' }), true);
caso('operador firma auditoría con nombre ajeno', await op(operador, 'PATCH', `auditLog/nombre_${run}`, { userId: uids['operador@uno.local'], userName: 'Marion', action: 'Cierre del día' }), false);
caso('lectura con fecha mal formada', await op(operador, 'PATCH', `readings/fake_${run}`, { date: '2026-11-05x', initialReading: 1 }), false);
caso('día con id mal formado', await op(operador, 'PATCH', `dayStatus/2026-11-05x`, { status: 'en_proceso' }), false);

console.log(fallos ? `\n${fallos} caso(s) fallaron` : '\nTodas las reglas se comportan como se espera');
process.exit(fallos ? 1 : 0);
