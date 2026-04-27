'use client';

import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { fmtL, fmtNum } from '@/lib/utils';
import { LITERS_PER_GALLON } from '@/lib/constants';
import * as XLSX from 'xlsx';

const DAYS = Array.from({ length: 26 }, (_, i) => {
  const r = ((i * 13) % 9 + 5) / 10;
  return {
    day: i + 1,
    liters: 2200 + r * 1400 + (i % 6 === 0 ? 800 : 0),
    lemp: (2200 + r * 1400 + (i % 6 === 0 ? 800 : 0)) * 105,
    complete: i < 25,
  };
});

export default function ReporteMensualScreen() {
  const { pumps } = useApp();
  const toast = useToast();
  const [month, setMonth] = useState('Abril 2026');

  const total = DAYS.reduce((s, d) => ({ l: s.l + d.liters, m: s.m + d.lemp }), { l: 0, m: 0 });
  const max = Math.max(...DAYS.map(d => d.liters));

  const activePumps = pumps.filter(p => p.isActive);

  const exportExcel = () => {
    const rows = DAYS.map(d => ({
      'Día': d.day,
      'Litros': d.liters.toFixed(2),
      'Galones': (d.liters / LITERS_PER_GALLON).toFixed(2),
      'Total L.': d.lemp.toFixed(2),
      'Estado': d.complete ? 'Cerrado' : 'Pendiente',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Mensual');
    XLSX.writeFile(wb, `Reporte_Mensual_Abril-2026.xlsx`);
    toast.success('Excel generado', 'Reporte_Mensual_Abril-2026.xlsx descargado.');
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Período</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3, marginTop: 2 }}>{month}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: 'white' }}
            >
              <option>Abril 2026</option>
              <option>Marzo 2026</option>
              <option>Febrero 2026</option>
            </select>
            <Button variant="secondary" icon="download" size="sm" onClick={exportExcel}>Excel</Button>
            <Button variant="primary" icon="file" size="sm" onClick={() => toast.info('PDF generado', 'Función de PDF próximamente.')}>PDF</Button>
          </div>
        </div>
      </Card>

      <Card style={{ background: '#fef3c7', borderLeft: '3px solid #f59e0b', boxShadow: '0 0 0 1px #fde68a' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Icon name="alert" size={18} style={{ color: '#92400e', marginTop: 1 }}/>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>1 día con lectura final faltante</div>
            <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>El día 26/04/2026 todavía no se ha cerrado. El reporte mensual es preliminar hasta completar todas las lecturas.</div>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard tone="primary" label="Total mes" icon="fuel" value={fmtL(total.m)} sub="lempiras"/>
        <StatCard tone="neutral" label="Total litros" icon="droplet" value={fmtNum(total.l, 0)} sub="L mes a la fecha"/>
        <StatCard tone="neutral" label="Total galones" icon="droplet" value={fmtNum(total.l / LITERS_PER_GALLON, 0)} sub="galones"/>
        <StatCard tone="accent" label="Promedio diario" icon="trend-up" value={fmtL(total.m / DAYS.length)} sub="L. / día"/>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Ventas por día (litros)</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Pico el día 23 · {fmtNum(Math.max(...DAYS.map(d => d.liters)), 0)} L</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: 160, gap: 4 }}>
          {DAYS.map((d) => (
            <div key={d.day} style={{ flex: 1, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', justifyContent: 'flex-end' }}>
              <div style={{
                width: '100%',
                height: `${(d.liters / max) * 100}%`,
                background: !d.complete
                  ? 'repeating-linear-gradient(45deg,#fef3c7 0 4px,#fde68a 4px 8px)'
                  : (d.day === 23 ? '#d97706' : '#0f1f3d'),
                borderRadius: '3px 3px 0 0',
                opacity: d.complete ? 1 : 0.9,
              }}/>
              <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>{d.day}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Resumen por bomba · {month}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Bomba', 'Combustible', 'L. inicial mes', 'L. final mes', 'Litros', 'Galones', 'Total L.'].map((h, i) => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activePumps.map((p, idx) => {
              const liters = 18450 + idx * 4200;
              return (
                <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>{p.name}</td>
                  <td style={{ padding: '12px 14px' }}><Badge tone="neutral" dot>{p.fuel.name}</Badge></td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(120000 + idx * 5000, 2)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(120000 + idx * 5000 + liters, 2)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{fmtNum(liters, 2)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(liters / LITERS_PER_GALLON, 2)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: '#0f172a' }}>{fmtL(liters * p.fuel.price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
