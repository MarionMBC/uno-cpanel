'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
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
import { buildCuadro, round, type FilaCuadro } from '@/lib/totalizadores';
import { fechaCortaHN, horaHN } from '@/lib/fecha';
import { DailyReading, DayStatus } from '@/types';
import * as XLSX from 'xlsx';

const SIN_LECTURAS: DailyReading[] = [];

const ESTADO_TXT: Record<FilaCuadro['estado'], string> = {
  ok: 'OK', pendiente: 'Pendiente', invalida: 'Final < inicial', mantenimiento: 'Mantenimiento', sin_inicial: 'Sin lectura',
};

function EstadoBadge({ f }: { f: FilaCuadro }) {
  if (f.estado === 'ok') return null;
  const tone = f.estado === 'pendiente' ? 'warning' : f.estado === 'invalida' ? 'danger' : 'neutral';
  return <Badge tone={tone} size="sm">{ESTADO_TXT[f.estado]}</Badge>;
}

export default function ReporteDiarioScreen() {
  const { pumps, readings, dayData, preciosLectura, today } = useApp();
  const { appUser } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const [fecha, setFecha] = useState(today);
  const esHoy = fecha === today;
  // Datos de otra fecha, etiquetados con la fecha que cargaron (nunca se muestran bajo otra fecha).
  const [otro, setOtro] = useState<{ fecha: string; lecturas: DailyReading[]; dia: DayStatus | null; error: boolean } | null>(null);

  useEffect(() => {
    if (esHoy) return;
    let vivo = true;
    Promise.all([
      getDocs(query(collection(db, 'readings'), where('date', '==', fecha))),
      getDoc(doc(db, 'dayStatus', fecha)),
    ]).then(([snap, day]) => {
      if (!vivo) return;
      setOtro({ fecha, lecturas: snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyReading)), dia: day.exists() ? (day.data() as DayStatus) : null, error: false });
    }).catch(() => {
      if (!vivo) return;
      setOtro({ fecha, lecturas: [], dia: null, error: true });
      toastRef.current.error('No se pudo cargar', `No fue posible leer las lecturas del ${fechaCortaHN(fecha)}.`);
    });
    return () => { vivo = false; };
  }, [fecha, esHoy]);

  const otroListo = otro?.fecha === fecha ? otro : null;
  const cargando = !esHoy && !otroListo;
  const lecturas = esHoy ? readings : otroListo?.lecturas ?? SIN_LECTURAS;
  const dia = esHoy ? dayData : otroListo?.dia ?? null;

  // Mismo cálculo que el Cuadro de totalizadores (calcVenta, precio de cada lectura); fechas pasadas desde las lecturas.
  const cuadro = useMemo(() => buildCuadro(pumps, lecturas, preciosLectura, { historico: !esHoy }), [pumps, lecturas, preciosLectura, esHoy]);
  const grupos = cuadro.grupos.filter(g => g.filas.length > 0);

  const isClosed = dia?.status === 'cerrado';
  const generadoPor = appUser?.name || appUser?.email || '—';
  const ahora = new Date();
  const nombreArchivo = `Reporte_diario_${fecha}.xlsx`;

  const exportExcel = () => {
    const rows: Record<string, string | number>[] = [];
    grupos.forEach(g => g.filas.forEach(f => {
      rows.push({
        'Fecha': fechaCortaHN(fecha),
        'Bomba': g.pumpName,
        'Manguera': f.label,
        'Combustible': f.fuelName,
        'Inicial': f.inicial ?? '',
        'Final': f.final ?? '',
        'Litros': f.estado === 'ok' ? f.litros : '',
        'Galones': f.estado === 'ok' ? round(f.litros / LITERS_PER_GALLON, 2) : '',
        'Precio/L': f.precio,
        'Total L.': f.estado === 'ok' ? f.total : '',
        'Estado': ESTADO_TXT[f.estado],
      });
    }));
    rows.push({ 'Fecha': '', 'Bomba': 'TOTAL', 'Litros': cuadro.litros, 'Galones': round(cuadro.litros / LITERS_PER_GALLON, 2), 'Total L.': cuadro.total });
    rows.push({ 'Fecha': '', 'Bomba': `Generado por ${generadoPor} · ${fechaCortaHN(today)} ${horaHN(ahora)}` });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Diario');
    XLSX.writeFile(wb, nombreArchivo);
    toast.success('Excel generado', `${nombreArchivo} descargado.`);
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="calendar" size={18} style={{ color: '#0f1f3d' }}/>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Reporte del</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: -0.2 }}>{fechaCortaHN(fecha)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" aria-label="Fecha del reporte" value={fecha} max={today} onChange={e => e.target.value && setFecha(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: 'white' }}/>
            {!esHoy && <Button variant="ghost" size="sm" onClick={() => setFecha(today)}>Hoy</Button>}
            <div style={{ width: 1, height: 24, background: '#e2e8f0' }}/>
            <Button variant="secondary" icon="download" size="sm" onClick={exportExcel} disabled={cargando || grupos.length === 0}>Excel</Button>
            <Button variant="primary" icon="file" size="sm" onClick={() => window.print()} disabled={cargando}>Imprimir</Button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          {[
            { l: 'Estación', v: 'UNO Guaimaca Centro' },
            { l: 'Generado por', v: generadoPor },
            { l: 'Cerrado por', v: isClosed ? dia?.closedBy || '—' : 'Pendiente' },
            { l: 'Estado', v: cargando ? 'Cargando…' : isClosed ? <Badge tone="success" icon="lock">Cerrado</Badge> : <Badge tone="warning" icon="clock">{lecturas.length ? 'En proceso' : 'Sin lecturas'}</Badge> },
            { l: 'Generado', v: `${fechaCortaHN(today)} · ${horaHN(ahora)}` },
          ].map((m) => (
            <div key={m.l}>
              <div style={{ fontSize: 10.5, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>{m.l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 4, overflowWrap: 'anywhere' }}>{m.v}</div>
            </div>
          ))}
        </div>
      </Card>

      {(cuadro.pendientes > 0 || cuadro.invalidas > 0) && !cargando && (
        <Card style={{ background: '#fef3c7', borderLeft: '3px solid #f59e0b', boxShadow: '0 0 0 1px #fde68a' }}>
          <div style={{ fontSize: 12.5, color: '#78350f' }}>
            <b>Reporte preliminar:</b> {cuadro.pendientes} manguera{cuadro.pendientes !== 1 && 's'} sin lectura final{cuadro.invalidas ? ` y ${cuadro.invalidas} con final menor que la inicial` : ''}. No suman al total.
          </div>
        </Card>
      )}

      <div className="grid-cols-3">
        <StatCard tone="primary" label="Total general" icon="fuel" value={fmtL(cuadro.total)} sub="lempiras del día"/>
        <StatCard tone="neutral" label="Total litros" icon="droplet" value={fmtNum(cuadro.litros, 2)} sub="L · ventas confirmadas"/>
        <StatCard tone="neutral" label="Total galones" icon="droplet" value={fmtNum(cuadro.litros / LITERS_PER_GALLON, 2)} sub="gal · ventas confirmadas"/>
      </div>

      {cuadro.productos.length > 0 && (
        <Card padding={0}>
          <div style={{ padding: '12px 18px', fontSize: 13, fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>Por producto</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {cuadro.productos.map(p => (
              <div key={p.fuelId} style={{ padding: '12px 18px', borderRight: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: p.fuelColor }}>{p.fuelName}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', fontFamily: 'ui-monospace, monospace' }}>{fmtL(p.total)}</div>
                <div style={{ fontSize: 11.5, color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>{fmtNum(p.litros, 3)} L</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {cargando && <Card><div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Cargando lecturas del {fechaCortaHN(fecha)}…</div></Card>}
      {!cargando && grupos.length === 0 && <Card><div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No hay lecturas registradas el {fechaCortaHN(fecha)}.</div></Card>}

      {!cargando && grupos.map(g => (
        <Card key={g.pumpId} padding={0}>
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f8fafc', color: '#64748b', display: 'grid', placeItems: 'center' }}>
                <Icon name="fuel" size={16}/>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{g.pumpName}</div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>{Array.from(new Set(g.filas.map(f => f.fuelName))).join(' / ')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>Litros</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', fontFamily: 'ui-monospace, monospace' }}>{fmtNum(g.litros, 2)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>Lempiras</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', fontFamily: 'ui-monospace, monospace' }}>{fmtL(g.total)}</div>
              </div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Manguera', 'Combustible', 'Inicial', 'Final', 'Litros', 'Galones', 'Precio', 'Total L.'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.filas.map(f => (
                  <tr key={f.key} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{f.label} <EstadoBadge f={f}/></td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, background: f.fuelColor + '22', color: f.fuelColor, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{f.fuelName}</span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{f.inicial === null ? '—' : fmtNum(f.inicial, 3)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{f.final === null ? '—' : fmtNum(f.final, 3)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#0f172a' }}>{f.estado === 'ok' ? fmtNum(f.litros, 3) : '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{f.estado === 'ok' ? fmtNum(f.litros / LITERS_PER_GALLON, 2) : '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>L. {f.precio.toFixed(2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#0f172a' }}>{f.estado === 'ok' ? fmtL(f.total) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
