'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  collection, doc, setDoc, addDoc, writeBatch,
  onSnapshot, query, orderBy, getDocs, where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Pump, AuditEntry, FuelPrice, DayStatusValue, DailyReading, DayStatus, AppUser, AppRole } from '@/types';
import { INITIAL_PUMPS, PRICE_HISTORY, FUELS, DEFAULT_DIFERENCIAL_POR_LITRO } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { diaOperativo } from '@/lib/fecha';


interface AppContextType {
  pumps: Pump[];
  setPumps: (pumps: Pump[]) => Promise<void>;
  dayStatus: DayStatusValue;
  setDayStatus: (s: DayStatusValue) => Promise<void>;
  auditLog: AuditEntry[];
  addAuditEntry: (entry: Omit<AuditEntry, 'id'>) => Promise<void>;
  priceHistory: FuelPrice[];
  addPriceEntry: (entry: FuelPrice) => Promise<void>;
  currentPrices: { super: number; regular: number; diesel: number };
  setCurrentPrices: (p: { super: number; regular: number; diesel: number }) => Promise<void>;
  readings: DailyReading[];
  saveReadings: (readings: DailyReading[]) => Promise<void>;
  loading: boolean;
  /** Fecha ISO (YYYY-MM-DD) del día operativo que escucha el contexto. */
  today: string;
  dayData: DayStatus | null;
  updateDayData: (data: Partial<DayStatus>) => Promise<void>;
  users: AppUser[];
  roles: AppRole[];
  saveUser: (user: AppUser) => Promise<void>;
  saveRole: (role: AppRole) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

// Precio por litro de respaldo mientras carga el historial (mismos valores que la semilla).
const DEFAULT_PRICES = Object.fromEntries(FUELS.map(f => [f.id, f.price])) as { super: number; regular: number; diesel: number };

export function AppProvider({ children }: { children: ReactNode }) {
  const [pumps, setPumpsState] = useState<Pump[]>([]);
  const [dayStatus, setDayStatusState] = useState<DayStatusValue>('en_proceso');
  const [dayData, setDayData] = useState<DayStatus | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [priceHistory, setPriceHistory] = useState<FuelPrice[]>([]);
  const [currentPrices, setCurrentPricesState] = useState(DEFAULT_PRICES);
  const [readings, setReadingsState] = useState<DailyReading[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { appUser, loading: authLoading } = useAuth();
  // Las reglas de Firestore solo permiten leer/escribir con sesión y ficha activa:
  // la siembra y las suscripciones arrancan cuando hay un usuario autorizado.
  const autorizado = !!appUser && appUser.status === 'activo';

  // Día operativo en hora de Honduras; se revisa cada minuto para cambiar de día sin recargar.
  const [todayDoc, setTodayDoc] = useState(() => diaOperativo());
  useEffect(() => {
    const t = setInterval(() => setTodayDoc(d => { const n = diaOperativo(); return n === d ? d : n; }), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!authLoading && !autorizado) {
      // Sesión cerrada: no dejar en memoria datos del usuario anterior (p. ej. auditoría de un admin).
      setPumpsState([]); setAuditLog([]); setPriceHistory([]); setReadingsState([]);
      setUsers([]); setRoles([]); setDayData(null); setCurrentPricesState(DEFAULT_PRICES);
      setLoading(false);
    }
    if (autorizado) setLoading(true);
  }, [authLoading, autorizado]);

  // Solo el administrador crea la configuración inicial (las reglas niegan esas escrituras al resto).
  const puedeSembrar = autorizado && (appUser?.roleId === 'admin' || appUser?.email === 'melchisedec.bustamante@gmail.com');

  useEffect(() => {
    if (!puedeSembrar) return;
    async function seed() {
      const pumpsSnap = await getDocs(collection(db, 'pumps'));
      if (pumpsSnap.empty) {
        const batch = writeBatch(db);
        (INITIAL_PUMPS as Pump[]).forEach(pump => {
          batch.set(doc(db, 'pumps', pump.id), pump);
        });
        await batch.commit();
      }

      const pricesSnap = await getDocs(collection(db, 'prices'));
      if (pricesSnap.empty) {
        const batch = writeBatch(db);
        (PRICE_HISTORY as FuelPrice[]).forEach((p, i) => {
          const { id: _id, ...rest } = p as FuelPrice & { id?: string };
          // add a fake timestamp to seed data to allow sorting
          batch.set(doc(db, 'prices', `seed_${i}`), { ...rest, timestamp: new Date('2026-11-23T06:01:00Z').getTime() - i * 86400000 });
        });
        await batch.commit();
      }

      const settingsSnap = await getDocs(collection(db, 'settings'));
      if (settingsSnap.empty) {
        await setDoc(doc(db, 'settings', 'precios'), { diferencialPorLitro: { ...DEFAULT_DIFERENCIAL_POR_LITRO } });
      }

      const rolesSnap = await getDocs(collection(db, 'roles'));
      if (rolesSnap.empty) {
        const batch = writeBatch(db);
        const adminRole: AppRole = {
          id: 'admin',
          name: 'Administrador',
          permissions: { canManageUsers: true, canManagePumps: true, canCloseDay: true, canEditPrices: true, canViewAudit: true, canManageInventory: true }
        };
        const operatorRole: AppRole = {
          id: 'operador',
          name: 'Operador',
          permissions: { canManageUsers: false, canManagePumps: false, canCloseDay: true, canEditPrices: false, canViewAudit: false, canManageInventory: true }
        };
        batch.set(doc(db, 'roles', 'admin'), adminRole);
        batch.set(doc(db, 'roles', 'operador'), operatorRole);
        await batch.commit();
      }

      const usersSnap = await getDocs(collection(db, 'users'));
      if (usersSnap.empty) {
        const superAdmin: AppUser = {
          email: 'melchisedec.bustamante@gmail.com',
          name: 'Marion',
          roleId: 'admin',
          status: 'activo'
        };
        // Use email as doc ID for easier lookup
        await setDoc(doc(db, 'users', superAdmin.email), superAdmin);
      }
    }
    seed().catch(console.error);
  }, [puedeSembrar]);

  useEffect(() => {
    if (!autorizado) return;
    const loaded = { pumps: false, prices: false, day: false, readings: false, roles: false };
    const tryDone = () => {
      if (loaded.pumps && loaded.prices && loaded.day && loaded.readings && loaded.roles) setLoading(false);
    };
    // Sin permiso para una colección (p. ej. auditoría para un operador) la carga no debe quedar colgada.
    const sinPermiso = (k: keyof typeof loaded) => (e: Error) => {
      console.warn(`Sin acceso a ${k}:`, e.message);
      loaded[k] = true;
      tryDone();
    };

    const unsubPumps = onSnapshot(collection(db, 'pumps'), snap => {
      setPumpsState(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pump)));
      loaded.pumps = true;
      tryDone();
    }, sinPermiso('pumps'));

    const unsubPrices = onSnapshot(
      query(collection(db, 'prices'), orderBy('timestamp', 'desc')),
      snap => {
        const prices = snap.docs.map(d => ({ id: d.id, ...d.data() } as FuelPrice));
        setPriceHistory(prices);
        if (prices.length > 0) {
          setCurrentPricesState({ super: prices[0].super, regular: prices[0].regular, diesel: prices[0].diesel });
        }
        loaded.prices = true;
        tryDone();
      },
      sinPermiso('prices')
    );

    const unsubDay = onSnapshot(doc(db, 'dayStatus', todayDoc), snap => {
      if (snap.exists()) {
        const data = snap.data() as DayStatus;
        setDayStatusState(data.status);
        setDayData(data);
      } else {
        setDayStatusState('en_proceso');
        setDayData({ date: todayDoc, status: 'en_proceso' });
      }
      loaded.day = true;
      tryDone();
    }, sinPermiso('day'));

    const unsubReadings = onSnapshot(
      query(collection(db, 'readings'), where('date', '==', todayDoc)),
      snap => {
        setReadingsState(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyReading)));
        loaded.readings = true;
        tryDone();
      },
      sinPermiso('readings')
    );

