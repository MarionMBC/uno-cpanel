// Día operativo de la estación en hora de Honduras (America/Tegucigalpa, UTC−6, sin horario de verano).
// Antes se usaba `toISOString()` (UTC): desde las 18:00 locales la app abría el día siguiente.
export const ZONA_ESTACION = 'America/Tegucigalpa';

/** YYYY-MM-DD del día en la zona de la estación para el instante dado. */
export function diaOperativo(ahora: Date = new Date(), zona: string = ZONA_ESTACION): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** Desfase fijo de Honduras respecto a UTC (no hay horario de verano). */
export const OFFSET_HN = '-06:00';

/** Instante (ISO UTC) de la hora local `HH:MM` del día `YYYY-MM-DD` en Honduras. */
export const instanteHN = (fecha: string, hora = '00:00') => new Date(`${fecha}T${hora}:00${OFFSET_HN}`).toISOString();

/** Día ISO sumando `n` días (aritmética en UTC sobre la fecha, sin depender de la zona del equipo). */
export function sumarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** HH:MM (24 h) en hora de Honduras. */
export function horaHN(instante: Date | string): string {
  const d = typeof instante === 'string' ? new Date(instante) : instante;
  return new Intl.DateTimeFormat('en-GB', { timeZone: ZONA_ESTACION, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/** dd/mm/aaaa de un día ISO. */
export const fechaCortaHN = (iso: string) => iso.split('-').reverse().join('/');

/** "dd/mm/aaaa HH:MM" en hora de Honduras de un instante ISO. */
export const fechaHoraHN = (instante: string) => `${fechaCortaHN(diaOperativo(new Date(instante)))} ${horaHN(instante)}`;
