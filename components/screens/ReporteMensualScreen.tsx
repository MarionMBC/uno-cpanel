'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { fmtL, fmtNum } from '@/lib/utils';
import { LITERS_PER_GALLON } from '@/lib/constants';
import { round } from '@/lib/totalizadores';
import { fechaCortaHN, horaHN } from '@/lib/fecha';
import { mesesHasta, nombreMes, rangoMes, totalesPorGrupo, ventasPorDia, type TotalGrupo } from '@/lib/reportes';
import { DailyReading, DayStatus } from '@/types';
import * as XLSX from 'xlsx';

type EstadoDia = 'cerrado' | 'abierto' | 'sin_lecturas' | 'futuro';
const ESTADO_TXT: Record<EstadoDia, string> = { cerrado: 'Cerrado', abierto: 'Abierto', sin_lecturas: 'Sin lecturas', futuro: '—' };

function TablaGrupos({ titulo, filas }: { titulo: string; filas: TotalGrupo[] }) {
  return (
    <Card padding={0}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{titulo}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Nombre', 'Litros', 'Galones', 'Total L.'].map((h, i) => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: i >= 1 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={4} style={{ padding: 18, textAlign: 'center', color: '#94a3b8' }}>Sin ventas confirmadas</td></tr>}
            {filas.map(b => (
              <tr key={b.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>{b.nombre}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{fmtNum(b.litros, 2)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(b.litros / LITERS_PER_GALLON, 2)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: '#0f172a' }}>{fmtL(b.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function ReporteMensualScreen() {
  const { preciosLectura, today } = useApp();
  const { appUser } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const mesActual = today.slice(0, 7);
  const meses = useMemo(() => mesesHasta(mesActual, 12), [mesActual]);
  const [mes, setMes] = useState(mesActual);
  const { desde, hasta, dias } = useMemo(() => rangoMes(mes), [mes]);

  // Datos del mes, etiquetados con el mes que cargaron.
  const [datos, setDatos] = useState<{ mes: string; lecturas: DailyReading[]; dias: Record<string, DayStatus> } | null>(null);
  useEffect(() => {
    let vivo = true;
    Promise.all([
      // Rango sobre un solo campo: lo cubre el índice simple de `date` (no requiere índice compuesto).
      getDocs(query(collection(db, 'readings'), where('date', '>=', desde), where('date', '<=', hasta))),
      // El id del día es la fecha: rango por id del documento.
      getDocs(query(collection(db, 'dayStatus'), where(documentId(), '>=', desde), where(documentId(), '<=', hasta))),
    ]).then(([lect, dsnap]) => {
      if (!vivo) return;
      setDatos({
        mes,
        lecturas: lect.docs.map(d => ({ id: d.id, ...d.data() } as DailyReading)),
        dias: Object.fromEntries(dsnap.docs.map(d => [d.id, d.data() as DayStatus])),
      });
    }).catch(() => {
      if (!vivo) return;
      setDatos({ mes, lecturas: [], dias: {} });
      toastRef.current.error('No se pudo cargar', `No fue posible leer las lecturas de ${nombreMes(mes)}.`);
    });
    return () => { vivo = false; };
  }, [mes, desde, hasta]);

  const listo = datos?.mes === mes ? datos : null;
  const lecturas = useMemo(() => listo?.lecturas ?? [], [listo]);

  const porDia = useMemo(() => ventasPorDia(lecturas, dias, preciosLectura).map(d => {
    let estado: EstadoDia;
    if (d.fecha > today) estado = 'futuro';
    else if (listo?.dias[d.fecha]?.status === 'cerrado') estado = 'cerrado';
    else if (d.lecturas === 0) estado = 'sin_lecturas';
    else estado = 'abierto';
    return { ...d, estado };
  }), [lecturas, dias, preciosLectura, today, listo]);
  const grupos = useMemo(() => totalesPorGrupo(lecturas, preciosLectura), [lecturas, preciosLectura]);

  const transcurridos = porDia.filter(d => d.estado !== 'futuro').length;
  const conPendientes = porDia.filter(d => d.pendientes > 0 && d.estado !== 'futuro').length;
  const abiertos = porDia.filter(d => d.estado === 'abierto').length;
  const max = Math.max(...porDia.map(d => d.litros), 1);
  const maxL = Math.max(...porDia.map(d => d.litros), 0);
  const generadoPor = appUser?.name || appUser?.email || '—';
  const nombreArchivo = `Reporte_mensual_${mes}.xlsx`;

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(porDia.filter(d => d.estado !== 'futuro').map(d => ({
      'Fecha': fechaCortaHN(d.fecha),
      'Litros': d.litros,
      'Galones': round(d.litros / LITERS_PER_GALLON, 2),
      'Total L.': d.total,
      'Pendientes': d.pendientes,
      'Estado': ESTADO_TXT[d.estado],
    }))), 'Por día');
    const hoja = (g: TotalGrupo[]) => XLSX.utils.json_to_sheet(g.map(b => ({ 'Nombre': b.nombre, 'Litros': b.litros, 'Galones': round(b.litros / LITERS_PER_GALLON, 2), 'Total L.': b.total })));
    XLSX.utils.book_append_sheet(wb, hoja(grupos.bombas), 'Por bomba');
    XLSX.utils.book_append_sheet(wb, hoja(grupos.productos), 'Por producto');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Período', nombreMes(mes)],
      ['Total litros', grupos.litros],
      ['Total L.', grupos.total],
      ['Generado por', generadoPor],
      ['Generado', `${fechaCortaHN(today)} ${horaHN(new Date())}`],
    ]), 'Resumen');
    XLSX.writeFile(wb, nombreArchivo);
    toast.success('Excel generado', `${nombreArchivo} descargado.`);
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Período</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3, marginTop: 2 }}>{nombreMes(mes)}</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Generado por {generadoPor}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              aria-label="Mes del reporte"
              value={mes}
              onChange={e => setMes(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: 'white' }}
            >
              {meses.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
            </select>
            <Button variant="secondary" icon="download" size="sm" onClick={exportExcel} disabled={!listo}>Excel</Button>
            <Button variant="primary" icon="file" size="sm" onClick={() => window.print()} disabled={!listo}>Imprimir</Button>
          </div>
        </div>
      </Card>

      {listo && (conPendientes > 0 || abiertos > 0) && (
        <Card style={{ background: '#fef3c7', borderLeft: '3px solid #f59e0b', boxShadow: '0 0 0 1px #fde68a' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <Icon name="alert" size={18} style={{ color: '#92400e', marginTop: 1 }}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>
                {conPendientes > 0 && <>{conPendientes} día{conPendientes !== 1 && 's'} con lecturas finales faltantes. </>}
                {abiertos > 0 && <>{abiertos} día{abiertos !== 1 && 's'} sin cerrar.</>}
              </div>
              <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>El reporte mensual es preliminar hasta completar y cerrar esos días.</div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid-cols-4">
        <StatCard tone="primary" label="Total mes" icon="fuel" value={fmtL(grupos.total)} sub="lempiras"/>
        <StatCard tone="neutral" label="Total litros" icon="droplet" value={fmtNum(grupos.litros, 0)} sub="L mes a la fecha"/>
        <StatCard tone="neutral" label="Total galones" icon="droplet" value={fmtNum(grupos.litros / LITERS_PER_GALLON, 0)} sub="galones"/>
        <StatCard tone="accent" label="Promedio diario" icon="trend-up" value={fmtL(transcurridos > 0 ? grupos.total / transcurridos : 0)} sub={`L. / día · ${transcurridos} día${transcurridos !== 1 ? 's' : ''}`}/>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Ventas por día (litros)</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{listo ? `Máximo mensual · ${fmtNum(maxL, 0)} L` : 'Cargando…'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: 160, gap: 4 }}>
          {porDia.map((d) => {
            const incompleto = d.estado === 'abierto' || d.pendientes > 0;
            return (
              <div key={d.fecha} title={`${fechaCortaHN(d.fecha)} · ${fmtNum(d.litros, 2)} L · ${fmtL(d.total)} · ${ESTADO_TXT[d.estado]}`}
                style={{ flex: 1, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', justifyContent: 'flex-end' }}>
                <div style={{
                  width: '100%',
                  height: `${(d.litros / max) * 100}%`,
                  background: incompleto
                    ? 'repeating-linear-gradient(45deg,#fef3c7 0 4px,#fde68a 4px 8px)'
                    : (d.litros === max && max > 0 ? '#d97706' : '#0f1f3d'),
                  borderRadius: '3px 3px 0 0',
                }}/>
                <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>{Number(d.fecha.slice(8, 10))}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid-cols-2">
        <TablaGrupos titulo={`Resumen por bomba · ${nombreMes(mes)}`} filas={grupos.bombas}/>
        <TablaGrupos titulo={`Resumen por producto · ${nombreMes(mes)}`} filas={grupos.productos}/>
      </div>

      <Card padding={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Detalle por día</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Fecha', 'Litros', 'Total L.', 'Pendientes', 'Estado'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: i >= 1 && i <= 3 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {porDia.filter(d => d.estado !== 'futuro').map(d => (
                <tr key={d.fecha} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{fechaCortaHN(d.fecha)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{fmtNum(d.litros, 2)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{fmtL(d.total)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: d.pendientes ? '#b45309' : '#94a3b8' }}>{d.pendientes}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <Badge tone={d.estado === 'cerrado' ? 'success' : d.estado === 'abierto' ? 'warning' : 'neutral'} size="sm">{ESTADO_TXT[d.estado]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
