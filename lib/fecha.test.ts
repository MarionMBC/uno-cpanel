import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diaOperativo } from './fecha.ts';

test('día operativo en hora de Honduras, no UTC', () => {
  // 21/11/2026 19:30 en Honduras = 22/11/2026 01:30 UTC: sigue siendo el 21.
  assert.equal(diaOperativo(new Date('2026-11-22T01:30:00Z')), '2026-11-21');
  // 22/11/2026 00:05 en Honduras = 06:05 UTC.
  assert.equal(diaOperativo(new Date('2026-11-22T06:05:00Z')), '2026-11-22');
  // 17:59 locales.
  assert.equal(diaOperativo(new Date('2026-11-21T23:59:00Z')), '2026-11-21');
});
