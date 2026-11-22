export interface Fuel {
  id: string;
  name: string;
  color: string;
  price: number;
}

export interface Dispenser {
  id: string;
  name: string;
  face: string;
  pumpId: string;
  pumpName: string;
  fuel: string;
  fuelName: string;
  fuelColor: string;
  status: 'activo' | 'mantenimiento' | 'inactivo';
  serialNumber?: string;
  observations?: string;
  /** Valor máximo del totalizador antes de volver a cero (L). Default METER_MAX_DEFAULT = 999999.999. */
  meterMax?: number;
}

export interface PumpFace {
  id: string;
  dispensers: Dispenser[];
}

export interface Pump {
  id: string;
  name: string;
  isActive: boolean;
  fuel: Fuel;
  faces: PumpFace[];
}

export interface DailyReading {
  id?: string;
  date: string;
  dispenserId: string;
  dispenserName: string;
  face: string;
  pumpId: string;
  pumpName: string;
  fuelId: string;
  fuelName: string;
  fuelPrice: number;
  initialReading: number;
  finalReading?: number;
  liters?: number;
  gallons?: number;
  total?: number;
  status: 'activo' | 'mantenimiento';
  createdBy?: string;
  createdAt?: string;
  closedBy?: string;
  closedAt?: string;
  /** El totalizador dio la vuelta a cero entre inicial y final: litros = final + meterMax − inicial. */
  rollover?: boolean;
  /** meterMax usado en el cálculo del rollover (copiado del dispensador al marcarlo). */
  meterMax?: number;
  /** La inicial difiere de la final anterior del mismo dispensador. */
  continuityBreak?: boolean;
  /** Final anterior (fecha previa) contra la que se comparó la inicial. */
  previousFinal?: number;
  /** Motivo de la diferencia de continuidad. */
  continuityReason?: string;
}

export interface FuelReceipt {
  id: string;
  fuelId: string;
  fuelName: string;
  /** Litros recibidos (se conserva por compatibilidad). */
  amount: number;
  /** Galones recibidos (fuente de verdad desde que las pipas se registran en galones). */
  gallons?: number;
  driver?: string;
  invoice?: string;
  plate?: string;
  timestamp: string;
  /** Quien registró la pipa (nombre o correo). */
  createdBy?: string;
  /** Anulada: no suma al recibido; se conserva para auditoría. */
  voided?: boolean;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
}

/** Resultado del cuadre guardado al "Guardar y Cuadrar" (galones, salvo diferenciaL). */
export interface TankCuadre {
  inicialGal: number;
  recibidoGal: number;
  vendidoGal: number;
  teoricoGal: number;
  finalGal: number;
  diferenciaGal: number;
  diferenciaL: number;
  porcentaje: number | null;
  /** |porcentaje| > 0,5 %. */
  alerta: boolean;
  provisional: boolean;
  /** Algo que afecta el cuadre cambió después de guardarlo (p. ej. se anuló una pipa): volver a cuadrar. */
  desactualizado?: boolean;
  savedAt: string;
  savedBy: string;
}

export interface DayStatus {
  date: string;
  status: 'pendiente' | 'en_proceso' | 'cerrado';
  closedBy?: string;
  closedAt?: string;
  reopenedBy?: string;
  reopenedAt?: string;
  reopenReason?: string;
  horometerInitial?: number;
  horometerFinal?: number;
  tanks?: {
    [fuelId: string]: {
      /** Legado: varilla en litros (ya no se usa). */
      initialDipstick?: number;
      finalDipstick?: number;
      /** Legado: litros recibidos en pipas (antes de usar galones). */
      refueledAmount?: number;
      /** Galones recibidos en pipas del día. */
      refueledGallons?: number;
      /** Varilla en pulgadas (tanques con tabla de calibración). */
      initialInches?: number;
      finalInches?: number;
      /** Inventario en galones (de la tabla, o digitado si el tanque no tiene tabla). */
      initialGallons?: number;
      finalGallons?: number;
      /** Cuadre del día guardado al cerrar el inventario. */
      cuadre?: TankCuadre;
    }
  };
  receipts?: FuelReceipt[];
  /** Fondo de cambio (sencillo) con el que abre la caja, en lempiras. */
  cashFund?: number;
}

export interface FuelPrice {
  id?: string;
  /** Día (YYYY-MM-DD, hora de Honduras) desde el que rige; entradas viejas: dd/mm/aaaa. */
  date: string;
  /** Instante ISO desde el que rige el precio (A9). Entradas viejas sin él: rige desde `timestamp`. */
  vigenteDesde?: string;
  /** Milisegundos de cuando se registró. */
  timestamp?: number;
  super: number;
  regular: number;
  diesel: number;
  registeredBy: string;
}

export interface AuditEntry {
  id?: string;
  /** Hora HH:MM (solo para mostrar). */
  timestamp: string;
  /** Día (solo para mostrar): YYYY-MM-DD; entradas viejas dd/mm/aaaa. */
  date: string;
  /** Instante ISO del registro (serverTimestamp normalizado al leer). Ordena la auditoría (A12). */
  at?: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  target: string;
  detail: string;
  icon: string;
  /** Valor anterior (correcciones, reaperturas, continuidad). */
  before?: string | number;
  /** Valor nuevo. */
  after?: string | number;
  /** Motivo obligatorio en correcciones y reaperturas. */
  reason?: string;
}

export interface RolePermissions {
  canManageUsers: boolean;
  canManagePumps: boolean;
  canCloseDay: boolean;
  canEditPrices: boolean;
  canViewAudit: boolean;
  canManageInventory: boolean;
}

export interface AppRole {
  id: string;
  name: string;
  permissions: RolePermissions;
}

export interface AppUser {
  id?: string;
  uid?: string; // firebase auth uid, might be undefined until they login
  email: string;
  name: string;
  roleId: string;
  status: 'activo' | 'inactivo';
}

export type DayStatusValue = 'pendiente' | 'en_proceso' | 'cerrado';