    const unsubRoles = onSnapshot(collection(db, 'roles'), snap => {
      setRoles(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppRole)));
      loaded.roles = true;
      tryDone();
    }, sinPermiso('roles'));

    return () => { unsubPumps(); unsubPrices(); unsubDay(); unsubReadings(); unsubRoles(); };
  }, [autorizado, todayDoc]);

  // Auditoría y usuarios solo para roles con permiso (las reglas los niegan al resto).
  const permisos = roles.find(r => r.id === appUser?.roleId)?.permissions;
  const verAuditoria = autorizado && permisos?.canViewAudit === true;
  const verUsuarios = autorizado && permisos?.canManageUsers === true;

  useEffect(() => {
    if (!verAuditoria) { setAuditLog([]); return; }
    return onSnapshot(
      query(collection(db, 'auditLog'), orderBy('timestamp', 'desc')),
      snap => setAuditLog(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditEntry))),
      e => console.warn('Sin acceso a auditoría:', e.message),
    );
  }, [verAuditoria]);

  useEffect(() => {
    if (!verUsuarios) { setUsers([]); return; }
    return onSnapshot(
      collection(db, 'users'),
      snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser))),
      e => console.warn('Sin acceso a usuarios:', e.message),
    );
  }, [verUsuarios]);

  const setPumps = useCallback(async (newPumps: Pump[]) => {
    const batch = writeBatch(db);
    newPumps.forEach(pump => {
      batch.set(doc(db, 'pumps', pump.id), pump);
    });
    await batch.commit();
  }, []);

  const setDayStatus = useCallback(async (s: DayStatusValue) => {
    await setDoc(doc(db, 'dayStatus', todayDoc), { status: s }, { merge: true });
  }, [todayDoc]);

  const updateDayData = useCallback(async (data: Partial<DayStatus>) => {
    await setDoc(doc(db, 'dayStatus', todayDoc), { date: todayDoc, ...data }, { merge: true });
  }, [todayDoc]);

  const addAuditEntry = useCallback(async (entry: Omit<AuditEntry, 'id'>) => {
    await addDoc(collection(db, 'auditLog'), entry);
  }, []);

  const addPriceEntry = useCallback(async (entry: FuelPrice) => {
    const { id: _id, ...rest } = entry as FuelPrice & { id?: string };
    await addDoc(collection(db, 'prices'), { ...rest, timestamp: new Date().getTime() });
  }, []);

  const setCurrentPrices = useCallback(async (p: { super: number; regular: number; diesel: number }) => {
    setCurrentPricesState(p);
    const today = new Date().toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    await addDoc(collection(db, 'prices'), { date: today, ...p, registeredBy: 'Operador', timestamp: new Date().getTime() });
  }, []);

  const saveReadings = useCallback(async (newReadings: DailyReading[]) => {
    const batch = writeBatch(db);
    newReadings.forEach(reading => {
      const docRef = reading.id ? doc(db, 'readings', reading.id) : doc(collection(db, 'readings'));
      const { id, ...data } = reading;
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      batch.set(docRef, cleanData, { merge: true });
    });
    await batch.commit();
  }, []);

  const saveUser = useCallback(async (user: AppUser) => {
    // If saving a new user and id is not provided, use email as id
    const docId = user.id || user.email;
    const { id, ...data } = user;
    await setDoc(doc(db, 'users', docId), data, { merge: true });
  }, []);

  const saveRole = useCallback(async (role: AppRole) => {
    const docId = role.id;
    await setDoc(doc(db, 'roles', docId), role, { merge: true });
  }, []);

  return (
    <AppContext.Provider value={{
      pumps, setPumps,
      dayStatus, setDayStatus,
      dayData, updateDayData,
      auditLog, addAuditEntry,
      priceHistory, addPriceEntry,
      currentPrices, setCurrentPrices,
      readings, saveReadings,
      users, roles, saveUser, saveRole,
      loading,
      today: todayDoc,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
