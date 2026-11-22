import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armarEntrada, cambioDe, claveOrden, diaDeEntrada, filtrarAuditoria, horaDeEntrada, ordenarAuditoria } from './auditoria.ts';
import type { AuditEntry } from '../types';

const E = (over: Partial<AuditEntry>): AuditEntry => ({ timestamp: '', date: '', userId: 'u', userName: 'Ana', userRole: 'Operador', action: 'x', target: '', detail: '', icon: 'edit', ...over });

test('armarEntrada: autor de la sesión, día y hora de Honduras, sin undefined', () => {
  const e = armarEntrada({ action: 'Pipa', target: 'Súper', detail: '100 gal', icon: 'truck', before: undefined, reason: 'r' },
    { uid: 'uid1', name: 'Ana', roleName: 'Operador' }, new Date('2026-11-22T03:10:00Z'));
  assert.equal(e.date, '2026-11-21');
  assert.equal(e.timestamp, '21:10');
  assert.equal(e.userId, 'uid1');
  assert.equal(e.userName, 'Ana');
  assert.equal('before' in e, false);
  assert.equal(e.reason, 'r');
});

test('claveOrden: at manda; entradas viejas con dd/mm/aaaa + hora (incluye a. m./p. m.)', () => {
  assert.equal(claveOrden(E({ at: '2026-11-21T10:00:00.000Z', date: '01/01/2020', timestamp: '01:00' })), '2026-11-21T10:00:00.000Z');
  assert.equal(claveOrden(E({ date: '20/11/2026', timestamp: '23:10' })), '2026-11-21T05:10:00.000Z');
  assert.equal(claveOrden(E({ date: '20/11/2026', timestamp: '11:10 p. m.' })), '2026-11-21T05:10:00.000Z');
  assert.equal(claveOrden(E({ date: '2026-11-21', timestamp: '07:00' })), '2026-11-21T13:00:00.000Z');
  assert.equal(claveOrden(E({ date: 'basura', timestamp: '' })), '');
});

test('ordenarAuditoria: un 23:10 de ayer va después de un 07:00 de hoy (bug 4.1)', () => {
  const ayer = E({ id: 'ayer', date: '20/11/2026', timestamp: '23:10' });
  const hoy = E({ id: 'hoy', date: '21/11/2026', timestamp: '07:00' });
  const nueva = E({ id: 'nueva', at: '2026-11-21T15:00:00.000Z', date: '2026-11-21', timestamp: '09:00' });
  const rota = E({ id: 'rota', date: '?', timestamp: '?' });
  assert.deepEqual(ordenarAuditoria([ayer, rota, hoy, nueva]).map(e => e.id), ['nueva', 'hoy', 'ayer', 'rota']);
});

test('filtrarAuditoria por fecha (día HN), usuario y acción; hora y cambio para mostrar', () => {
  const a = E({ id: 'a', at: '2026-11-22T03:00:00.000Z', userName: 'Ana', action: 'Pipa' }); // 21/11 21:00 HN
  const b = E({ id: 'b', date: '22/11/2026', timestamp: '08:00', userName: 'Beto', action: 'Pipa' });
  assert.equal(diaDeEntrada(a), '2026-11-21');
  assert.equal(horaDeEntrada(a), '21:00');
  assert.deepEqual(filtrarAuditoria([a, b], { fecha: '2026-11-21' }).map(e => e.id), ['a']);
  assert.deepEqual(filtrarAuditoria([a, b], { usuario: 'Beto', accion: 'Pipa' }).map(e => e.id), ['b']);
  assert.equal(cambioDe({ before: 1500, after: 2000 }), '1500 → 2000');
  assert.equal(cambioDe({ after: 'activo' }), '— → activo');
  assert.equal(cambioDe({}), null);
});
