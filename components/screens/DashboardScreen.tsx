'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import { DailyReading } from '@/types';
import { rangoDias, ventasPorDia } from '@/lib/reportes';
import { fechaCortaHN } from '@/lib/fecha';
import * as XLSX from 'xlsx';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { fmtL, fmtNum, getDayOfWeekEs, getMonthEs } from '@/lib/utils';
import { LITERS_PER_GALLON, productosDeBomba } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import { calcVenta, lecturasPorDispensador, round, sumarVentas } from '@/lib/totalizadores';

const DIAS_TENDENCIA = 14;

interface DashboardScreenProps {
  setRoute: (r: string) => void;
}

export default function DashboardScreen({ setRoute }: DashboardScreenProps) {
  const { pumps, auditLog, readings, roles, preciosLectura, today: hoy } = useApp();
  const { user, appUser } = useAuth();
  const toast = useToast();

  // Ventas reales de los últimos 14 días: días pasados por rango de `date` (índice simple, sin compuesto);
  // el día de hoy sale en vivo del contexto.
  const dias = useMemo(() => rangoDias(hoy, DIAS_TENDENCIA), [hoy]);
  const [pasadas, setPasadas] = useState<{ desde: string; lecturas: DailyReading[] } | null>(null);
  const [errorTendencia, setErrorTendencia] = useState(false);
  useEffect(() => {
    let vivo = true;
    getDocs(query(collection(db, 'readings'), where('date', '>=', dias[0]), where('date', '<', hoy)))
      .then(snap => { if (vivo) { setPasadas({ desde: dias[0], lecturas: snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyReading)) }); setErrorTendencia(false); } })
      .catch(e => { console.warn('Sin tendencia:', e); if (vivo) setErrorTendencia(true); });
    return () => { vivo = false; };
  }, [dias, hoy]);
  const tendencia = useMemo(
    () => ventasPorDia([...(pasadas?.desde === dias[0] ? pasadas.lecturas : []), ...readings.filter(r => r.date === hoy)], dias, preciosLectura),
    [pasadas, readings, dias, hoy, preciosLectura],
  );

  const name = appUser?.name || user?.displayName?.split(' ')[0] || 'Usuario';
  const role = roles.find(r => r.id === appUser?.roleId);

  const today = new Date();
  const todayLabel = `${getDayOfWeekEs(today)} · ${today.getDate()} de ${getMonthEs(today)}, ${today.getFullYear()}`;

  // Mismo cálculo y redondeo que Lectura final y el Cuadro (calcVenta), una lectura por dispensador.
  const totals = useMemo(() => {
    const { litros, total } = sumarVentas(lecturasPorDispensador(readings).values(), preciosLectura);
    return { lempiras: total, liters: litros, gallons: litros / LITERS_PER_GALLON };
  }, [readings, preciosLectura]);

  const activePumps = pumps.filter(p => p.isActive);
  const totalActiveDispensers = activePumps.flatMap(p => p.faces.flatMap(f => f.dispensers.filter(d => d.status === 'activo'))).length;
  const completedFinals = readings.filter(r => r.status === 'activo' && r.finalReading !== undefined).length;
  const pendingFinals = Math.max(0, totalActiveDispensers - completedFinals);

  const maxV = Math.max(...tendencia.map(d => d.total), 1); // 1 evita dividir entre 0
  const totalTendencia = tendencia.reduce((a, d) => a + d.total, 0);

  const exportExcel = () => {
    const rows = tendencia.map(d => ({
      'Fecha': fechaCortaHN(d.fecha),
      'Litros': d.litros,
      'Galones': round(d.litros / LITERS_PER_GALLON, 2),
      'Total L.': d.total,
      'Lecturas pendientes': d.pendientes,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas 14 días');
    const nombre = `Ventas_${dias[0]}_a_${hoy}.xlsx`;
    XLSX.writeFile(wb, nombre);
    toast.success('Excel exportado', `${nombre} descargado.`);
  };

  const ALL_QUICK_ACTIONS = [
    { l: 'Lectura inicial', i: 'log-in', r: 'lectura-inicial', c: '#16a34a' },
    { l: 'Lectura final', i: 'log-out', r: 'lectura-final', c: '#d97706' },
    { l: 'Reporte diario', i: 'file', r: 'reporte-diario', c: '#0f1f3d' },
    { l: 'Configurar precios', i: 'tag', r: 'precios', c: '#3b82f6', perm: 'canEditPrices' },
    { l: 'Configurar bombas', i: 'fuel', r: 'bombas', c: '#475569', perm: 'canManagePumps' },
    { l: 'Auditoría', i: 'shield', r: 'auditoria', c: '#475569', perm: 'canViewAudit' },
  ];

  const QUICK_ACTIONS = ALL_QUICK_ACTIONS.filter(it => {
    if (!it.perm) return true;
    return role?.permissions?.[it.perm as keyof typeof role.permissions] === true;
  });

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Greeting */}
      <div className="flex-responsive">
        <div>
          <div style={{ fontSize: 12, color: '#d97706', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>{todayLabel}</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: -0.4, marginTop: 4, marginBottom: 0 }}>
            Buenos días, {name}.
          </h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            {pendingFinals > 0 ? (
              <>Tienes <b style={{ color: '#d97706' }}>{pendingFinals} lecturas finales pendientes</b> antes de cerrar el día.</>
            ) : (
              <>Todas las lecturas finales han sido registradas.</>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignSelf: 'stretch', flexWrap: 'wrap' }}>
          <Button variant="secondary" icon="download" onClick={exportExcel}>Exportar Excel</Button>
          <Button variant="primary" icon="log-out" onClick={() => setRoute('lectura-final')}>Registrar lectura final</Button>
        </div>
      </div>

      {/* Stat row */}
      <div className="dashboard-stats grid-cols-4">
        <StatCard tone="primary" label="Vendido hoy" icon="fuel" value={fmtL(totals.lempiras)} sub="estimado"/>
        <StatCard tone="neutral" label="Litros vendidos" icon="droplet" value={fmtNum(totals.liters, 2)} sub="L · hoy"/>
        <StatCard tone="neutral" label="Galones vendidos" icon="droplet" value={fmtNum(totals.gallons, 2)} sub="gal · hoy"/>
        <StatCard tone="accent" label="Bombas activas" icon="gauge" value={`${activePumps.length} / ${pumps.length}`} sub={`${pumps.length - activePumps.length} inactiva${pumps.length - activePumps.length !== 1 ? 's' : ''}`}/>
      </div>

      {/* Trend + quick actions */}
      <div className="dashboard-grid-2 grid-cols-2-1">
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Ventas · últimos 14 días</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3, marginTop: 4 }}>
                {fmtL(totalTendencia)}
              </div>
              {errorTendencia && <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>No se pudieron cargar los días anteriores; solo se muestra hoy.</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge tone="success" dot>Lempiras por día</Badge>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, marginTop: 12 }}>
            {tendencia.map((d, i) => {
              const h = (d.total / maxV) * 100;
              const isToday = i === tendencia.length - 1;
              return (
                <div key={d.fecha} title={`${fechaCortaHN(d.fecha)} · ${fmtL(d.total)} · ${fmtNum(d.litros, 2)} L${d.pendientes ? ` · ${d.pendientes} pendiente(s)` : ''}`} style={{ flex: 1, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                  <div style={{
                    width: '100%', height: `${Math.max(1, h)}%`,
                    background: isToday ? '#d97706' : '#0f1f3d',
                    borderRadius: '4px 4px 0 0',
                    opacity: isToday ? 1 : 0.85,
                  }}/>
                  <span style={{ fontSize: 9.5, color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>
                    {d.fecha.slice(8, 10)}
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
          {role?.permissions?.canManagePumps && (
            <button onClick={() => setRoute('bombas')} style={{ background: 'transparent', border: 0, color: '#0f1f3d', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
              Ver todas <Icon name="chevron-right" size={12}/>
            </button>
          )}
        </div>
        <div className="grid-cols-3">
          {pumps.map((p) => {
            const allRows = p.faces.flatMap(f => f.dispensers);
            const pumpReadings = [...lecturasPorDispensador(readings).values()].filter(r => r.pumpId === p.id);
            // Mismo cálculo que el Cuadro (calcVenta, precio de la lectura): rollover y redondeo incluidos.
            let liters = 0, lemp = 0;
            pumpReadings.forEach(r => { const v = calcVenta(r, preciosLectura); if (v.estado === 'ok') { liters += v.litros; lemp += v.total; } });
            liters = round(liters, 3); lemp = round(lemp, 2);
            const completed = pumpReadings.filter(r => r.finalReading !== undefined).length;
            
            return (
              <Card key={p.id} hoverable>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: '#fbbf2422', color: '#d97706', display: 'grid', placeItems: 'center' }}>
                      <Icon name="fuel" size={18}/>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{productosDeBomba(p).map(f => f.name).join(' / ')}</div>
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
          {role?.permissions?.canViewAudit && (
            <button onClick={() => setRoute('auditoria')} style={{ background: 'transparent', border: 0, color: '#0f1f3d', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Ver auditoría →
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {auditLog.length > 0 ? auditLog.slice(0, 5).map((a, i) => (
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
          )) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No hay actividad reciente
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
