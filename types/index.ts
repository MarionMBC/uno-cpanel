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
}

export interface FuelReceipt {
  id: string;
  fuelId: string;
  fuelName: string;
  amount: number;
  driver?: string;
  invoice?: string;
  plate?: string;
  timestamp: string;
}

export interface DayStatus {
  date: string;
  status: 'pendiente' | 'en_proceso' | 'cerrado';
  closedBy?: string;
  closedAt?: string;
  horometerInitial?: number;
  horometerFinal?: number;
  tanks?: {
    [fuelId: string]: {
      initialDipstick?: number;
      finalDipstick?: number;
      refueledAmount?: number;
    }
  };
  receipts?: FuelReceipt[];
}

export interface FuelPrice {
  id?: string;
  date: string;
  super: number;
  regular: number;
  diesel: number;
  registeredBy: string;
}

export interface AuditEntry {
  id?: string;
  timestamp: string;
  date: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  target: string;
  detail: string;
  icon: string;
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
