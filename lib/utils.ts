import { LITERS_PER_GALLON } from './constants';

export const fmtL = (n: number): string =>
  'L. ' + Number(n || 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtNum = (n: number, d = 2): string =>
  Number(n || 0).toLocaleString('es-HN', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtInt = (n: number): string =>
  Number(n || 0).toLocaleString('es-HN');

export const litersToGallons = (liters: number): number => liters / LITERS_PER_GALLON;

export const gallonsToLiters = (gallons: number): number => gallons * LITERS_PER_GALLON;

export const getTodayString = (): string => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export const getInitials = (name: string): string =>
  (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

export const getDayOfWeekEs = (date: Date): string => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[date.getDay()];
};

export const getMonthEs = (date: Date): string => {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return months[date.getMonth()];
};
