import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Pump, DailyReading, FuelPrice, AuditEntry, DayStatus } from '@/types';

// ─── Pumps ───────────────────────────────────────────────────────────────────
export async function getPumps(): Promise<Pump[]> {
  const snap = await getDocs(collection(db, 'pumps'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Pump));
}

export async function savePump(pump: Pump): Promise<void> {
  await setDoc(doc(db, 'pumps', pump.id), pump);
}

export async function deletePump(pumpId: string): Promise<void> {
  await deleteDoc(doc(db, 'pumps', pumpId));
}

// ─── Readings ────────────────────────────────────────────────────────────────
export async function getReadingsByDate(date: string): Promise<DailyReading[]> {
  const q = query(collection(db, 'readings'), where('date', '==', date));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyReading));
}

export async function saveReading(reading: Omit<DailyReading, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'readings'), reading);
  return ref.id;
}

export async function updateReading(id: string, data: Partial<DailyReading>): Promise<void> {
  await updateDoc(doc(db, 'readings', id), data);
}

// ─── Day Status ──────────────────────────────────────────────────────────────
export async function getDayStatus(date: string): Promise<DayStatus | null> {
  const snap = await getDoc(doc(db, 'dayStatus', date));
  if (!snap.exists()) return null;
  return snap.data() as DayStatus;
}

export async function setDayStatus(status: DayStatus): Promise<void> {
  await setDoc(doc(db, 'dayStatus', status.date), status);
}

// ─── Fuel Prices ─────────────────────────────────────────────────────────────
export async function getFuelPrices(): Promise<FuelPrice[]> {
  const q = query(collection(db, 'prices'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FuelPrice));
}

export async function saveFuelPrice(price: Omit<FuelPrice, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'prices'), price);
  return ref.id;
}

// ─── Audit Log ───────────────────────────────────────────────────────────────
export async function getAuditLog(): Promise<AuditEntry[]> {
  const q = query(collection(db, 'auditLog'), orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditEntry));
}

export async function addAuditEntry(entry: Omit<AuditEntry, 'id'>): Promise<void> {
  await addDoc(collection(db, 'auditLog'), entry);
}
