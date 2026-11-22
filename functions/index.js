"use strict";
// Cloud Functions del panel UNO Guaimaca.

const {onSchedule} = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {ejecutar} = require("./precioOficial");

initializeApp();

// Sugerencia semanal del precio oficial (TASK-020). Corre vie, sáb, dom y lun
// a las 05/11/17/23 h de Tegucigalpa (16 invocaciones/semana, tope de diseño
// 30); el lunes solo trabaja la de las 05:00. Apagada salvo
// settings/precios.autoOficial === true. Nunca toca `prices`.
exports.precioOficialSemanal = onSchedule({
  schedule: "0 5,11,17,23 * * 0,1,5,6",
  timeZone: "America/Tegucigalpa",
  region: "us-central1",
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 1,
  retryCount: 0,
}, async () => {
  const r = await ejecutar({
    db: getFirestore(),
    fetchFn: fetch,
    ahora: new Date(),
    serverTs: FieldValue.serverTimestamp(),
    logger,
  });
  logger.info("precioOficialSemanal", r);
});
