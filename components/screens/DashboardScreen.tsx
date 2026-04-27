'use client';

import { useApp } from '@/contexts/AppContext';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { fmtL, fmtNum, getDayOfWeekEs, getMonthEs } from '@/lib/utils';
import { LITERS_PER_GALLON } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';

const TREND_14D = (() => {
  const arr = [];
  for (let i = 13; i >= 0; i--) {
    const seed = i * 17 + 7;
    arr.push({
      day: i,
      liters: Math.floor(2400 + (seed % 9) * 133),
      lempiras: Math.floor(240000 + (seed % 9) * 15556),
    });
  }
  return arr;
})();

interface DashboardScreenProps {
  setRoute: (r: string) => void;
}

export default function DashboardScreen({ setRoute }: DashboardScreenProps) {
  const { pumps, auditLog, dayStatus } = useApp();
  const { user } = useAuth();

  const name = user?.displayName?.split(' ')[0] || 'Usuario';
  const today = new Date();
  const todayLabel = `${getDayOfWeekEs(today)} · ${today.getDate()} de ${getMonthEs(today)}, ${today.getFullYear()}`;

  const totals = { lempiras: 287_412.55, liters: 2842.18, gallons: 2842.18 / LITERS_PER_GALLON };
  const trendM = TREND_14D.map(d => d.lempiras);
  const maxV = Math.max(...trendM);

  const QUICK_ACTIONS = [
    { l: 'Lectura inicial', i: 'log-in', r: 'lectura-inicial', c: '#16a34a' },
    { l: 'Lectura final', i: 'log-out', r: 'lectura-final', c: '#d97706' },
    { l: 'Reporte diario', i: 'file', r: 'reporte-diario', c: '#0f1f3d' },
    { l: 'Configurar precios', i: 'tag', r: 'precios', c: '#3b82f6' },
    { l: 'Configurar bombas', i: 'fuel', r: 'bombas', c: '#475569' },
    { l: 'Auditoría', i: 'shield', r: 'auditoria', c: '#475569' },
  ];

  const ICON_MAP: Record<string, string> = { 'log-in': 'log-in', 'log-out': 'log-out', tag: 'tag', wrench: 'wrench', lock: 'lock', edit: 'edit' };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Greeting */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: '#d97706', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>{todayLabel}</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: -0.4, marginTop: 4, marginBottom: 0 }}>
            Buenos días, {name}.
          </h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Tienes <b style={{ color: '#d97706' }}>3 lecturas finales pendientes</b> antes de cerrar el día.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" icon="download">Exportar Excel</Button>
          <Button variant="primary" icon="log-out" onClick={() => setRoute('lectura-final')}>Registrar lectura final</Button>
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard tone="primary" label="Vendido hoy" icon="fuel" value={fmtL(totals.lempiras)} sub="vs. ayer" trend={6.2}/>
        <StatCard tone="neutral" label="Litros vendidos" icon="droplet" value={fmtNum(totals.liters, 2)} sub="L · hoy" trend={4.8}/>
        <StatCard tone="neutral" label="Galones vendidos" icon="droplet" value={fmtNum(totals.gallons, 2)} sub="gal · hoy" trend={4.8}/>
        <StatCard tone="accent" label="Bombas activas" icon="gauge" value="2 / 3" sub="1 en mantenimiento"/>
      </div>

      {/* Trend + quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Ventas · últimos 14 días</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3, marginTop: 4 }}>
                {fmtL(trendM.reduce((a, b) => a + b, 0))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge tone="success" dot>Lempiras</Badge>
              <Badge tone="neutral" dot>Litros</Badge>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, marginTop: 12 }}>
            {TREND_14D.map((d, i) => {
              const h = (d.lempiras / maxV) * 100;
              const isToday = i === TREND_14D.length - 1;
              return (
                <div key={i} style={{ flex: 1, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                  <div style={{
                    width: '100%', height: `${h}%`,
                    background: isToday ? '#d97706' : '#0f1f3d',
                    borderRadius: '4px 4px 0 0',
                    opacity: isToday ? 1 : 0.85,
                  }}/>
                  <span style={{ fontSize: 9.5, color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>
                    {String(26 - (TREND_14D.length - 1 - i)).padStart(2, '0')}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, marginBottom: 12 }}>Accesos rápidos</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {QUICK_ACTIONS.map((a) => (
              <button key={a.l} onClick={() => setRoute(a.r)} style={{
                background: '#f8fafc', border: '1px solid #e6e8ec', borderRadius: 10,
                padding: '12px 10px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'inherit',
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'white', boxShadow: '0 0 0 1px #e6e8ec', display: 'grid', placeItems: 'center', color: a.c }}>
                  <Icon name={a.i} size={14}/>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{a.l}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Pump status row */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: -0.2, margin: 0 }}>Estado de bombas</h3>
          <button onClick={() => setRoute('bombas')} style={{ background: 'transparent', border: 0, color: '#0f1f3d', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
            Ver todas <Icon name="chevron-right" size={12}/>
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {pumps.map((p) => {
            const allRows = p.faces.flatMap(f => f.dispensers);
            const liters = allRows.reduce((s, r) => s + 280, 0);
            const lemp = liters * p.fuel.price;
            const completed = Math.floor(allRows.length * 0.7);
            return (
              <Card key={p.id} hoverable>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: p.fuel.color + '22', color: p.fuel.color, display: 'grid', placeItems: 'center' }}>
                      <Icon name="fuel" size={18}/>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{p.fuel.name} · L. {p.fuel.price.toFixed(2)}/L</div>
                    </div>
                  </div>
                  {p.isActive
                    ? <Badge tone="success" dot>Activa</Badge>
                    : <Badge tone="warning" icon="wrench">Mantenim.</Badge>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>Vendido hoy</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtL(lemp)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>Litros</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtNum(liters, 1)}</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, padding: 10, background: '#f8fafc', borderRadius: 8, fontSize: 11, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Dispensadores completos</span>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{completed} / {allRows.length}</span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Latest activity */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: -0.2, margin: 0 }}>Actividad reciente</h3>
          <button onClick={() => setRoute('auditoria')} style={{ background: 'transparent', border: 0, color: '#0f1f3d', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Ver auditoría →
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {auditLog.slice(0, 5).map((a, i) => (
            <div key={a.id} style={{
              display: 'grid', gridTemplateColumns: '40px 1fr auto auto', gap: 12,
              padding: '12px 4px', alignItems: 'center',
              borderTop: i ? '1px solid #f1f5f9' : undefined,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f1f5f9', color: '#0f1f3d', display: 'grid', placeItems: 'center' }}>
                <Icon name={a.icon} size={14}/>
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{a.action} · <span style={{ color: '#475569', fontWeight: 500 }}>{a.target}</span></div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{a.detail}</div>
              </div>
              <div style={{ fontSize: 11.5, color: '#475569' }}>{a.userName}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>{a.timestamp}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
