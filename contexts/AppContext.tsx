'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import {
  collection, doc, setDoc, addDoc, writeBatch, onSnapshot, query, orderBy, getDocs, where, runTransaction, serverTimestamp, Timestamp, limit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Pump, AuditEntry, FuelPrice, DayStatusValue, DailyReading, DayStatus, AppUser, AppRole, Operacion } from '@/types';
import { INITIAL_PUMPS, PRICE_HISTORY, FUELS, DEFAULT_DIFERENCIAL_POR_LITRO } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { diaOperativo } from '@/lib/fecha';
import { idLectura } from '@/lib/totalizadores';
import { ordenarPorVigencia, preciosDeLectura, preciosVigentesEn, precioVigente, proximoPrecio, type Precios } from '@/lib/precios';
import { armarEntrada, ordenarAuditoria, type AuditInput } from '@/lib/auditoria';
import { normalizarOperacion, OPERACION_DEFAULT } from '@/lib/turnos';


interface AppContextType {
  pumps: Pump[];
  setPumps: (pumps: Pump[]) => Promise<void>;
  dayStatus: DayStatusValue;
  setDayStatus: (s: DayStatusValue) => Promise<void>;
  auditLog: AuditEntry[];
  /** Registra en auditoría. Quién (uid, nombre de la ficha, rol) y cuándo (`at` del servidor) los pone el contexto. */
  addAuditEntry: (entry: AuditInput) => Promise<void>;
  /** Entrada de auditoría firmada por la sesión, para escribirla dentro de una transacción (at = hora del servidor). */
  entradaAuditoria: (entry: AuditInput) => Record<string, unknown>;
  /** Historial ordenado por vigencia (más reciente primero). */
  priceHistory: FuelPrice[];
  addPriceEntry: (entry: FuelPrice) => Promise<void>;
  /** Precio por litro vigente ahora (se reevalúa cada minuto). */
  currentPrices: Precios;
  /** Entrada vigente ahora (null si no hay ninguna y se usa la semilla). */
  precioActual: FuelPrice | null;
  /** Próximo precio programado (vigencia futura), si lo hay. */
  precioProximo: FuelPrice | null;
  /** Precio por litro que rige en un instante (Lectura inicial lo toma al confirmar). */
  preciosEn: (instante: Date) => Precios;
  /** Precios de respaldo para calcVenta: los vigentes cuando se abrió cada lectura vieja sin fuelPrice (TASK-023). */
  preciosLectura: (r: { date?: string; createdAt?: string }) => Precios;
  /** Registra un precio que rige desde `vigenteDesde` (ISO). No toca lecturas ya abiertas. */
  setCurrentPrices: (p: Precios, vigenteDesde: string) => Promise<void>;
  readings: DailyReading[];
  /** Actualiza lecturas existentes (merge). Sin `id` usa el ID determinista `{fecha}_{dispenserId}`. */
  saveReadings: (readings: DailyReading[]) => Promise<void>;
  /**
   * Crea lecturas iniciales con ID determinista en una transacción: si ya existe la de ese
   * dispensador y fecha no se pisa. Devuelve los dispenserId creados y los que ya existían.
   */
  createInitialReadings: (readings: DailyReading[]) => Promise<{ creadas: string[]; existentes: string[] }>;
  loading: boolean;
  /** Fecha ISO (YYYY-MM-DD) del día operativo que escucha el contexto. */
  today: string;
  dayData: DayStatus | null;
  updateDayData: (data: Partial<DayStatus>) => Promise<void>;
  users: AppUser[];
  roles: AppRole[];
  saveUser: (user: AppUser) => Promise<void>;
  saveRole: (role: AppRole) => Promise<void>;
  /** settings/operacion (TASK-019). Sin doc: turnos apagados. */
  operacion: Operacion;
}

const AppContext = createContext<AppContextType | null>(null);

// Datos a escribir de una lectura: sin `id` (va en la ruta) ni campos undefined (Firestore los rechaza).
const datosLectura = (r: DailyReading) => Object.fromEntries(Object.entries(r).filter(([k, v]) => k !== 'id' && v !== undefined));

