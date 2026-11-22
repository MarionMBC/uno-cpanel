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

const val = v => (typeof v === 'number' ? { doubleValue: v } : typeof v === 'string' ? { stringValue: v }
  : Array.isArray(v) ? { arrayValue: { values: v.map(val) } }
  : v && typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } }
  : { booleanValue: v });
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
{ // final guardada: consulta no puede alterar campos de venta
  const id = `readings/rvr3_${run}`;
  caso('admin crea lectura con final', await op(admin, 'PATCH', id, { date: futuro, initialReading: 10, finalReading: 20, fuelPrice: 34.05, status: 'activo' }), true);
  caso('consulta pone mantenimiento a final guardada', await op(consulta, 'PATCH', id, { date: futuro, initialReading: 10, finalReading: 20, fuelPrice: 34.05, status: 'mantenimiento' }), false);
  caso('consulta cambia precio de final guardada', await op(consulta, 'PATCH', id, { date: futuro, initialReading: 10, finalReading: 20, fuelPrice: 1, status: 'activo' }), false);
  caso('admin corrige precio de final guardada', await op(admin, 'PATCH', id, { date: futuro, initialReading: 10, finalReading: 20, fuelPrice: 35, status: 'activo' }), true);
}
caso('lectura con fecha mal formada', await op(operador, 'PATCH', `readings/fake_${run}`, { date: '2026-11-05x', initialReading: 1 }), false);
caso('día con id mal formado', await op(operador, 'PATCH', `dayStatus/2026-11-05x`, { status: 'en_proceso' }), false);

// ─── TASK-019: turnos, lecturas por turno y arqueo por bombero ───
{
  const operador2 = await token('operador2@uno.local');
  const fT = `2099-02-${String(run % 28 + 1).padStart(2, '0')}`;
  const tpl = `R${run % 1000000}`;
  const sid = `${fT}_${tpl}`;
  const asig = [{ email: 'consulta@uno.local', name: 'Solo Consulta', dispenserIds: ['p1-A-1'], cashFund: 500 }, { email: 'operador2@uno.local', name: 'Operador Dos', dispenserIds: ['p1-A-2'], cashFund: 500 }];
  const turnoDoc = { date: fT, templateId: tpl, name: 'Prueba', status: 'abierto', assignments: asig, attendantEmails: ['consulta@uno.local', 'operador2@uno.local'] };
  caso('consulta (sin canCloseDay) abre turno', await op(consulta, 'PATCH', `shifts/${sid}`, turnoDoc), false);
  caso('operador abre turno con id que no coincide', await op(operador, 'PATCH', `shifts/${fT}_OTRO${run % 1000}`, turnoDoc), false);
  caso('operador abre turno cerrado de entrada', await op(operador, 'PATCH', `shifts/${sid}`, { ...turnoDoc, status: 'cerrado' }), false);
  caso('operador abre turno', await op(operador, 'PATCH', `shifts/${sid}`, turnoDoc), true);
  caso('sin ficha lee turno', await op(extrano, 'GET', `shifts/${sid}`), false);
  caso('consulta lee turno', await op(consulta, 'GET', `shifts/${sid}`), true);
  const lr = `shiftReadings/${sid}_p1-A-1`;
  caso('consulta crea lectura de turno', await op(consulta, 'PATCH', lr, { shiftId: sid, dispenserId: 'p1-A-1', date: fT, initialReading: 100 }), false);
  caso('operador crea lectura de turno con id ajeno', await op(operador, 'PATCH', `shiftReadings/${sid}_p9`, { shiftId: sid, dispenserId: 'p1-A-1', date: fT, initialReading: 100 }), false);
  caso('operador crea lectura de turno', await op(operador, 'PATCH', lr, { shiftId: sid, dispenserId: 'p1-A-1', date: fT, initialReading: 100 }), true);
  caso('operador cambia inicial de lectura de turno', await op(operador, 'PATCH', lr, { shiftId: sid, dispenserId: 'p1-A-1', date: fT, initialReading: 90 }), false);
  caso('operador guarda final de turno', await op(operador, 'PATCH', lr, { shiftId: sid, dispenserId: 'p1-A-1', date: fT, initialReading: 100, finalReading: 150 }), true);
  caso('operador borra lectura de turno', await op(operador, 'DELETE', lr), false);
  const arq = (email, extra = {}) => ({ shiftId: sid, date: fT, email, cash: 100, card: 0, credits: 0, partialDrops: 0, ...extra });
  caso('bombero (consulta) declara su propio arqueo', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local')), true);
  caso('bombero declara el arqueo de otro', await op(consulta, 'PATCH', `cashCounts/${sid}_operador2@uno.local`, arq('operador2@uno.local')), false);
  caso('bombero se marca recibido', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { receivedBy: 'consulta@uno.local' })), false);
  caso('arqueo con monto negativo', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { cash: -1 })), false);
  caso('arqueo de no asignado (aunque sea admin)', await op(admin, 'PATCH', `cashCounts/${sid}_extrano@uno.local`, arq('extrano@uno.local')), false);
  caso('operador cierra turno', await op(operador, 'PATCH', `shifts/${sid}`, { ...turnoDoc, status: 'cerrado' }), true);
  caso('operador modifica turno cerrado', await op(operador, 'PATCH', `shifts/${sid}`, { ...turnoDoc, status: 'abierto' }), false);
  caso('operador cambia final con turno cerrado', await op(operador, 'PATCH', lr, { shiftId: sid, dispenserId: 'p1-A-1', date: fT, initialReading: 100, finalReading: 160 }), false);
  caso('encargado recibe arqueo', await op(operador, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { receivedBy: 'operador@uno.local' })), true);
  caso('bombero cambia arqueo ya recibido', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { cash: 1 })), false);
  caso('bombero (operador2) declara su arqueo', await op(operador2, 'PATCH', `cashCounts/${sid}_operador2@uno.local`, arq('operador2@uno.local')), true);
  caso('admin borra arqueo', await op(admin, 'DELETE', `cashCounts/${sid}_consulta@uno.local`), false);
  caso('admin borra turno', await op(admin, 'DELETE', `shifts/${sid}`), false);
  caso('consulta escribe puntero de turno', await op(consulta, 'PATCH', 'shiftState/actual', { testPing: run }), false);
  caso('operador escribe puntero con otro id', await op(operador, 'PATCH', 'shiftState/otro', { testPing: run }), false);
  caso('operador escribe puntero de turno', await op(operador, 'PATCH', 'shiftState/actual', { testPing: run }), true);
  caso('operador (sin canManagePumps) edita settings/operacion', await op(operador, 'PATCH', 'settings/operacion', { testPing: run }), false);
  caso('admin edita settings/operacion', await op(admin, 'PATCH', 'settings/operacion', { testPing: run }), true);
}

console.log(fallos ? `\n${fallos} caso(s) fallaron` : '\nTodas las reglas se comportan como se espera');
process.exit(fallos ? 1 : 0);
