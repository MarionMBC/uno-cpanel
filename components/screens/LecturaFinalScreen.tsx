'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import TextField from '@/components/ui/TextField';
import ConfirmDialog from '@/components/overlays/ConfirmDialog';
import { fmtL, fmtNum } from '@/lib/utils';
import { LITERS_PER_GALLON } from '@/lib/constants';
import { DailyReading } from '@/types';
import * as XLSX from 'xlsx';

export default function LecturaFinalScreen() {
  const { pumps, dayStatus, setDayStatus, dayData, updateDayData, addAuditEntry, readings, saveReadings, currentPrices, roles } = useApp();
  const { appUser } = useAuth();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const rows = useMemo(() => {
    return pumps
      .filter(p => p.isActive)
      .flatMap(p => p.faces.flatMap(f => f.dispensers.map(d => ({
        id: d.id, name: d.name, pumpName: p.name, face: f.id,
        fuel: d.fuel, fuelName: d.fuelName, fuelColor: d.fuelColor
      }))));
  }, [pumps]);

  const [finals, setFinals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    rows.forEach(r => {
      const existing = readings.find(reading => reading.dispenserId === r.id);
      if (existing && existing.finalReading !== undefined && existing.status !== 'mantenimiento') {
        o[r.id] = existing.finalReading.toString();
      } else {
        o[r.id] = '';
      }
    });
    return o;
  });

  const getPrice = (fuelId: string) => currentPrices[fuelId as 'super' | 'regular' | 'diesel'] || 0;

  const calc = (id: string, fuelId: string) => {
    const existing = readings.find(r => r.dispenserId === id);
    if (!existing || existing.status === 'mantenimiento') return { liters: 0, gallons: 0, lemp: 0, initVal: existing?.initialReading || 0, price: getPrice(fuelId) };
    
    const iVal = existing.initialReading || 0;
    const fVal = parseFloat(finals[id]) || 0;
    const liters = Math.max(0, fVal - iVal);
    const gallons = liters / LITERS_PER_GALLON;
    const lemp = gallons * getPrice(fuelId);
    return { liters, gallons, lemp, initVal: iVal, price: getPrice(fuelId) };
  };

  const totals = rows.reduce((s, r) => {
    const c = calc(r.id, r.fuel);
    s.l += c.liters; s.g += c.gallons; s.m += c.lemp;
    return s;
  }, { l: 0, g: 0, m: 0 });

  const isClosed = dayStatus === 'cerrado';

  const handleConfirmClick = () => {
    // 1. Missing initial readings
    const noInitial = rows.filter(r => !readings.find(reading => reading.dispenserId === r.id));
    if (noInitial.length > 0) {
      toast.error('Faltan lecturas iniciales', `Hay ${noInitial.length} dispensadores sin lectura inicial hoy. Completa la lectura inicial primero.`);
      return;
    }

    // 2. Missing final values
    const missing = rows.filter(r => {
      const existing = readings.find(reading => reading.dispenserId === r.id);
      if (existing?.status === 'mantenimiento') return false;
      const v = finals[r.id];
      return v === '' || v === undefined;
    });

    if (missing.length > 0) {
      toast.error('Lecturas incompletas', `Faltan ${missing.length} dispensadores por registrar.`);
      return;
    }

    // 3. Invalid numbers
    const invalid = rows.filter(r => {
      const existing = readings.find(reading => reading.dispenserId === r.id);
      if (existing?.status === 'mantenimiento') return false;
      const v = parseFloat(finals[r.id]);
      return isNaN(v) || v < 0;
    });

    if (invalid.length > 0) {
      toast.error('Valores inválidos', 'Revisa que todas las lecturas sean números válidos y mayores o iguales a cero.');
      return;
    }

    // 4. Final < Initial
    const lesser = rows.filter(r => {
      const existing = readings.find(reading => reading.dispenserId === r.id);
      if (existing?.status === 'mantenimiento') return false;
      const fVal = parseFloat(finals[r.id]);
      const iVal = existing?.initialReading || 0;
      return fVal < iVal;
    });

    if (lesser.length > 0) {
      toast.error('Lecturas incorrectas', `Hay ${lesser.length} lecturas finales que son MENORES a la inicial. En los surtidores, el totalizador siempre avanza hacia arriba.`);
      return;
    }

    setConfirmOpen(true);
  };

  const handleClose = async () => {
    const updatedReadings: DailyReading[] = [];
    const today = new Date().toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    rows.forEach(r => {
      const existing = readings.find(reading => reading.dispenserId === r.id);
      if (existing) {
        if (existing.status === 'mantenimiento') {
          updatedReadings.push({ ...existing, finalReading: existing.initialReading, liters: 0, gallons: 0, total: 0 });
        } else {
          const finalVal = parseFloat(finals[r.id]);
          if (!isNaN(finalVal)) {
            const c = calc(r.id, r.fuel);
            updatedReadings.push({
              ...existing,
              finalReading: finalVal,
              liters: c.liters,
              gallons: c.gallons,
              total: c.lemp,
            });
          }
        }
      }
    });

    if (updatedReadings.length > 0) {
      await saveReadings(updatedReadings);
    }

    await updateDayData({
      status: 'cerrado'
    });
    setDayStatus('cerrado');

    const roleName = roles.find(r => r.id === appUser?.roleId)?.name || 'Desconocido';
    addAuditEntry({
      timestamp: new Date().toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }),
      date: today,
      userId: appUser?.uid || 'unknown',
      userName: appUser?.name || 'Sistema',
      userRole: roleName,
      action: 'Cierre del día',
      target: today,
      detail: `Total ${fmtL(totals.m)}`,
      icon: 'lock',
    });
    setConfirmOpen(false);
    toast.success('Día cerrado', `Resumen final guardado · ${fmtL(totals.m)}`);
  };

  const exportExcel = () => {
    const today = new Date().toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    const data = rows.map(r => {
      const c = calc(r.id, r.fuel);
      return {
        'Bomba': r.pumpName,
        'Cara': r.face,
        'Dispensador': `D${r.name.slice(-1)}`,
        'Combustible': r.fuelName,
        'L. Inicial': c.initVal.toFixed(2),
        'L. Final': parseFloat(finals[r.id] || '0').toFixed(2),
        'Litros': c.liters.toFixed(2),
        'Galones': c.gallons.toFixed(2),
        'Precio/L': c.price.toFixed(2),
        'Total L.': c.lemp.toFixed(2),
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lectura Final');
    XLSX.writeFile(wb, `Reporte_Diario_${today}.xlsx`);
    toast.success('Excel generado', `Reporte_Diario_${today}.xlsx descargado.`);
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ background: 'linear-gradient(135deg,#0a1530,#14275a)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Fin del turno · {new Date().toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, letterSpacing: -0.3 }}>Cierre de ventas</div>
            <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 4 }}>Ingresa el totalizador final de cada dispensador para calcular las ventas.</div>
          </div>
          {roles.find(r => r.id === appUser?.roleId)?.permissions?.canCloseDay && (
            <Button variant="primary" icon="lock" onClick={handleConfirmClick} disabled={isClosed}>
              {isClosed ? 'Día cerrado' : 'Cerrar día'}
            </Button>
          )}
        </div>
      </Card>

      <div className="grid-cols-4">
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
            {roles.find(r => r.id === appUser?.roleId)?.permissions?.canCloseDay && (
              <Button variant="primary" size="sm" icon="lock" onClick={handleConfirmClick} disabled={isClosed}>
                {isClosed ? 'Día cerrado' : 'Cerrar día'}
              </Button>
            )}
          </div>
        </div>

        <div className="table-responsive">
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
                const c = calc(r.id, r.fuel);
                const existing = readings.find(reading => reading.dispenserId === r.id);
                const isMant = existing?.status === 'mantenimiento';

                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{r.pumpName}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ width: 22, height: 22, borderRadius: 5, background: '#0f1f3d', color: '#fbbf24', fontSize: 10, fontWeight: 800, display: 'inline-grid', placeItems: 'center' }}>{r.face}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>D{r.name.slice(-1)}</td>
                    <td style={{ padding: '10px 14px' }}><Badge tone="neutral" dot color={r.fuelColor}>{r.fuelName}</Badge></td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(c.initVal, 2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      {isMant ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Badge tone="neutral">Mantenimiento</Badge>
                        </div>
                      ) : (
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
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: isMant ? '#94a3b8' : '#16a34a' }}>{isMant ? '-' : `+${fmtNum(c.liters, 2)}`}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{isMant ? '-' : fmtNum(c.gallons, 2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>L. {c.price.toFixed(2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: isMant ? '#94a3b8' : '#0f172a' }}>{isMant ? '-' : fmtL(c.lemp)}</td>
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
        title={`¿Cerrar el día ${new Date().toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' })}?`}
        message={`Se cerrará el día con ${rows.length} dispensadores registrados, total de ${fmtL(totals.m)}. Después del cierre solo un administrador podrá editar las lecturas.`}
        confirmLabel="Sí, cerrar día"
        icon="lock"
        tone="warning"
        onConfirm={handleClose}
      />
    </div>
  );
}
