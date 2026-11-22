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

const val = v => (v === null ? { nullValue: null } : typeof v === 'number' ? { doubleValue: v } : typeof v === 'string' ? { stringValue: v }
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

// Varias escrituras atómicas (como runTransaction): las reglas ven getAfter() de todas.
const DOCS = `projects/${PROJECT}/databases/(default)/documents`;
async function commit(tk, writes) {
  const headers = { 'Content-Type': 'application/json' };
  if (tk) headers.Authorization = `Bearer ${tk}`;
  const r = await fetch(`${FS}:commit`, {
    method: 'POST', headers,
    body: JSON.stringify({ writes: writes.map(([path, data]) => ({ update: { name: `${DOCS}/${path}`, fields: JSON.parse(body(data)).fields } })) }),
  });
  return r.status;
}
// Escritura parcial (updateMask) con campos de hora del servidor (serverTimestamp → request.time).
async function opTs(tk, path, data, tsFields = []) {
  const headers = { 'Content-Type': 'application/json' };
  if (tk) headers.Authorization = `Bearer ${tk}`;
  const r = await fetch(`${FS}:commit`, {
    method: 'POST', headers,
    body: JSON.stringify({ writes: [{
      update: { name: `${DOCS}/${path}`, fields: JSON.parse(body(data)).fields },
      updateMask: { fieldPaths: Object.keys(data) },
      updateTransforms: tsFields.map(f => ({ fieldPath: f, setToServerValue: 'REQUEST_TIME' })),
    }] }),
  });
  return r.status;
}
// TASK-023: cerrar y reabrir el día firmados por la sesión, con hora del servidor.
const cerrarDia = (tk, path, quien, extra = {}) => opTs(tk, path, { status: 'cerrado', closedBy: quien, ...extra }, ['closedAt']);
const reabrirDia = (tk, path, quien, motivo = 'corregir lecturas', extra = {}) => opTs(tk, path, { status: 'en_proceso', reopenedBy: quien, reopenReason: motivo, ...extra }, ['reopenedAt']);
// Escritura de preparación con la credencial de administrador del emulador (ignora reglas).
const owner = (method, path, data) => fetch(`${FS}/${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: data ? body(data) : undefined });

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
caso('admin crea precio', await op(admin, 'PATCH', `prices/admin_test_${run}`, { super: 37.5, regular: 34.2, diesel: 40.3, vigenteDesde: '2026-11-21T18:00:00.000Z' }), true);
caso('admin crea precio fuera de rango', await op(admin, 'PATCH', `prices/admin_test_r${run}`, { super: 999, regular: 34.2, diesel: 40.3 }), false);
caso('admin crea precio con vigencia mal formada', await op(admin, 'PATCH', `prices/admin_test_v${run}`, { super: 37.5, regular: 34.2, diesel: 40.3, vigenteDesde: 'mañana' }), false);
caso('admin modifica precio existente', await op(admin, 'PATCH', `prices/admin_test_${run}`, { super: 40, regular: 34.2, diesel: 40.3 }), false);
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
caso('admin cierra el día sin firma', await op(admin, 'PATCH', `dayStatus/${dia}`, { status: 'cerrado' }), false);
caso('admin cierra el día firmando como otro', await cerrarDia(admin, `dayStatus/${dia}`, 'operador@uno.local'), false);
caso('admin cierra el día con closedAt inventado', await op(admin, 'PATCH', `dayStatus/${dia}`, { status: 'cerrado', closedBy: 'admin@uno.local', closedAt: '2099-01-01T00:00:00.000Z' }), false);
caso('admin cierra el día (firma + hora del servidor)', await cerrarDia(admin, `dayStatus/${dia}`, 'admin@uno.local'), true);
caso('admin cambia closedBy de un día cerrado', await op(admin, 'PATCH', `dayStatus/${dia}`, { closedBy: 'otro@uno.local' }), false);
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
{ // tramos falsos (review r2 TASK-019): consulta no puede escribir tramos en una lectura sin final
  const id = `readings/tramos_${run}`;
  caso('operador abre lectura sin tramos', await op(operador, 'PATCH', id, { date: futuro, initialReading: 10 }), true);
  const conTramo = { fields: { date: { stringValue: futuro }, initialReading: { doubleValue: 10 }, tramos: { arrayValue: { values: [{ mapValue: { fields: { litros: { doubleValue: -500 }, precio: { doubleValue: 34.05 } } } }] } } } };
  const r1 = await fetch(`${FS}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${consulta}` }, body: JSON.stringify(conTramo) });
  caso('consulta escribe tramos falsos', r1.status, false);
  const r2 = await fetch(`${FS}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` }, body: JSON.stringify(conTramo) });
  caso('admin (canCloseDay) escribe tramos', r2.status, true);
}
caso('lectura con fecha mal formada', await op(operador, 'PATCH', `readings/fake_${run}`, { date: '2026-11-05x', initialReading: 1 }), false);
caso('admin crea día ya reabierto (con campos de reapertura)', await op(admin, 'PATCH', `dayStatus/2099-04-0${run % 9 + 1}`, { status: 'en_proceso', reopenedBy: 'admin@uno.local', reopenReason: 'xxxxx' }), false);
caso('admin crea día cerrado con firma', await cerrarDia(admin, `dayStatus/2099-04-1${run % 9 + 1}`, 'admin@uno.local'), true);
caso('día con id mal formado', await op(operador, 'PATCH', `dayStatus/2026-11-05x`, { status: 'en_proceso' }), false);

// ─── TASK-019: turnos, lecturas por turno y arqueo por bombero ───
{
  const operador2 = await token('operador2@uno.local');
  const fT = `2099-02-${String(run % 28 + 1).padStart(2, '0')}`;
  const tpl = `R${run % 1000000}`;
  const sid = `${fT}_${tpl}`;
  const sid2 = `${fT}_${tpl}B`;
  const asig = [{ email: 'consulta@uno.local', name: 'Solo Consulta', dispenserIds: ['p1-A-1'], cashFund: 500 }, { email: 'operador2@uno.local', name: 'Operador Dos', dispenserIds: ['p1-A-2'], cashFund: 500 }];
  const turnoDoc = { date: fT, templateId: tpl, name: 'Prueba', status: 'abierto', assignments: asig, attendantEmails: ['consulta@uno.local', 'operador2@uno.local'], dispenserIds: ['p1-A-1', 'p1-A-2'] };
  // El puntero es global: se guarda el de la app local y se deja libre para las pruebas; al final se restaura.
  const estadoPrevio = await (await owner('GET', 'shiftState/actual')).json();
  await owner('DELETE', 'shiftState/actual');
  const abrir = (tk, id, doc, extra = []) => commit(tk, [[`shifts/${id}`, doc], ...extra, ['shiftState/actual', { openShiftId: id, lastShiftId: null }]]);
  const cerrarT = (tk, id, doc) => commit(tk, [[`shifts/${id}`, { ...doc, status: 'cerrado' }], ['shiftState/actual', { openShiftId: null, lastShiftId: id }]]);
  caso('consulta (sin canCloseDay) abre turno', await abrir(consulta, sid, turnoDoc), false);
  caso('operador abre turno con id que no coincide', await abrir(operador, `${fT}_OTRO${run % 1000}`, turnoDoc), false);
  caso('operador abre turno cerrado de entrada', await abrir(operador, sid, { ...turnoDoc, status: 'cerrado' }), false);
  caso('operador abre turno sin tomar el puntero', await op(operador, 'PATCH', `shifts/${sid}`, turnoDoc), false);
  caso('operador apunta el puntero a un turno que no crea', await op(operador, 'PATCH', 'shiftState/actual', { openShiftId: `${fT}_NOEXISTE`, lastShiftId: null }), false);
  caso('operador abre turno (turno + puntero en una transacción)', await abrir(operador, sid, turnoDoc), true);
  caso('operador abre un segundo turno con otro abierto', await abrir(operador, sid2, { ...turnoDoc, templateId: `${tpl}B` }), false);
  caso('operador libera el puntero con el turno abierto', await op(operador, 'PATCH', 'shiftState/actual', { openShiftId: null, lastShiftId: sid }), false);
  caso('operador escribe puntero arbitrario', await op(operador, 'PATCH', 'shiftState/actual', { testPing: run }), false);
  caso('sin ficha lee turno', await op(extrano, 'GET', `shifts/${sid}`), false);
  caso('consulta lee turno', await op(consulta, 'GET', `shifts/${sid}`), true);
  const lr = `shiftReadings/${sid}_p1-A-1`;
  caso('consulta crea lectura de turno', await op(consulta, 'PATCH', lr, { shiftId: sid, dispenserId: 'p1-A-1', date: fT, initialReading: 100 }), false);
  caso('operador crea lectura de turno con id ajeno', await op(operador, 'PATCH', `shiftReadings/${sid}_p9`, { shiftId: sid, dispenserId: 'p1-A-1', date: fT, initialReading: 100 }), false);
  caso('operador crea lectura de manguera fuera del turno', await op(operador, 'PATCH', `shiftReadings/${sid}_p9-A-9`, { shiftId: sid, dispenserId: 'p9-A-9', date: fT, initialReading: 100 }), false);
  caso('operador crea lectura de turno con otra fecha', await op(operador, 'PATCH', `shiftReadings/${sid}_p1-A-2`, { shiftId: sid, dispenserId: 'p1-A-2', date: '2099-01-01', initialReading: 100 }), false);
  caso('operador crea lectura de turno', await op(operador, 'PATCH', lr, { shiftId: sid, dispenserId: 'p1-A-1', date: fT, initialReading: 100 }), true);
  caso('operador cambia inicial de lectura de turno', await op(operador, 'PATCH', lr, { shiftId: sid, dispenserId: 'p1-A-1', date: fT, initialReading: 90 }), false);
  caso('operador guarda final de turno', await op(operador, 'PATCH', lr, { shiftId: sid, dispenserId: 'p1-A-1', date: fT, initialReading: 100, finalReading: 150 }), true);
  caso('operador borra lectura de turno', await op(operador, 'DELETE', lr), false);
  // Arqueo coherente (como calcArqueo): declarado, esperado, diferencia y estado se derivan de los montos.
  const arq = (email, extra = {}) => {
    const d = { shiftId: sid, date: fT, email, name: email, expectedSales: 80, cashFund: 20, cash: 100, card: 0, credits: 0, partialDrops: 0, declaredBy: email, declaredAt: '2099-01-01T12:00:00.000Z', ...extra };
    const r2 = n => Math.round(n * 100) / 100;
    const expected = r2(d.expectedSales + d.cashFund), declared = r2(d.cash + d.card + d.credits + d.partialDrops), difference = r2(declared - expected);
    return { expected, declared, difference, status: difference === 0 ? 'conforme' : 'con_diferencia', ...d };
  };
  caso('bombero (consulta) declara su propio arqueo', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local')), true);
  caso('bombero declara arqueo con fecha distinta a la del turno', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { date: '2099-01-01' })), false);
  caso('bombero declara el arqueo de otro', await op(consulta, 'PATCH', `cashCounts/${sid}_operador2@uno.local`, arq('operador2@uno.local')), false);
  caso('bombero se marca recibido', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { receivedBy: 'consulta@uno.local' })), false);
  // TASK-023: montos calculados validados en reglas.
  caso('arqueo con diferencia que no es declarado − esperado', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, { ...arq('consulta@uno.local'), difference: 50, status: 'con_diferencia' }), false);
  caso('arqueo con declarado que no suma los montos', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, { ...arq('consulta@uno.local'), declared: 500 }), false);
  caso('arqueo con esperado que no es ventas + fondo', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, { ...arq('consulta@uno.local'), expected: 1 }), false);
  caso('arqueo conforme con diferencia distinta de 0', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { cash: 90, status: 'conforme' })), false);
  caso('arqueo con campo desconocido', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { hack: 1 })), false);
  caso('arqueo con monto fuera de rango', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { cash: 9e9 })), false);
  caso('arqueo con ventas negativas', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { expectedSales: -100 })), false);
  caso('arqueo coherente con decimales (0.1 + 0.2) y diferencia', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { cash: 0.1, card: 0.2, notes: 'faltante' })), true);
  caso('arqueo con monto negativo', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { cash: -1 })), false);
  caso('arqueo de no asignado (aunque sea admin)', await op(admin, 'PATCH', `cashCounts/${sid}_extrano@uno.local`, arq('extrano@uno.local')), false);
  caso('operador cierra turno sin liberar el puntero', await op(operador, 'PATCH', `shifts/${sid}`, { ...turnoDoc, status: 'cerrado' }), false);
  caso('operador cierra turno liberando el puntero con otro id', await commit(operador, [[`shifts/${sid}`, { ...turnoDoc, status: 'cerrado' }], ['shiftState/actual', { openShiftId: null, lastShiftId: 'otro' }]]), false);
  caso('operador cierra turno (turno + puntero en una transacción)', await cerrarT(operador, sid, turnoDoc), true);
  caso('operador modifica turno cerrado', await op(operador, 'PATCH', `shifts/${sid}`, { ...turnoDoc, status: 'abierto' }), false);
  caso('operador cambia final con turno cerrado', await op(operador, 'PATCH', lr, { shiftId: sid, dispenserId: 'p1-A-1', date: fT, initialReading: 100, finalReading: 160 }), false);
  // consulta no tiene canCloseDay: es el bombero puro (operador2 tiene canCloseDay en la semilla).
  caso('bombero marca su arqueo como recalculado', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { recalculatedBy: 'consulta@uno.local' })), false);
  caso('bombero declara a nombre de otro (declaredBy ajeno)', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { declaredBy: 'admin@uno.local' })), false);
  caso('encargado recibe arqueo firmando como otro', await op(operador, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { receivedBy: 'admin@uno.local' })), false);
  caso('encargado recibe arqueo', await op(operador, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { receivedBy: 'operador@uno.local' })), true);
  // Recálculo de TASK-022: esperado nuevo, firma del recálculo y recepción anulada (campo borrado).
  { const rec = arq('consulta@uno.local', { expectedSales: 70, recalculatedBy: 'operador@uno.local', recalculatedAt: '2099-01-01T12:00:00.000Z' });
    const r = await fetch(`${FS}/cashCounts/${sid}_consulta@uno.local?${[...Object.keys(rec), 'receivedBy', 'receivedAt'].map(k => `updateMask.fieldPaths=${k}`).join('&')}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${operador}` }, body: body(rec) });
    caso('encargado recalcula arqueo (TASK-022) y anula la recepción', r.status, true); }
  caso('encargado recalcula firmando como otro', await op(operador, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { recalculatedBy: 'admin@uno.local' })), false);
  caso('arqueo con notas de más de 500', await op(operador, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { cash: 90, notes: 'x'.repeat(501) })), false);
  caso('arqueo con nombre no texto', await op(operador, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { name: 5 })), false);
  caso('(prep) encargado vuelve a recibir', await op(operador, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { receivedBy: 'operador@uno.local' })), true);
  caso('bombero cambia arqueo ya recibido', await op(consulta, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { cash: 1 })), false);
  caso('bombero (operador2) declara su arqueo', await op(operador2, 'PATCH', `cashCounts/${sid}_operador2@uno.local`, arq('operador2@uno.local')), true);
  caso('admin borra arqueo', await op(admin, 'DELETE', `cashCounts/${sid}_consulta@uno.local`), false);
  caso('admin borra turno', await op(admin, 'DELETE', `shifts/${sid}`), false);
  // Día cerrado: no se abren turnos, no se tocan lecturas de turno ni arqueos (hay que reabrir el día).
  caso('(prep) admin cierra el día del turno', await cerrarDia(admin, `dayStatus/${fT}`, 'admin@uno.local'), true);
  caso('operador abre turno en día cerrado', await abrir(operador, sid2, { ...turnoDoc, templateId: `${tpl}B` }), false);
  caso('admin abre turno en día cerrado', await abrir(admin, sid2, { ...turnoDoc, templateId: `${tpl}B` }), false);
  caso('encargado corrige arqueo recibido con el día cerrado', await op(operador, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { cash: 90, receivedBy: 'operador@uno.local' })), false);
  caso('encargado recibe arqueo con el día cerrado', await op(operador, 'PATCH', `cashCounts/${sid}_operador2@uno.local`, arq('operador2@uno.local', { receivedBy: 'operador@uno.local' })), false);
  caso('bombero declara arqueo con el día cerrado', await op(operador2, 'PATCH', `cashCounts/${sid}_operador2@uno.local`, arq('operador2@uno.local', { cash: 5 })), false);
  // Turno abierto colado en un día cerrado (datos previos a esta regla): sus lecturas no se crean ni cambian.
  const sid3 = `${fT}_${tpl}C`;
  await owner('PATCH', `shifts/${sid3}`, { ...turnoDoc, templateId: `${tpl}C` });
  await owner('PATCH', `shiftReadings/${sid3}_p1-A-1`, { shiftId: sid3, dispenserId: 'p1-A-1', date: fT, initialReading: 100 });
  caso('operador crea lectura de turno en día cerrado', await op(operador, 'PATCH', `shiftReadings/${sid3}_p1-A-2`, { shiftId: sid3, dispenserId: 'p1-A-2', date: fT, initialReading: 100 }), false);
  caso('operador guarda final de turno en día cerrado', await op(operador, 'PATCH', `shiftReadings/${sid3}_p1-A-1`, { shiftId: sid3, dispenserId: 'p1-A-1', date: fT, initialReading: 100, finalReading: 150 }), false);
  // TASK-023: reabrir (hoy o pasado) exige motivo, firma propia y reopenedAt nuevo.
  caso('admin reabre el día sin motivo', await opTs(admin, `dayStatus/${fT}`, { status: 'en_proceso', reopenedBy: 'admin@uno.local' }, ['reopenedAt']), false);
  caso('admin reabre el día con motivo corto', await reabrirDia(admin, `dayStatus/${fT}`, 'admin@uno.local', 'x'), false);
  caso('admin reabre el día con motivo de espacios', await reabrirDia(admin, `dayStatus/${fT}`, 'admin@uno.local', '        '), false);
  caso('admin reabre el día con motivo de más de 500', await reabrirDia(admin, `dayStatus/${fT}`, 'admin@uno.local', 'x'.repeat(501)), false);
  caso('admin reabre el día firmando como otro', await reabrirDia(admin, `dayStatus/${fT}`, 'operador@uno.local'), false);
  caso('admin reabre el día con reopenedAt inventado', await op(admin, 'PATCH', `dayStatus/${fT}`, { status: 'en_proceso', reopenedBy: 'admin@uno.local', reopenReason: 'corregir lecturas', reopenedAt: '2099-01-01T12:00:00.000Z' }), false);
  caso('admin reabre el día y cambia closedBy', await reabrirDia(admin, `dayStatus/${fT}`, 'admin@uno.local', 'corregir lecturas', { closedBy: 'nadie' }), false);
  caso('consulta (sin canCloseDay) reabre el día con motivo', await reabrirDia(consulta, `dayStatus/${fT}`, 'consulta@uno.local'), false);
  caso('(prep) admin reabre el día', await reabrirDia(admin, `dayStatus/${fT}`, 'admin@uno.local'), true);
  caso('operador (activo) reescribe reopenedBy del día reabierto', await op(operador, 'PATCH', `dayStatus/${fT}`, { status: 'en_proceso', reopenedBy: 'otro@uno.local' }), false);
  caso('consulta reescribe el motivo de reapertura', await op(consulta, 'PATCH', `dayStatus/${fT}`, { reopenReason: 'zzzzz' }), false);
  caso('admin reescribe el motivo de reapertura fuera de la transición', await op(admin, 'PATCH', `dayStatus/${fT}`, { reopenReason: 'otro motivo' }), false);
  caso('operador guarda fondo en día reabierto (sin tocar firmas)', await op(operador, 'PATCH', `dayStatus/${fT}`, { cashFund: 10 }), true);
  caso('operador abre turno con el día reabierto (turno + lecturas + diaria + puntero, como abrirTurno)', await abrir(operador, sid2, { ...turnoDoc, templateId: `${tpl}B` }, [
    [`shiftReadings/${sid2}_p1-A-1`, { shiftId: sid2, dispenserId: 'p1-A-1', date: fT, initialReading: 150 }],
    [`readings/${fT}_p1-A-9${run % 1000}`, { date: fT, dispenserId: `p1-A-9${run % 1000}`, initialReading: 150, fuelPrice: 34.05, status: 'activo' }],
  ]), true);
  caso('encargado corrige arqueo recibido con el día reabierto', await op(operador, 'PATCH', `cashCounts/${sid}_consulta@uno.local`, arq('consulta@uno.local', { cash: 90, receivedBy: 'operador@uno.local' })), true);
  caso('consulta escribe puntero de turno', await op(consulta, 'PATCH', 'shiftState/actual', { openShiftId: null, lastShiftId: sid2 }), false);
  caso('operador escribe puntero con otro id', await op(operador, 'PATCH', 'shiftState/otro', { testPing: run }), false);
  caso('operador cierra el segundo turno', await cerrarT(operador, sid2, { ...turnoDoc, templateId: `${tpl}B` }), true);
  caso('operador (sin canManagePumps) edita settings/operacion', await op(operador, 'PATCH', 'settings/operacion', { testPing: run }), false);
  caso('admin edita settings/operacion', await op(admin, 'PATCH', 'settings/operacion', { testPing: run }), true);
  // Tramos de la diaria (venta por turnos): forman parte de la venta, cambiarlos es corrección.
  const rd = `readings/${fT}_tramos${run % 1000}`;
  const diaria = { date: fT, initialReading: 10, finalReading: 20, fuelPrice: 34.05, status: 'activo', tramos: [{ litros: 10, precio: 34.05 }] };
  caso('(prep) admin crea diaria con tramos', await op(admin, 'PATCH', rd, diaria), true);
  caso('consulta cambia tramos de una final guardada', await op(consulta, 'PATCH', rd, { ...diaria, tramos: [{ litros: 10, precio: 1 }] }), false);
  caso('admin corrige tramos de una final guardada', await op(admin, 'PATCH', rd, { ...diaria, tramos: [{ litros: 10, precio: 35 }] }), true);
  // Restaura el puntero de la app local.
  if (estadoPrevio.fields) {
    await fetch(`${FS}/shiftState/actual`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ fields: estadoPrevio.fields }),
    });
  } else await owner('DELETE', 'shiftState/actual');
}

// Limpieza: lo creado por las pruebas se borra con la credencial de administrador del emulador
// (Bearer owner, ignora reglas) para no ensuciar la auditoría ni los datos de la app local.
async function limpiar() {
  for (const col of ['auditLog', 'readings', 'prices', 'dayStatus', 'users', 'roles', 'shifts', 'shiftReadings', 'cashCounts']) {
    const r = await fetch(`${FS}/${col}?pageSize=300`, { headers: { Authorization: 'Bearer owner' } });
    const j = await r.json();
    for (const d of j.documents || []) {
      const id = d.name.split('/').pop();
      const f = d.fields || {};
      const accion = f.action?.stringValue;
      const deLaPrueba = id.includes(String(run)) || id.startsWith('tramos_') || id.startsWith('rv019') || id.startsWith('test_') || id.startsWith('rvr') || id.startsWith('fake_')
        || id.startsWith('2099-') || id.startsWith('admin_test') || id.startsWith('hack') || id.startsWith('robo')
        || (col === 'auditLog' && ['x', 'Lectura', 'Cierre del día', 'y'].includes(accion ?? '') && !f.target);
      if (deLaPrueba) await fetch(`${FS}/${col}/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
    }
  }
}
await limpiar();

console.log(fallos ? `\n${fallos} caso(s) fallaron` : '\nTodas las reglas se comportan como se espera');
process.exit(fallos ? 1 : 0);
