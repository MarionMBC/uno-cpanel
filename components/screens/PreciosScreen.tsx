'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import TextField from '@/components/ui/TextField';
import ConfirmDialog from '@/components/overlays/ConfirmDialog';
import { FUELS, LITERS_PER_GALLON } from '@/lib/constants';

export default function PreciosScreen() {
  const { currentPrices, setCurrentPrices, priceHistory, addAuditEntry, roles } = useApp();
  const { appUser } = useAuth();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draft, setDraft] = useState({
    super: currentPrices.super.toFixed(2),
    regular: currentPrices.regular.toFixed(2),
    diesel: currentPrices.diesel.toFixed(2),
  });

  // Sync draft when currentPrices changes from context (e.g. initial load or cross-tab updates)
  useEffect(() => {
    setDraft({
      super: currentPrices.super.toFixed(2),
      regular: currentPrices.regular.toFixed(2),
      diesel: currentPrices.diesel.toFixed(2),
    });
  }, [currentPrices]);

  const lastEntry = priceHistory[1] || priceHistory[0];

  const handleSave = () => {
    const newPrices = {
      super: parseFloat(draft.super) || currentPrices.super,
      regular: parseFloat(draft.regular) || currentPrices.regular,
      diesel: parseFloat(draft.diesel) || currentPrices.diesel,
    };
    setCurrentPrices(newPrices);
    const roleName = roles.find(r => r.id === appUser?.roleId)?.name || 'Desconocido';
    addAuditEntry({
      timestamp: new Date().toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      userId: appUser?.uid || 'unknown',
      userName: appUser?.name || 'Sistema',
      userRole: roleName,
      action: 'Precio actualizado',
      target: 'Súper, Regular, Diésel',
      detail: `Precios actualizados para el ${new Date().toLocaleDateString('es-HN')}`,
      icon: 'tag',
    });
    toast.success('Precios guardados', 'Los precios se aplicarán a las lecturas del día actual.');
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {FUELS.map((f) => {
          const draftKey = f.id as 'super' | 'regular' | 'diesel';
          const lastPrice = lastEntry ? (lastEntry as any)[f.id] : f.price;
          const diff = (parseFloat(draft[draftKey]) || f.price) - lastPrice;
          return (
            <Card key={f.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: f.color + '22', color: f.color, display: 'grid', placeItems: 'center' }}>
                  <Icon name="droplet" size={18}/>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{f.name}</div>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>Anterior: L. {lastPrice.toFixed(2)}</div>
                </div>
              </div>
              <TextField
                label="Precio del día (por litro)"
                prefix="L."
                value={draft[draftKey]}
                onChange={(v) => setDraft(s => ({ ...s, [draftKey]: v }))}
                suffix="/ L"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <Badge tone={diff >= 0 ? 'success' : 'danger'} icon={diff >= 0 ? 'arrow-up' : 'arrow-down'}>
                  {diff >= 0 ? '+' : ''}{diff.toFixed(2)} L. ({((diff / lastPrice) * 100).toFixed(2)}%)
                </Badge>
                <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>
                  ≈ L. {((parseFloat(draft[draftKey]) || f.price) * LITERS_PER_GALLON).toFixed(2)}/gal
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="info" size={12}/> Los precios se aplican a todas las lecturas registradas el día actual hasta el cierre.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => {
            setDraft({ super: currentPrices.super.toFixed(2), regular: currentPrices.regular.toFixed(2), diesel: currentPrices.diesel.toFixed(2) });
            toast.info('Cambios descartados');
          }}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={() => setConfirmOpen(true)}>Guardar precios</Button>
        </div>
      </div>

      <Card padding={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontSize: 14, fontWeight: 800, color: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
          <span>Precios históricos</span>
          <Button variant="ghost" icon="download" size="sm">Exportar</Button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Vigente desde', 'Súper', 'Regular', 'Diésel', 'Registrado por'].map((h, i) => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: i >= 1 && i <= 3 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {priceHistory.map((h, i) => (
              <tr key={(h as any).id || i} style={{ borderTop: '1px solid #f1f5f9', background: i === 0 ? '#fff8e6' : 'white' }}>
                <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                  {h.date} {i === 0 && <Badge tone="accent" size="sm">Vigente</Badge>}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>L. {h.super.toFixed(2)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>L. {h.regular.toFixed(2)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>L. {h.diesel.toFixed(2)}</td>
                <td style={{ padding: '12px 14px', color: '#475569' }}>{h.registeredBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar actualización de precios"
        message={`Vas a actualizar los precios para el día de hoy. Los nuevos precios se aplicarán a todas las lecturas del día.`}
        confirmLabel="Sí, guardar precios"
        icon="tag"
        tone="primary"
        onConfirm={handleSave}
      />
    </div>
  );
}
