'use client';

import Icon from '@/components/ui/Icon';
import DayStatusBadge from '@/components/ui/DayStatusBadge';
import { DayStatusValue } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useMemo } from 'react';

interface SidebarProps {
  route: string;
  setRoute: (r: string) => void;
  dayStatus: DayStatusValue;
  isOpen?: boolean;
}

const ALL_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'lectura-inicial', label: 'Lectura inicial', icon: 'log-in' },
  { key: 'lectura-final', label: 'Lectura final', icon: 'log-out' },
  { key: 'control-combustible', label: 'Control inventario', icon: 'droplet', perm: 'canManageInventory' },
  { key: 'reporte-diario', label: 'Reporte diario', icon: 'file' },
  { key: 'reporte-mensual', label: 'Reporte mensual', icon: 'calendar' },
  { key: 'precios', label: 'Precio del combustible', icon: 'tag', perm: 'canEditPrices' },
  { key: 'bombas', label: 'Configuración bombas', icon: 'fuel', perm: 'canManagePumps' },
  { key: 'usuarios', label: 'Usuarios y roles', icon: 'users', perm: 'canManageUsers' },
  { key: 'auditoria', label: 'Auditoría', icon: 'shield', perm: 'canViewAudit' },
];

export default function Sidebar({ route, setRoute, dayStatus, isOpen = false }: SidebarProps) {
  const { appUser } = useAuth();
  const { roles } = useApp();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });

  const allowedItems = useMemo(() => {
    const userRole = roles.find(r => r.id === appUser?.roleId);
    if (!userRole) return ALL_ITEMS.filter(it => !it.perm);
    
    return ALL_ITEMS.filter(it => {
      if (!it.perm) return true;
      return (userRole.permissions as any)[it.perm] === true;
    });
  }, [roles, appUser]);

  return (
    <aside className={`sidebar-container ${isOpen ? 'open' : ''}`}>
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: '#fbbf24', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="fuel" size={20} style={{ color: '#0a1530' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'white', lineHeight: 1.1 }}>Combustibles</div>
            <div style={{ fontSize: 10.5, color: '#94a3b8', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 2 }}>Guaimaca Centro</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {allowedItems.map((it) => {
          const active = route === it.key;
          return (
            <button
              key={it.key}
              onClick={() => setRoute(it.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8, border: 0, cursor: 'pointer',
                background: active ? 'rgba(251,191,36,.12)' : 'transparent',
                color: active ? '#fbbf24' : '#cbd5e1',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit', letterSpacing: 0.1,
                textAlign: 'left', position: 'relative', width: '100%',
              }}
            >
              {active && <span style={{ position: 'absolute', left: -10, top: 8, bottom: 8, width: 3, borderRadius: 2, background: '#fbbf24' }} />}
              <Icon name={it.icon} size={16} />
              <span>{it.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{
          background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: 12,
          border: '1px solid rgba(255,255,255,.06)',
        }}>
          <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Estado del día</div>
          <DayStatusBadge status={dayStatus} />
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, fontFamily: 'ui-monospace, monospace' }}>
            {now.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' })} · {timeStr}
          </div>
        </div>
      </div>
    </aside>
  );
}
