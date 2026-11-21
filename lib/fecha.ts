// Día operativo de la estación en hora de Honduras (America/Tegucigalpa, UTC−6, sin horario de verano).
// Antes se usaba `toISOString()` (UTC): desde las 18:00 locales la app abría el día siguiente.
export const ZONA_ESTACION = 'America/Tegucigalpa';

/** YYYY-MM-DD del día en la zona de la estación para el instante dado. */
export function diaOperativo(ahora: Date = new Date(), zona: string = ZONA_ESTACION): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}
