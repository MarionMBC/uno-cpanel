'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Pump, AuditEntry, FuelPrice, DayStatusValue } from '@/types';
import { INITIAL_PUMPS, FUELS, AUDIT_LOG_INITIAL, PRICE_HISTORY } from '@/lib/constants';

interface AppContextType {
  pumps: Pump[];
  setPumps: (pumps: Pump[]) => void;
  dayStatus: DayStatusValue;
  setDayStatus: (s: DayStatusValue) => void;
  auditLog: AuditEntry[];
  addAuditEntry: (entry: Omit<AuditEntry, 'id'>) => void;
  priceHistory: FuelPrice[];
  addPriceEntry: (entry: FuelPrice) => void;
  currentPrices: { super: number; regular: number; diesel: number };
  setCurrentPrices: (p: { super: number; regular: number; diesel: number }) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [pumps, setPumps] = useState<Pump[]>(INITIAL_PUMPS);
  const [dayStatus, setDayStatus] = useState<DayStatusValue>('en_proceso');
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(AUDIT_LOG_INITIAL as AuditEntry[]);
  const [priceHistory, setPriceHistory] = useState<FuelPrice[]>(PRICE_HISTORY as FuelPrice[]);
  const [currentPrices, setCurrentPrices] = useState({ super: 108.42, regular: 102.18, diesel: 96.74 });

  const addAuditEntry = (entry: Omit<AuditEntry, 'id'>) => {
    const newEntry: AuditEntry = { ...entry, id: Math.random().toString(36).slice(2) };
    setAuditLog(prev => [newEntry, ...prev]);
  };

  const addPriceEntry = (entry: FuelPrice) => {
    setPriceHistory(prev => [entry, ...prev]);
  };

  return (
    <AppContext.Provider value={{
      pumps, setPumps,
      dayStatus, setDayStatus,
      auditLog, addAuditEntry,
      priceHistory, addPriceEntry,
      currentPrices, setCurrentPrices,
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
