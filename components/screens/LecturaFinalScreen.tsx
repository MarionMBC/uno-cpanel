'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import ConfirmDialog from '@/components/overlays/ConfirmDialog';
import { fmtL, fmtNum, litersToGallons } from '@/lib/utils';
import { LITERS_PER_GALLON } from '@/lib/constants';
import * as XLSX from 'xlsx';

const INITIAL_READINGS: Record<string, number> = {
  'p1-A-1': 142318.42, 'p1-A-2': 138902.10, 'p1-A-3': 135441.88,
  'p1-B-1': 129044.15, 'p1-B-2': 133201.40, 'p1-B-3': 140882.23,
  'p2-A-1': 118822.75, 'p2-A-2': 122334.50,
  'p2-B-1': 115900.22, 'p2-B-2': 119412.88, 'p2-B-3': 124103.44,
};

export default function LecturaFinalScreen() {
  const { pumps, dayStatus, setDayStatus, addAuditEntry } = useApp();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const rows = useMemo(() => {
    return pumps
      .filter(p => p.isActive)
      .flatMap(p => p.faces.flatMap(f => f.dispensers.filter(d => d.status === 'activo').map(d => ({ ...d, pumpFuel: p.fuel }))));
  }, [pumps]);

  const [finals, setFinals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    rows.forEach(r => {
      const init = INITIAL_READINGS[r.id] || 120000;
      o[r.id] = (init + 200 + Math.floor(Math.random() * 300)).toFixed(2);
    });
    return o;
  });

  const calc = (id: string, pumpFuel: { price: number }) => {
    const finalVal = parseFloat(finals[id]) || 0;
    const initVal = INITIAL_READINGS[id] || 120000;
    const liters = Math.max(0, finalVal - initVal);
    const gallons = liters / LITERS_PER_GALLON;
    const lemp = liters * pumpFuel.price;
    return { liters, gallons, lemp, initVal };
  };

  const totals = rows.reduce((s, r) => {
    const c = calc(r.id, r.pumpFuel);
    s.l += c.liters; s.g += c.gallons; s.m += c.lemp;
    return s;
  }, { l: 0, g: 0, m: 0 });

  const isClosed = dayStatus === 'cerrado';

  const handleClose = () => {
    setDayStatus('cerrado');
    addAuditEntry({
      timestamp: new Date().toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }),
      date: '26/04/2026',
      userId: 'current',
      userName: 'Operador',
      userRole: 'Operador',
      action: 'Cierre del día',
      target: '26/04/2026',
      detail: `Total ${fmtL(totals.m)}`,
      icon: 'lock',
    });
    toast.success('Día cerrado', `Resumen final guardado · ${fmtL(totals.m)}`);
  };

  const exportExcel = () => {
    const data = rows.map(r => {
      const c = calc(r.id, r.pumpFuel);
      return {
        'Bomba': r.pumpName,
        'Cara': r.face,
        'Dispensador': `D${r.name.slice(-1)}`,
        'Combustible': r.fuelName,
        'L. Inicial': c.initVal.toFixed(2),
        'L. Final': parseFloat(finals[r.id]).toFixed(2),
        'Litros': c.liters.toFixed(2),
        'Galones': c.gallons.toFixed(2),
        'Precio/L': r.pumpFuel.price.toFixed(2),
        'Total L.': c.lemp.toFixed(2),
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lectura Final');
    XLSX.writeFile(wb, `Reporte_Diario_26-04-2026.xlsx`);
    toast.success('Excel generado', 'Reporte_Diario_26-04-2026.xlsx descargado.');
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <StatCard tone="primary" label="Total lempiras" icon="fuel" value={fmtL(totals.m)} sub="estimado del día"/>
        <StatCard tone="neutral" label="Litros" icon="droplet" value={fmtNum(totals.l, 2)} sub="L vendidos"/>
        <StatCard tone="neutral" label="Galones" icon="droplet" value={fmtNum(totals.g, 2)} sub="gal vendidos"/>
        <StatCard tone="accent" label="Dispensadores" icon="gauge" value={`${rows.length}`} sub="con lectura final"/>
      </div>

      <Card padding={0}>
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Lecturas finales por dispensador</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>La lectura final debe ser ≥ a la inicial. Los totales se calculan en vivo.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" icon="download" size="sm" onClick={exportExcel}>Excel</Button>
            <Button variant="primary" size="sm" icon="lock" onClick={() => setConfirmOpen(true)} disabled={isClosed}>
              {isClosed ? 'Día cerrado' : 'Cerrar día'}
            </Button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                {['Bomba', 'Cara', 'Disp.', 'Combust.', 'L. inicial', 'L. final', 'Diff (L)', 'Galones', 'Precio', 'Total L.'].map((h, i) => (
                  <th key={h} style={{ padding: '12px 14px', fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: i >= 4 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = calc(r.id, r.pumpFuel);
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{r.pumpName}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ width: 22, height: 22, borderRadius: 5, background: '#0f1f3d', color: '#fbbf24', fontSize: 10, fontWeight: 800, display: 'inline-grid', placeItems: 'center' }}>{r.face}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>D{r.name.slice(-1)}</td>
                    <td style={{ padding: '10px 14px' }}><Badge tone="neutral" dot>{r.fuelName}</Badge></td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(c.initVal, 2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <input
                        value={finals[r.id] || ''}
                        onChange={(e) => setFinals(s => ({ ...s, [r.id]: e.target.value }))}
                        disabled={isClosed}
                        style={{
                          width: 120, padding: '6px 8px', textAlign: 'right',
                          fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 700, color: '#0f172a',
                          border: '1px solid #e2e8f0', borderRadius: 7, background: isClosed ? '#f8fafc' : 'white', outline: 'none',
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#16a34a' }}>+{fmtNum(c.liters, 2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(c.gallons, 2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>L. {r.pumpFuel.price.toFixed(2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: '#0f172a' }}>{fmtL(c.lemp)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#0f1f3d', color: 'white' }}>
                <td colSpan={6} style={{ padding: '14px 14px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: '#fbbf24' }}>Totales del día</td>
                <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800 }}>{fmtNum(totals.l, 2)} L</td>
                <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800 }}>{fmtNum(totals.g, 2)} gal</td>
                <td/>
                <td style={{ padding: '14px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: '#fbbf24' }}>{fmtL(totals.m)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {isClosed && (
        <div style={{ background: '#dcfce7', borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #86efac' }}>
          <Icon name="lock" size={18} style={{ color: '#16a34a' }}/>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>Día cerrado correctamente</div>
            <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>Solo un administrador puede editar las lecturas después del cierre.</div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="¿Cerrar el día 26/04/2026?"
        message={`Se cerrará el día con ${rows.length} dispensadores registrados, total de ${fmtL(totals.m)}. Después del cierre solo un administrador podrá editar las lecturas.`}
        confirmLabel="Sí, cerrar día"
        icon="lock"
        tone="warning"
        onConfirm={handleClose}
      />
    </div>
  );
}
