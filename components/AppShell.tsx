'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import Sidebar from './layout/Sidebar';
import Topbar from './layout/Topbar';
import ToastContainer from './overlays/ToastContainer';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import LecturaInicialScreen from './screens/LecturaInicialScreen';
import LecturaFinalScreen from './screens/LecturaFinalScreen';
import ReporteDiarioScreen from './screens/ReporteDiarioScreen';
import ReporteMensualScreen from './screens/ReporteMensualScreen';
import PreciosScreen from './screens/PreciosScreen';
import BombasScreen from './screens/BombasScreen';
import AuditoriaScreen from './screens/AuditoriaScreen';

type Route = 'dashboard' | 'lectura-inicial' | 'lectura-final' | 'reporte-diario' | 'reporte-mensual' | 'precios' | 'bombas' | 'auditoria';

export default function AppShell() {
  const { user, loading } = useAuth();
  const { dayStatus } = useApp();
  const [route, setRoute] = useState<Route>('dashboard');

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'grid', placeItems: 'center', background: '#0a1530' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fbbf24', display: 'grid', placeItems: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0a1530" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 22V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v18"/><path d="M3 22h12"/><path d="M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5V17a2 2 0 0 0 4 0V8l-3-3"/><path d="M5 7h6"/>
            </svg>
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', fontFamily: 'inherit' }}>Cargando...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginScreen />
        <ToastContainer />
      </>
    );
  }

  const screens: Record<Route, React.ReactNode> = {
    'dashboard': <DashboardScreen setRoute={r => setRoute(r as Route)}/>,
    'lectura-inicial': <LecturaInicialScreen />,
    'lectura-final': <LecturaFinalScreen />,
    'reporte-diario': <ReporteDiarioScreen />,
    'reporte-mensual': <ReporteMensualScreen />,
    'precios': <PreciosScreen />,
    'bombas': <BombasScreen />,
    'auditoria': <AuditoriaScreen />,
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '248px 1fr', height: '100vh', overflow: 'hidden' }}>
        <Sidebar route={route} setRoute={r => setRoute(r as Route)} dayStatus={dayStatus} />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f4f6f9', overflow: 'hidden' }}>
          <Topbar route={route} />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {screens[route]}
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}
