'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import TextField from '@/components/ui/TextField';
import Modal from '@/components/overlays/Modal';
import PrecioOficialCard from '@/components/precios/PrecioOficialCard';
import { FUELS, LITERS_PER_GALLON } from '@/lib/constants';
import { diaOperativo, fechaHoraHN, instanteHN, sumarDias } from '@/lib/fecha';
import { lecturasAbiertas } from '@/lib/inventario';
import {
  calcularVigencia, CLAVES_PRECIO, preciosVigentesEn, resumenPrecios, UMBRAL_VARIACION_PCT, validarPrecios, vigenciaDe,
  type ClavePrecio, type ModoVigencia, type Precios,
} from '@/lib/precios';
import * as XLSX from 'xlsx';

const aTexto = (p: Precios) => ({ super: p.super.toFixed(2), regular: p.regular.toFixed(2), diesel: p.diesel.toFixed(2) });
const NOMBRE: Record<ClavePrecio, string> = { super: 'Súper', regular: 'Regular', diesel: 'Diésel' };

interface Pendiente { precios: Precios; anteriores: Precios; vigenteDesde: string; requiereConfirmacion: boolean; variaciones: Record<ClavePrecio, number | null> }

export default function PreciosScreen() {
  const { currentPrices, setCurrentPrices, priceHistory, precioActual, precioProximo, addAuditEntry, roles, readings } = useApp();
  const { appUser } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState(() => aTexto(currentPrices));
  const [modo, setModo] = useState<ModoVigencia>('ahora');
  const [fecha, setFecha] = useState(() => sumarDias(diaOperativo(), 1));
  const [hora, setHora] = useState('00:00');
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [aceptaVariacion, setAceptaVariacion] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // El borrador sigue al precio vigente cuando cambia (carga inicial, otro equipo, llegada de una vigencia).
  useEffect(() => { setDraft(aTexto(currentPrices)); }, [currentPrices]);

  // La variación (alerta > 15 %) se mide contra el precio que regirá justo antes de la vigencia elegida
  // (p. ej. otro precio ya programado), no contra el de hoy (TASK-023).
  const vigenciaSel = calcularVigencia(modo, new Date(), fecha, hora);
  const isoSel = 'iso' in vigenciaSel ? vigenciaSel.iso : null;
  const base = useMemo(() => (isoSel ? preciosVigentesEn(priceHistory, isoSel) : null) ?? currentPrices, [isoSel, priceHistory, currentPrices]);
  const validacion = useMemo(() => validarPrecios(draft, base), [draft, base]);
  const abiertas = lecturasAbiertas(readings);

  const prepararGuardado = () => {
    if (!validacion.precios) {
      toast.error('Revise los precios', CLAVES_PRECIO.filter(k => validacion.errores[k]).map(k => `${NOMBRE[k]}: ${validacion.errores[k]}`).join(' · '));
      return;
    }
    const v = calcularVigencia(modo, new Date(), fecha, hora);
    if ('error' in v) { toast.error('Vigencia inválida', v.error); return; }
    setAceptaVariacion(false);
    const anteriores = preciosVigentesEn(priceHistory, v.iso) ?? currentPrices;
    const val = validarPrecios(draft, anteriores);
    if (!val.precios) return;
    setPendiente({ precios: val.precios, anteriores, vigenteDesde: v.iso, requiereConfirmacion: val.requiereConfirmacion, variaciones: val.variaciones });
  };

  const confirmar = async () => {
    if (!pendiente) return;
    if (pendiente.requiereConfirmacion && !aceptaVariacion) return;
    setGuardando(true);
    try {
      await setCurrentPrices(pendiente.precios, pendiente.vigenteDesde);
    } catch (e) {
      console.error(e);
      toast.error('No se guardó', 'Revise la conexión o sus permisos e intente de nuevo.');
      setGuardando(false);
      return;
    }
    const desde = fechaHoraHN(pendiente.vigenteDesde);
    const grandes = CLAVES_PRECIO.filter(k => Math.abs(pendiente.variaciones[k] ?? 0) > UMBRAL_VARIACION_PCT);
    addAuditEntry({
      action: 'Precio actualizado',
      target: 'Súper, Regular, Diésel',
      detail: `Vigente desde ${desde}${grandes.length ? ` · variación > ${UMBRAL_VARIACION_PCT} % confirmada (${grandes.map(k => NOMBRE[k]).join(', ')})` : ''}`,
      icon: 'tag',
      before: resumenPrecios(pendiente.anteriores),
      after: resumenPrecios(pendiente.precios),
    }).catch(e => console.warn('Auditoría no registrada:', e));
    toast.success('Precios guardados', `Rigen desde ${desde} para las lecturas que se abran desde entonces.`);
    setGuardando(false);
    setPendiente(null);
    setModo('ahora');
  };

  const exportar = () => {
    const rows = priceHistory.map(h => ({
      'Vigente desde': vigenciaDe(h) ? fechaHoraHN(vigenciaDe(h)) : h.date,
      'Registrado': h.timestamp ? fechaHoraHN(new Date(h.timestamp).toISOString()) : '',
      'Súper (L/L)': h.super,
      'Regular (L/L)': h.regular,
      'Diésel (L/L)': h.diesel,
      'Registrado por': h.registeredBy,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Precios');
    const nombre = `Precios_${diaOperativo()}.xlsx`;
    XLSX.writeFile(wb, nombre);
    toast.success('Excel exportado', `${nombre} descargado.`);
  };

  const ahoraISO = new Date().toISOString();
  const radio = (m: ModoVigencia, label: string) => (
    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}>
      <input type="radio" name="vigencia" checked={modo === m} onChange={() => setModo(m)}/> {label}
    </label>
  );

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PrecioOficialCard
        puedeEditar={roles.find(r => r.id === appUser?.roleId)?.permissions?.canEditPrices === true}
        onUsar={v => setDraft(v)}
        vigentes={currentPrices}
      />

      {precioProximo && (
        <Card style={{ background: '#eff6ff', boxShadow: '0 0 0 1px #bfdbfe' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, color: '#1e3a8a' }}>
            <Icon name="clock" size={16}/>
            <span><b>Precio programado</b> desde {fechaHoraHN(vigenciaDe(precioProximo))}: {resumenPrecios(precioProximo)}.</span>
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {FUELS.map((f) => {
          const k = f.id as ClavePrecio;
          const vigente = base[k];
          const error = validacion.errores[k];
          const variacion = validacion.variaciones[k];
          const nuevo = validacion.precios?.[k] ?? Number(draft[k].replace(',', '.'));
          const diff = Number.isFinite(nuevo) ? nuevo - vigente : 0;
          const grande = Math.abs(variacion ?? 0) > UMBRAL_VARIACION_PCT;
          return (
            <Card key={f.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: f.color + '22', color: f.color, display: 'grid', placeItems: 'center' }}>
                  <Icon name="droplet" size={18}/>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{f.name}</div>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>Vigente: L. {vigente.toFixed(2)}</div>
                </div>
              </div>
              <TextField
                label="Nuevo precio (por litro)"
                prefix="L."
                value={draft[k]}
                onChange={(v) => setDraft(s => ({ ...s, [k]: v }))}
                suffix="/ L"
                error={error}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <Badge tone={grande ? 'warning' : diff >= 0 ? 'success' : 'danger'} icon={diff >= 0 ? 'arrow-up' : 'arrow-down'}>
                  {diff >= 0 ? '+' : ''}{diff.toFixed(2)} L. ({variacion === null ? '—' : `${variacion.toFixed(2)}%`})
                </Badge>
                <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>
                  ≈ L. {(Number.isFinite(nuevo) ? nuevo * LITERS_PER_GALLON : 0).toFixed(2)}/gal
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Rige</div>
          {radio('ahora', 'Desde ahora')}
          {radio('manana', `Desde mañana (${fechaHoraHN(instanteHN(sumarDias(diaOperativo(), 1)))})`)}
          {radio('fecha', 'Desde fecha y hora')}
          {modo === 'fecha' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" aria-label="Fecha de vigencia" value={fecha} min={diaOperativo()} onChange={e => setFecha(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: 12 }}/>
              <input type="time" aria-label="Hora de vigencia" value={hora} onChange={e => setHora(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: 12 }}/>
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 12, lineHeight: 1.5 }}>
          <Icon name="info" size={12} style={{ marginTop: 3 }}/>
          <span>
            Cada lectura conserva el precio con que se abrió. El precio nuevo aplica a las lecturas iniciales que se registren desde su vigencia; no cambia las ventas ya abiertas ni las de días anteriores.
            {abiertas.length > 0 && <> Hoy hay <b>{abiertas.length} lectura{abiertas.length !== 1 && 's'} abierta{abiertas.length !== 1 && 's'}</b> que seguirán con su precio.</>}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <Button variant="secondary" onClick={() => { setDraft(aTexto(currentPrices)); toast.info('Cambios descartados'); }}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={prepararGuardado}>Guardar precios</Button>
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontSize: 14, fontWeight: 800, color: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
          <span>Precios históricos (por vigencia)</span>
          <Button variant="ghost" icon="download" size="sm" onClick={exportar} disabled={priceHistory.length === 0}>Exportar</Button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Vigente desde', 'Súper', 'Regular', 'Diésel', 'Registrado', 'Registrado por'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: i >= 1 && i <= 3 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {priceHistory.map((h, i) => {
                const vig = vigenciaDe(h);
                const esActual = !!precioActual && h.id === precioActual.id;
                const futuro = vig > ahoraISO;
                return (
                  <tr key={h.id || i} style={{ borderTop: '1px solid #f1f5f9', background: esActual ? '#fff8e6' : 'white' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                      {vig ? fechaHoraHN(vig) : h.date}{' '}
                      {esActual && <Badge tone="accent" size="sm">Vigente</Badge>}
                      {futuro && <Badge tone="info" size="sm">Programado</Badge>}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>L. {h.super.toFixed(2)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>L. {h.regular.toFixed(2)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>L. {h.diesel.toFixed(2)}</td>
                    <td style={{ padding: '12px 14px', color: '#64748b', fontFamily: 'ui-monospace, monospace', fontSize: 11.5 }}>{h.timestamp ? fechaHoraHN(new Date(h.timestamp).toISOString()) : '—'}</td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>{h.registeredBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!pendiente}
        onClose={() => { if (!guardando) setPendiente(null); }}
        title="Confirmar nuevo precio"
        subtitle={pendiente ? `Rige desde ${fechaHoraHN(pendiente.vigenteDesde)}. Las lecturas ya abiertas conservan el precio con que se abrieron; el nuevo aplica a las lecturas iniciales que se registren desde esa hora.` : ''}
        icon="tag"
        width={520}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendiente(null)} disabled={guardando}>Cancelar</Button>
            <Button variant="primary" icon="check" onClick={confirmar} disabled={guardando || (!!pendiente?.requiereConfirmacion && !aceptaVariacion)}>
              {guardando ? 'Guardando…' : 'Sí, guardar precios'}
            </Button>
          </>
        }
      >
        {pendiente && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CLAVES_PRECIO.map(k => {
              const v = pendiente.variaciones[k];
              const grande = Math.abs(v ?? 0) > UMBRAL_VARIACION_PCT;
              return (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: 'ui-monospace, monospace' }}>
                  <span style={{ fontWeight: 700, fontFamily: 'inherit' }}>{NOMBRE[k]}</span>
                  <span style={{ color: grande ? '#b45309' : '#0f172a', fontWeight: grande ? 800 : 600 }}>
                    L. {pendiente.anteriores[k].toFixed(2)} → L. {pendiente.precios[k].toFixed(2)} ({v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)} %`})
                  </span>
                </div>
              );
            })}
            {abiertas.length > 0 && (
              <div style={{ fontSize: 12, color: '#475569' }}>{abiertas.length} lectura{abiertas.length !== 1 && 's'} abierta{abiertas.length !== 1 && 's'} hoy seguirá{abiertas.length !== 1 && 'n'} con su precio actual.</div>
            )}
            {pendiente.requiereConfirmacion && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 9, background: '#fef3c7', color: '#78350f', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={aceptaVariacion} onChange={e => setAceptaVariacion(e.target.checked)} style={{ marginTop: 2 }}/>
                Confirmo que la variación mayor a {UMBRAL_VARIACION_PCT} % es correcta (no es un error de digitación).
              </label>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
