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

export default function ReporteDiarioScreen() {
  const { pumps, readings, dayStatus, currentPrices } = useApp();
  const toast = useToast();
  
  const today = new Date();
  const todayStr = today.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit' });
  const fullYear = today.getFullYear();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const activePumps = pumps.filter(p => p.isActive);

  const byPump = activePumps.map(p => {
    const disps = p.faces.flatMap(f => f.dispensers.filter(d => d.status === 'activo').map(d => {
      const r = readings.find(read => read.dispenserId === d.id);
      const initial = r?.initialReading || 0;
      const final = r?.finalReading || 0;
      const liters = Math.max(0, final > 0 ? final - initial : 0);
      const price = currentPrices[d.fuel as 'super' | 'regular' | 'diesel'] || 0;
      return {
        ...d,
        initial,
        final,
        liters,
        price,
      };
    }));
    const sumL = disps.reduce((s, d) => s + d.liters, 0);
    const sumM = disps.reduce((s, d) => s + (d.liters * d.price), 0);
    return { pump: p, dispensers: disps, liters: sumL, lemp: sumM };
  });

  const totals = byPump.reduce((s, b) => ({
    l: s.l + b.liters,
    g: s.g + b.liters / LITERS_PER_GALLON,
    m: s.m + b.lemp,
  }), { l: 0, g: 0, m: 0 });

  const isClosed = dayStatus === 'cerrado';

  const exportExcel = () => {
    const rows: Record<string, any>[] = [];
    byPump.forEach(b => {
      b.dispensers.forEach(d => {
        rows.push({
          'Bomba': b.pump.name,
          'Combustible': d.fuelName,
          'Cara': d.face,
          'Dispensador': `D${d.name.slice(-1)}`,
          'L. Inicial': d.initial.toFixed(2),
          'L. Final': d.final.toFixed(2),
          'Litros': d.liters.toFixed(2),
          'Galones': (d.liters / LITERS_PER_GALLON).toFixed(2),
          'Precio/L': d.price.toFixed(2),
          'Total L.': (d.liters * d.price).toFixed(2),
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Diario');
    XLSX.writeFile(wb, `Reporte_${selectedDate.replace('/', '-')}-${fullYear}.xlsx`);
    toast.success('Excel generado', `Reporte_${selectedDate.replace('/', '-')}-${fullYear}.xlsx descargado.`);
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="calendar" size={18} style={{ color: '#0f1f3d' }}/>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Reporte del</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: -0.2 }}>{selectedDate}/{fullYear}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button style={{
              padding: '8px 14px', borderRadius: 9,
              background: '#0f1f3d', color: 'white',
              border: '1px solid #0f1f3d',
              fontSize: 12, fontWeight: 700, cursor: 'default', fontFamily: 'inherit',
            }}>{todayStr}</button>
            <div style={{ width: 1, height: 24, background: '#e2e8f0' }}/>
            <Button variant="secondary" icon="download" size="sm" onClick={exportExcel}>Excel</Button>
            <Button variant="primary" icon="file" size="sm" onClick={() => toast.info('PDF generado', 'Función de PDF próximamente.')}>PDF</Button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          {[
            { l: 'Estación', v: 'UNO Guaimaca Centro' },
            { l: 'Generado por', v: 'Operador' },
            { l: 'Cierre', v: isClosed ? 'Completado' : 'Pendiente' },
            { l: 'Estado', v: isClosed ? <Badge tone="success" icon="lock">Cerrado</Badge> : <Badge tone="warning" icon="clock">En proceso</Badge> },
            { l: 'Generado', v: `${selectedDate} · ${today.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}` },
          ].map((m) => (
            <div key={m.l}>
              <div style={{ fontSize: 10.5, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>{m.l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{m.v}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid-cols-3">
        <StatCard tone="primary" label="Total general" icon="fuel" value={fmtL(totals.m)} sub="lempiras del día"/>
        <StatCard tone="neutral" label="Total litros" icon="droplet" value={fmtNum(totals.l, 2)} sub="L · ventas confirmadas"/>
        <StatCard tone="neutral" label="Total galones" icon="droplet" value={fmtNum(totals.g, 2)} sub="gal · ventas confirmadas"/>
      </div>

      {byPump.map(({ pump, dispensers, liters, lemp }) => (
        <Card key={pump.id} padding={0}>
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f8fafc', color: '#64748b', display: 'grid', placeItems: 'center' }}>
                <Icon name="fuel" size={16}/>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{pump.name}</div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>{Array.from(new Set(dispensers.map(d => d.fuelName))).join(' / ')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>Litros</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', fontFamily: 'ui-monospace, monospace' }}>{fmtNum(liters, 2)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>Lempiras</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', fontFamily: 'ui-monospace, monospace' }}>{fmtL(lemp)}</div>
              </div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Cara', 'Disp.', 'Inicial', 'Final', 'Litros', 'Galones', 'Precio', 'Total L.'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dispensers.map((d) => (
                <tr key={d.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ width: 22, height: 22, borderRadius: 5, background: '#0f1f3d', color: '#fbbf24', fontSize: 10, fontWeight: 800, display: 'inline-grid', placeItems: 'center' }}>{d.face}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>
                    D{d.name.slice(-1)} <span style={{ marginLeft: 6, fontSize: 10, background: d.fuelColor + '22', color: d.fuelColor, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>{d.fuelName}</span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(d.initial, 2)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(d.final, 2)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#0f172a' }}>{fmtNum(d.liters, 2)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(d.liters / LITERS_PER_GALLON, 2)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>L. {d.price.toFixed(2)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#0f172a' }}>{fmtL(d.liters * d.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
