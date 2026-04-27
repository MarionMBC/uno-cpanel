'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { fmtL, fmtNum, getMonthEs } from '@/lib/utils';
import { LITERS_PER_GALLON } from '@/lib/constants';
import { DailyReading } from '@/types';
import * as XLSX from 'xlsx';

export default function ReporteMensualScreen() {
  const { pumps } = useApp();
  const toast = useToast();
  
  const today = new Date();
  const currentMonthName = getMonthEs(today);
  const currentMonthValue = `${currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1)} ${today.getFullYear()}`;
  const [month, setMonth] = useState(currentMonthValue);
  const [monthlyReadings, setMonthlyReadings] = useState<DailyReading[]>([]);

  useEffect(() => {
    const fetchReadings = async () => {
      const year = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      
      const q = query(
        collection(db, 'readings'), 
        where('date', '>=', `${year}-${m}-01`),
        where('date', '<=', `${year}-${m}-31`)
      );
      const snap = await getDocs(q);
      setMonthlyReadings(snap.docs.map(d => d.data() as DailyReading));
    };
    fetchReadings();
  }, [month]);

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentDay = today.getDate();

  const DAYS = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayReadings = monthlyReadings.filter(r => r.date === dayStr);
      let liters = 0;
      let lemp = 0;
      let complete = true;

      if (i <= currentDay) {
        if (dayReadings.length === 0) complete = false;
        dayReadings.forEach(r => {
          if (r.finalReading === undefined) complete = false;
          else {
            const lts = Math.max(0, r.finalReading - r.initialReading);
            liters += lts;
            lemp += lts * r.fuelPrice;
          }
        });
      }

      arr.push({
        day: i,
        liters,
        lemp,
        complete: i > currentDay ? true : complete,
      });
    }
    return arr;
  }, [monthlyReadings, daysInMonth, currentDay]);

  const total = DAYS.reduce((s, d) => ({ l: s.l + d.liters, m: s.m + d.lemp }), { l: 0, m: 0 });
  const max = Math.max(...DAYS.map(d => d.liters), 1);
  const incompleteDays = DAYS.filter(d => d.day <= currentDay && !d.complete).length;

  const activePumps = pumps.filter(p => p.isActive);

  const byPump = useMemo(() => activePumps.map(p => {
    const pumpReads = monthlyReadings.filter(r => r.pumpId === p.id);
    let lts = 0;
    pumpReads.forEach(r => {
      if (r.finalReading !== undefined) {
        lts += Math.max(0, r.finalReading - r.initialReading);
      }
    });
    return {
      pump: p,
      liters: lts,
      lemp: lts * p.fuel.price,
    };
  }), [activePumps, monthlyReadings]);

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
    XLSX.writeFile(wb, `Reporte_Mensual_${month.replace(' ', '-')}.xlsx`);
    toast.success('Excel generado', `Reporte_Mensual_${month.replace(' ', '-')}.xlsx descargado.`);
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
              <option>{currentMonthValue}</option>
            </select>
            <Button variant="secondary" icon="download" size="sm" onClick={exportExcel}>Excel</Button>
            <Button variant="primary" icon="file" size="sm" onClick={() => toast.info('PDF generado', 'Función de PDF próximamente.')}>PDF</Button>
          </div>
        </div>
      </Card>

      {incompleteDays > 0 && (
        <Card style={{ background: '#fef3c7', borderLeft: '3px solid #f59e0b', boxShadow: '0 0 0 1px #fde68a' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <Icon name="alert" size={18} style={{ color: '#92400e', marginTop: 1 }}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>{incompleteDays} día{incompleteDays !== 1 && 's'} con lectura final faltante</div>
              <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>El reporte mensual es preliminar hasta completar todas las lecturas pendientes.</div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid-cols-4">
        <StatCard tone="primary" label="Total mes" icon="fuel" value={fmtL(total.m)} sub="lempiras"/>
        <StatCard tone="neutral" label="Total litros" icon="droplet" value={fmtNum(total.l, 0)} sub="L mes a la fecha"/>
        <StatCard tone="neutral" label="Total galones" icon="droplet" value={fmtNum(total.l / LITERS_PER_GALLON, 0)} sub="galones"/>
        <StatCard tone="accent" label="Promedio diario" icon="trend-up" value={fmtL(currentDay > 0 ? total.m / currentDay : 0)} sub="L. / día"/>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Ventas por día (litros)</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Máximo mensual · {fmtNum(Math.max(...DAYS.map(d => d.liters)), 0)} L</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: 160, gap: 4 }}>
          {DAYS.map((d) => (
            <div key={d.day} style={{ flex: 1, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', justifyContent: 'flex-end' }}>
              <div style={{
                width: '100%',
                height: `${(d.liters / max) * 100}%`,
                background: !d.complete
                  ? 'repeating-linear-gradient(45deg,#fef3c7 0 4px,#fde68a 4px 8px)'
                  : (d.liters === max && max > 0 ? '#d97706' : '#0f1f3d'),
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
              {['Bomba', 'Combustible', 'Litros', 'Galones', 'Total L.'].map((h, i) => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {byPump.map((b) => (
              <tr key={b.pump.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>{b.pump.name}</td>
                <td style={{ padding: '12px 14px' }}><Badge tone="neutral" dot>{b.pump.fuel.name}</Badge></td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{fmtNum(b.liters, 2)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(b.liters / LITERS_PER_GALLON, 2)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: '#0f172a' }}>{fmtL(b.lemp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
