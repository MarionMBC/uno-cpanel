'use client';

import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import Avatar from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import ConfirmDialog from '@/components/overlays/ConfirmDialog';

const TITLES: Record<string, string> = {
  'dashboard': 'Dashboard',
  'lectura-inicial': 'Registro de lectura inicial',
  'lectura-final': 'Registro de lectura final',
  'control-combustible': 'Control inventario',
  'reporte-diario': 'Reporte diario',
  'reporte-mensual': 'Reporte mensual',
  'precios': 'Precio del combustible',
  'bombas': 'Configuración de bombas',
  'usuarios': 'Usuarios y roles',
  'auditoria': 'Auditoría y control',
};

interface TopbarProps {
  route: string;
  onMenuClick: () => void;
}

export default function Topbar({ route, onMenuClick }: TopbarProps) {
  const { user, appUser, logout } = useAuth();
  const { roles } = useApp();
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const name = appUser?.name || user?.displayName || user?.email?.split('@')[0] || 'Usuario';
  const roleName = roles.find(r => r.id === appUser?.roleId)?.name || 'Usuario';

  return (
    <>
      <header style={{
        height: 64, background: 'white', borderBottom: '1px solid #e6e8ec',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0,
      }}>
        <button className="topbar-menu-btn" onClick={onMenuClick}>
          <Icon name="menu" size={20} style={{ color: '#0f172a' }} />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>
            UNO Guaimaca Centro
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', letterSpacing: -0.2 }}>
            {TITLES[route] || 'Panel'}
          </div>
        </div>

        <div className="topbar-search-wrapper" style={{
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          background: '#f8fafc', borderRadius: 10, padding: '6px 12px',
          border: '1px solid #e2e8f0',
        }}>
          <Icon name="search" size={14} style={{ color: '#94a3b8' }} />
          <input
            placeholder="Buscar..."
            style={{
              border: 0, background: 'transparent', outline: 'none',
              fontSize: 12, fontFamily: 'inherit', width: 140, color: '#334155',
            }}
          />
        </div>

        <button className="topbar-icon-btn" style={{
          position: 'relative', width: 38, height: 38, borderRadius: 9,
          background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer',
          display: 'grid', placeItems: 'center', color: '#475569', flexShrink: 0,
        }}>
          <Icon name="bell" size={16} />
          <span style={{ position: 'absolute', top: 8, right: 8, width: 6, height: 6, background: '#ef4444', borderRadius: 999 }} />
        </button>

        <div className="topbar-user-info" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12, borderLeft: '1px solid #e2e8f0', flexShrink: 0 }}>
          <Avatar name={name} size={36} color="#0f1f3d" />
          <div className="topbar-user-text" style={{ lineHeight: 1.15, whiteSpace: 'nowrap' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{roleName}</div>
          </div>
          <button
            onClick={() => setLogoutConfirm(true)}
            title="Cerrar sesión"
            className="topbar-logout-btn"
            style={{
              width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0',
              background: 'white', cursor: 'pointer', color: '#64748b',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}
          >
            <Icon name="log-out" size={14} />
          </button>
        </div>
      </header>
      <ConfirmDialog
        open={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        title="¿Cerrar sesión?"
        message="Estás a punto de salir de tu cuenta corporativa. Tendrás que volver a iniciar sesión para acceder al panel."
        confirmLabel="Salir"
        icon="log-out"
        tone="warning"
        onConfirm={logout}
      />
    </>
  );
}