// Precio por litro de respaldo mientras carga el historial (mismos valores que la semilla).
const DEFAULT_PRICES = Object.fromEntries(FUELS.map(f => [f.id, f.price])) as { super: number; regular: number; diesel: number };

export function AppProvider({ children }: { children: ReactNode }) {
  const [pumps, setPumpsState] = useState<Pump[]>([]);
  const [dayStatus, setDayStatusState] = useState<DayStatusValue>('en_proceso');
  const [dayData, setDayData] = useState<DayStatus | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [priceHistory, setPriceHistory] = useState<FuelPrice[]>([]);
  const [readings, setReadingsState] = useState<DailyReading[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [operacion, setOperacion] = useState<Operacion>(OPERACION_DEFAULT);
  const [loading, setLoading] = useState(true);
  const { appUser, loading: authLoading } = useAuth();
  // Las reglas de Firestore solo permiten leer/escribir con sesión y ficha activa:
  // la siembra y las suscripciones arrancan cuando hay un usuario autorizado.
  const autorizado = !!appUser && appUser.status === 'activo';

  // Día operativo en hora de Honduras; se revisa cada minuto para cambiar de día sin recargar.
  const [todayDoc, setTodayDoc] = useState(() => diaOperativo());
  // Minuto actual (ISO): el precio vigente cambia solo cuando llega su vigencia.
  const [minuto, setMinuto] = useState(() => new Date().toISOString().slice(0, 16));
  useEffect(() => {
    const t = setInterval(() => {
      setTodayDoc(d => { const n = diaOperativo(); return n === d ? d : n; });
      setMinuto(new Date().toISOString().slice(0, 16));
    }, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!authLoading && !autorizado) {
      // Sesión cerrada: no dejar en memoria datos del usuario anterior (p. ej. auditoría de un admin).
      setPumpsState([]); setAuditLog([]); setPriceHistory([]); setReadingsState([]);
      setUsers([]); setRoles([]); setDayData(null); setOperacion(OPERACION_DEFAULT);
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
          batch.set(doc(db, 'prices', `seed_${i}`), { ...rest, timestamp: Date.now() - i * 1000 }); // fecha real de alta: nunca en el futuro (el vigente es el más reciente)
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
        setPriceHistory(ordenarPorVigencia(snap.docs.map(d => ({ id: d.id, ...d.data() } as FuelPrice))));
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

  // Turnos (TASK-019): fuera de la carga inicial; si no existe o falla, todo sigue como siempre (flag apagado).
  useEffect(() => {
    if (!autorizado) return;
    return onSnapshot(
      doc(db, 'settings', 'operacion'),
      snap => setOperacion(normalizarOperacion(snap.exists() ? snap.data() : undefined)),
      e => { console.warn('Sin acceso a settings/operacion:', e.message); setOperacion(OPERACION_DEFAULT); },
    );
  }, [autorizado]);

  // Auditoría y usuarios solo para roles con permiso (las reglas los niegan al resto).
  const permisos = roles.find(r => r.id === appUser?.roleId)?.permissions;
  const verAuditoria = autorizado && permisos?.canViewAudit === true;
  const verUsuarios = autorizado && permisos?.canManageUsers === true;

  useEffect(() => {
    if (!verAuditoria) { setAuditLog([]); return; }
    // Las 500 más recientes por `at` (hora del servidor): la colección crece sin tope y no conviene
    // escucharla entera. Las entradas anteriores a TASK-017 (sin `at`) quedan en Firestore pero fuera de
    // esta vista. Se reordena en el cliente por si llegan con hora estimada.
    return onSnapshot(
      query(collection(db, 'auditLog'), orderBy('at', 'desc'), limit(500)),
      snap => setAuditLog(ordenarAuditoria(snap.docs.map(d => {
        const data = d.data({ serverTimestamps: 'estimate' });
        const at = data.at instanceof Timestamp ? data.at.toDate().toISOString() : typeof data.at === 'string' ? data.at : undefined;
        return { id: d.id, ...data, at } as AuditEntry;
      }))),
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

  const rolNombre = roles.find(r => r.id === appUser?.roleId)?.name || appUser?.roleId || 'Desconocido';
  const addAuditEntry = useCallback(async (entry: AuditInput) => {
    // Las reglas exigen userId == auth.uid y userName == nombre de la ficha: salen siempre de la sesión.
    if (!appUser?.uid) throw new Error('Sin sesión: no se puede registrar en auditoría.');
    const e = armarEntrada(entry, { uid: appUser.uid, name: appUser.name, roleName: rolNombre }, new Date());
    await addDoc(collection(db, 'auditLog'), { ...e, at: serverTimestamp() });
  }, [appUser, rolNombre]);
  const entradaAuditoria = useCallback((entry: AuditInput): Record<string, unknown> => {
    if (!appUser?.uid) throw new Error('Sin sesión: no se puede registrar en auditoría.');
    return { ...armarEntrada(entry, { uid: appUser.uid, name: appUser.name, roleName: rolNombre }, new Date()), at: serverTimestamp() };
  }, [appUser, rolNombre]);

  const addPriceEntry = useCallback(async (entry: FuelPrice) => {
    const { id: _id, ...rest } = entry as FuelPrice & { id?: string };
    await addDoc(collection(db, 'prices'), { ...rest, timestamp: new Date().getTime() });
  }, []);

  const precioActual = useMemo(() => precioVigente(priceHistory, `${minuto}:59.999Z`), [priceHistory, minuto]);
  const precioProximo = useMemo(() => proximoPrecio(priceHistory, `${minuto}:59.999Z`), [priceHistory, minuto]);
  const currentPrices = useMemo<Precios>(
    () => (precioActual ? { super: precioActual.super, regular: precioActual.regular, diesel: precioActual.diesel } : DEFAULT_PRICES),
    [precioActual],
  );
  const preciosEn = useCallback((instante: Date): Precios => preciosVigentesEn(priceHistory, instante.toISOString()) ?? DEFAULT_PRICES, [priceHistory]);
  const preciosLectura = useCallback((r: { date?: string; createdAt?: string }): Precios => preciosDeLectura(priceHistory, r) ?? currentPrices, [priceHistory, currentPrices]);

  const setCurrentPrices = useCallback(async (p: Precios, vigenteDesde: string) => {
    await addDoc(collection(db, 'prices'), {
      date: diaOperativo(new Date(vigenteDesde)),
      vigenteDesde,
      ...p,
      registeredBy: appUser?.name || appUser?.email || 'Desconocido',
      timestamp: new Date().getTime(),
    });
  }, [appUser]);

  const saveReadings = useCallback(async (newReadings: DailyReading[]) => {
    const batch = writeBatch(db);
    newReadings.forEach(reading => {
      const docRef = doc(db, 'readings', reading.id || idLectura(reading.date, reading.dispenserId));
      batch.set(docRef, datosLectura(reading), { merge: true });
    });
    await batch.commit();
  }, []);

  const createInitialReadings = useCallback(async (newReadings: DailyReading[]) => {
    return runTransaction(db, async tx => {
      const refs = newReadings.map(r => doc(db, 'readings', idLectura(r.date, r.dispenserId)));
      // Todas las lecturas de la transacción van antes de cualquier escritura.
      const snaps = await Promise.all(refs.map(ref => tx.get(ref)));
      const creadas: string[] = [];
      const existentes: string[] = [];
      newReadings.forEach((r, i) => {
        if (snaps[i].exists()) { existentes.push(r.dispenserId); return; }
        tx.set(refs[i], datosLectura(r));
        creadas.push(r.dispenserId);
      });
      return { creadas, existentes };
    });
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
      auditLog, addAuditEntry, entradaAuditoria,
      priceHistory, addPriceEntry,
      currentPrices, setCurrentPrices, precioActual, precioProximo, preciosEn, preciosLectura,
      readings, saveReadings, createInitialReadings,
      users, roles, saveUser, saveRole,
      operacion,
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
