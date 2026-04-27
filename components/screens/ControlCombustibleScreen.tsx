'use client';

import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import TextField from '@/components/ui/TextField';
import ConfirmDialog from '@/components/overlays/ConfirmDialog';
import Modal from '@/components/overlays/Modal';
import { FuelReceipt } from '@/types';
import { LITERS_PER_GALLON, FUELS } from '@/lib/constants';
import { fmtNum } from '@/lib/utils';

type Tab = 'apertura' | 'recepciones' | 'cierre';

export default function ControlCombustibleScreen() {
  const { dayData, updateDayData, dayStatus, pumps, readings, currentPrices } = useApp();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('apertura');

  // Apertura State
  const [horometerInitial, setHorometerInitial] = useState('');
  const [initialDipsticks, setInitialDipsticks] = useState<Record<string, string>>({ super: '', regular: '', diesel: '' });

  // Recepciones State
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [draftReceipt, setDraftReceipt] = useState<Partial<FuelReceipt>>({ fuelId: 'super', amount: 0 });

  // Cierre State
  const [horometerFinal, setHorometerFinal] = useState('');
  const [finalDipsticks, setFinalDipsticks] = useState<Record<string, string>>({ super: '', regular: '', diesel: '' });

  const isClosed = dayStatus === 'cerrado';

  // Load from AppContext
  useEffect(() => {
    if (dayData) {
      if (dayData.horometerInitial !== undefined) setHorometerInitial(dayData.horometerInitial.toString());
      if (dayData.horometerFinal !== undefined) setHorometerFinal(dayData.horometerFinal.toString());
      
      if (dayData.tanks) {
        setInitialDipsticks({
          super: dayData.tanks.super?.initialDipstick?.toString() || '',
          regular: dayData.tanks.regular?.initialDipstick?.toString() || '',
          diesel: dayData.tanks.diesel?.initialDipstick?.toString() || '',
        });
        setFinalDipsticks({
          super: dayData.tanks.super?.finalDipstick?.toString() || '',
          regular: dayData.tanks.regular?.finalDipstick?.toString() || '',
          diesel: dayData.tanks.diesel?.finalDipstick?.toString() || '',
        });
      }
    }
  }, [dayData]);

  const saveApertura = async () => {
    await updateDayData({
      horometerInitial: parseFloat(horometerInitial) || 0,
      tanks: {
        ...dayData?.tanks,
        super: { ...dayData?.tanks?.super, initialDipstick: parseFloat(initialDipsticks.super) || 0 },
        regular: { ...dayData?.tanks?.regular, initialDipstick: parseFloat(initialDipsticks.regular) || 0 },
        diesel: { ...dayData?.tanks?.diesel, initialDipstick: parseFloat(initialDipsticks.diesel) || 0 },
      }
    });
    toast.success('Apertura guardada', 'Inventario inicial y horómetro registrados.');
  };

  const saveCierre = async () => {
    await updateDayData({
      horometerFinal: parseFloat(horometerFinal) || 0,
      tanks: {
        ...dayData?.tanks,
        super: { ...dayData?.tanks?.super, finalDipstick: parseFloat(finalDipsticks.super) || 0 },
        regular: { ...dayData?.tanks?.regular, finalDipstick: parseFloat(finalDipsticks.regular) || 0 },
        diesel: { ...dayData?.tanks?.diesel, finalDipstick: parseFloat(finalDipsticks.diesel) || 0 },
      }
    });
    toast.success('Cierre guardado', 'Inventario final registrado para el cuadre.');
  };

  const addReceipt = async () => {
    if (!draftReceipt.amount || draftReceipt.amount <= 0) {
      toast.error('Monto inválido', 'Ingresa la cantidad de litros recibidos.');
      return;
    }

    const fuel = FUELS.find(f => f.id === draftReceipt.fuelId) || FUELS[0];
    const newReceipt: FuelReceipt = {
      id: `rec-${Date.now()}`,
      fuelId: fuel.id,
      fuelName: fuel.name,
      amount: draftReceipt.amount,
      driver: draftReceipt.driver || '',
      invoice: draftReceipt.invoice || '',
      plate: draftReceipt.plate || '',
      timestamp: new Date().toISOString()
    };

    const updatedReceipts = [...(dayData?.receipts || []), newReceipt];
    
    // Also update the total refueled amount for quick calculation
    const fuelAmountTotal = (dayData?.tanks?.[fuel.id as 'super'|'regular'|'diesel']?.refueledAmount || 0) + draftReceipt.amount;

    await updateDayData({
      receipts: updatedReceipts,
      tanks: {
        ...dayData?.tanks,
        [fuel.id]: {
          ...dayData?.tanks?.[fuel.id as 'super'|'regular'|'diesel'],
          refueledAmount: fuelAmountTotal
        }
      }
    });

    setReceiptOpen(false);
    setDraftReceipt({ fuelId: 'super', amount: 0 });
    toast.success('Recepción registrada', `Se agregaron ${newReceipt.amount} L al inventario de ${fuel.name}.`);
  };

  // Compute Fuel Totals Sold
  const fuelTotalsSold = useMemo(() => {
    const s: Record<string, number> = { super: 0, regular: 0, diesel: 0 };
    readings.forEach(r => {
      if (r.status !== 'mantenimiento' && r.finalReading !== undefined) {
        s[r.fuelId] += Math.max(0, r.finalReading - r.initialReading);
      }
    });
    return s;
  }, [readings]);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ background: 'linear-gradient(135deg,#0a1530,#14275a)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Gestión Diaria · {new Date().toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, letterSpacing: -0.3 }}>Control de Combustible y Evaporación</div>
            <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 4 }}>Registra el inventario de la planta, varillas de tanques y la llegada de pipas.</div>
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #e2e8f0', marginBottom: 8 }}>
        <button onClick={() => setActiveTab('apertura')} style={{
          padding: '12px 16px', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 14, fontWeight: activeTab === 'apertura' ? 800 : 600,
          color: activeTab === 'apertura' ? '#0f172a' : '#64748b',
          borderBottom: activeTab === 'apertura' ? '3px solid #fbbf24' : '3px solid transparent',
        }}>Apertura (Varillas Iniciales)</button>
        <button onClick={() => setActiveTab('recepciones')} style={{
          padding: '12px 16px', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 14, fontWeight: activeTab === 'recepciones' ? 800 : 600,
          color: activeTab === 'recepciones' ? '#0f172a' : '#64748b',
          borderBottom: activeTab === 'recepciones' ? '3px solid #fbbf24' : '3px solid transparent',
        }}>Recepciones (Recargas)</button>
        <button onClick={() => setActiveTab('cierre')} style={{
          padding: '12px 16px', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 14, fontWeight: activeTab === 'cierre' ? 800 : 600,
          color: activeTab === 'cierre' ? '#0f172a' : '#64748b',
          borderBottom: activeTab === 'cierre' ? '3px solid #fbbf24' : '3px solid transparent',
        }}>Cierre y Cuadre</button>
      </div>

      {activeTab === 'apertura' && (
        <Card padding={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Lecturas Iniciales de la Planta</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Registra estas lecturas antes de empezar el despacho.</div>
            </div>
            <Button variant="primary" icon="check" onClick={saveApertura} disabled={isClosed}>Guardar Apertura</Button>
          </div>
          <div className="grid-cols-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
               <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Horómetro Planta</div>
               <TextField
                 label="Horas Iniciales"
                 value={horometerInitial}
                 onChange={(val) => { if (/^\d*\.?\d*$/.test(val)) setHorometerInitial(val); }}
                 suffix="hrs"
                 disabled={isClosed}
               />
            </div>
            {['super', 'regular', 'diesel'].map(f => (
              <div key={f} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                 <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'capitalize' }}>Tanque {f}</div>
                 <TextField
                   label="Varilla Inicial"
                   value={initialDipsticks[f]}
                   onChange={(val) => { if (/^\d*\.?\d*$/.test(val)) setInitialDipsticks(s => ({ ...s, [f]: val })); }}
                   suffix="L"
                   disabled={isClosed}
                 />
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'recepciones' && (
        <Card padding={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Entradas de Combustible (Recargas)</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Añade los recibos cuando llega la pipa con producto nuevo.</div>
            </div>
            <Button variant="primary" icon="plus" onClick={() => setReceiptOpen(true)} disabled={isClosed}>Registrar Pipa</Button>
          </div>

          {!dayData?.receipts || dayData.receipts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
              <Icon name="droplet" size={32} style={{ color: '#94a3b8', marginBottom: 12 }}/>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>No se han registrado descargas hoy</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Haz clic en "Registrar Pipa" cuando ingrese nuevo inventario.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {dayData.receipts.map(rec => (
                <div key={rec.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, background: 'white' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f1f5f9', display: 'grid', placeItems: 'center' }}>
                      <Icon name="truck" size={20} style={{ color: '#64748b' }}/>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', display: 'flex', gap: 8, alignItems: 'center' }}>
                        Factura: {rec.invoice || 'S/N'}
                        <span style={{ fontSize: 10, padding: '2px 6px', background: '#f1f5f9', borderRadius: 4, textTransform: 'uppercase' }}>{rec.fuelName}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Placa: {rec.plate || 'N/A'} · Conductor: {rec.driver || 'N/A'} · {new Date(rec.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>+{fmtNum(rec.amount, 2)} L</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Descargado</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'cierre' && (
        <Card padding={24}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Cierre y Cuadre de Evaporación</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>Registra las medidas finales y compara el consumo de los tanques contra lo facturado.</div>
            </div>
            <Button variant="primary" icon="lock" onClick={saveCierre} disabled={isClosed}>Guardar y Cuadrar</Button>
          </div>

          <div className="grid-cols-4">
            {/* Horometer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
               <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Horómetro Planta</div>
               <TextField
                 label="Horas Finales"
                 value={horometerFinal}
                 onChange={(val) => { if (/^\d*\.?\d*$/.test(val)) setHorometerFinal(val); }}
                 suffix="hrs"
                 disabled={isClosed}
               />
               <div style={{ fontSize: 12, color: '#64748b' }}>
                 Inicial: {dayData?.horometerInitial || '0'} hrs
               </div>
               <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 4 }}>
                 Trabajado: {Math.max(0, (parseFloat(horometerFinal) || 0) - (dayData?.horometerInitial || 0)).toFixed(2)} hrs
               </div>
            </div>

            {/* Tanks Cuadre */}
            {['super', 'regular', 'diesel'].map(f => {
              const initial = dayData?.tanks?.[f as 'super'|'regular'|'diesel']?.initialDipstick || 0;
              const refueledVal = dayData?.tanks?.[f as 'super'|'regular'|'diesel']?.refueledAmount || 0;
              const final = parseFloat(finalDipsticks[f]) || 0;
              const consumo = initial + refueledVal - final;
              const despachado = fuelTotalsSold[f] || 0;
              const diff = consumo - despachado;

              return (
                <div key={f} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                   <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'capitalize' }}>Tanque {f}</div>
                   <TextField
                     label="Varilla Final"
                     value={finalDipsticks[f]}
                     onChange={(val) => { if (/^\d*\.?\d*$/.test(val)) setFinalDipsticks(s => ({ ...s, [f]: val })); }}
                     suffix="L"
                     disabled={isClosed}
                   />
                   <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 4 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Inicial:</span> <span>{initial} L</span></div>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Entradas:</span> <span style={{ color: '#16a34a' }}>+{refueledVal} L</span></div>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Despachado:</span> <span style={{ color: '#d97706' }}>-{despachado.toFixed(2)} L</span></div>
                   </div>
                   <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', borderTop: '1px solid #e2e8f0', paddingTop: 8, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                       <span>Consumo real:</span>
                       <span>{Math.max(0, consumo).toFixed(2)} L</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 6, background: diff < 0 ? '#fef2f2' : diff > 0 ? '#f0fdf4' : '#f8fafc', color: diff < 0 ? '#ef4444' : diff > 0 ? '#16a34a' : '#64748b' }}>
                       <span>Cuadre:</span>
                       <span>{diff < 0 ? `Sobra ${Math.abs(diff).toFixed(2)}L` : (diff > 0 ? `Falta ${diff.toFixed(2)}L` : 'Exacto')}</span>
                     </div>
                   </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Modal open={receiptOpen} onClose={() => setReceiptOpen(false)} title="Registrar Recepción (Pipa)" icon="truck" width={500} footer={
        <>
          <Button variant="secondary" onClick={() => setReceiptOpen(false)}>Cancelar</Button>
          <Button variant="primary" icon="plus" onClick={addReceipt}>Guardar Recepción</Button>
        </>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Producto Recibido *</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {FUELS.map(f => (
                <button key={f.id} onClick={() => setDraftReceipt(s => ({ ...s, fuelId: f.id }))} style={{
                  padding: 10, borderRadius: 9, fontFamily: 'inherit', cursor: 'pointer',
                  border: 0, background: draftReceipt.fuelId === f.id ? f.color + '22' : '#f8fafc',
                  boxShadow: draftReceipt.fuelId === f.id ? `0 0 0 2px ${f.color}` : '0 0 0 1px #e2e8f0',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: f.color, color: 'white', display: 'grid', placeItems: 'center' }}><Icon name="droplet" size={10}/></div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{f.name}</span>
                </button>
              ))}
            </div>
          </div>
          <TextField
            label="Cantidad Recibida (Litros) *"
            value={draftReceipt.amount?.toString() || ''}
            onChange={(val) => { if (/^\d*\.?\d*$/.test(val)) setDraftReceipt(s => ({ ...s, amount: parseFloat(val) || 0 })); }}
            autoFocus
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <TextField
              label="Factura (Opcional)"
              value={draftReceipt.invoice || ''}
              onChange={(val) => setDraftReceipt(s => ({ ...s, invoice: val }))}
              placeholder="N° de factura"
            />
            <TextField
              label="Placa del Vehículo (Opcional)"
              value={draftReceipt.plate || ''}
              onChange={(val) => setDraftReceipt(s => ({ ...s, plate: val }))}
              placeholder="Ej. AAA-0000"
            />
          </div>
          <TextField
            label="Conductor (Opcional)"
            value={draftReceipt.driver || ''}
            onChange={(val) => setDraftReceipt(s => ({ ...s, driver: val }))}
          />
        </div>
      </Modal>
    </div>
  );
}
