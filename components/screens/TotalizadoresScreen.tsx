'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '@/lib/firebase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import TextField from '@/components/ui/TextField';
import { DailyReading, DayStatus } from '@/types';
import { buildCuadro, cuadroAoa, FilaCuadro } from '@/lib/totalizadores';
import { fmtL, fmtNum } from '@/lib/utils';

const SIN_LECTURAS: DailyReading[] = [];
const fechaHN = (iso: string) => iso.split('-').reverse().join('/');

const mono: React.CSSProperties = { fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' };
const th: React.CSSProperties = { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'right', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 14px', textAlign: 'right', ...mono, color: '#334155', whiteSpace: 'nowrap' };

function EstadoBadge({ f }: { f: FilaCuadro }) {
  if (f.estado === 'pendiente') return <Badge tone="warning" dot>Pendiente</Badge>;
  if (f.estado === 'invalida') return <Badge tone="danger" icon="alert">Final menor</Badge>;
  if (f.estado === 'sin_inicial') return <Badge tone="neutral">Sin lectura</Badge>;
  if (f.estado === 'mantenimiento') return <Badge tone="neutral" icon="wrench">Mantenimiento</Badge>;
  return null;
}

export default function TotalizadoresScreen() {
  const { pumps, readings, currentPrices, dayData, roles, today } = useApp();
  const { appUser } = useAuth();
  const toast = useToast();
  // El value de ToastProvider cambia en cada render: usarlo vía ref evita relanzar la carga.
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const hoy = today;
  const [fecha, setFecha] = useState(hoy);
  const esHoy = fecha === hoy;

  // Datos de otra fecha, etiquetados con la fecha que cargaron: nunca se muestran bajo otra fecha.
  const [otro, setOtro] = useState<{ fecha: string; lecturas: DailyReading[]; dia: DayStatus | null; error: boolean } | null>(null);

  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (esHoy) return;
    let vivo = true;
    (async () => {
      try {
        const [snap, day] = await Promise.all([
          getDocs(query(collection(db, 'readings'), where('date', '==', fecha))),
          getDoc(doc(db, 'dayStatus', fecha)),
        ]);
        if (!vivo) return;
        setOtro({
          fecha,
          lecturas: snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyReading)),
          dia: day.exists() ? (day.data() as DayStatus) : null,
          error: false,
        });
      } catch {
        if (!vivo) return;
        setOtro({ fecha, lecturas: [], dia: null, error: true });
        toastRef.current.error('No se pudo cargar', `No fue posible leer las lecturas del ${fechaHN(fecha)}.`);
      }
    })();
    return () => { vivo = false; };
  }, [fecha, esHoy, intento]);

  const otroListo = otro?.fecha === fecha ? otro : null;
  const cargando = !esHoy && !otroListo;
  const errorCarga = !esHoy && otroListo?.error === true;
  const lecturas = useMemo(() => (esHoy ? readings : otroListo?.lecturas ?? SIN_LECTURAS), [esHoy, readings, otroListo]);
  const dia = esHoy ? dayData : otroListo?.dia ?? null;

  const cuadro = useMemo(() => buildCuadro(pumps, lecturas, currentPrices), [pumps, lecturas, currentPrices]);

  const diaCerrado = dia?.status === 'cerrado';
  const puedeEditar = roles.find(r => r.id === appUser?.roleId)?.permissions?.canCloseDay === true && !diaCerrado && !cargando && !errorCarga;
  const fondoGuardado = dia?.cashFund ?? 0;
  const [fondoTxt, setFondoTxt] = useState<string | null>(null);
  const fondo = fondoTxt !== null ? parseFloat(fondoTxt) || 0 : fondoGuardado;
  const cambiado = fondoTxt !== null && fondo !== fondoGuardado;

  const [guardando, setGuardando] = useState(false);
  const guardarFondo = async () => {
    const f = fecha; // la fecha puede cambiar mientras se guarda
    setGuardando(true);
    try {
      // Nunca se escribe `status`: el estado del día solo lo cambian apertura/cierre. Si el documento de hoy
      // no existía, se conserva el estado que ya muestra la app (el de AppContext) para no cambiar el badge.
      const base = f === today && dayData?.status ? { status: dayData.status } : {};
      await setDoc(doc(db, 'dayStatus', f), { date: f, cashFund: fondo, ...base }, { merge: true });
      if (f !== today) {
        setOtro(o => (o && o.fecha === f ? { ...o, dia: { ...(o.dia || { date: f, status: 'en_proceso' }), cashFund: fondo } } : o));
      }
      setFondoTxt(null);
      toast.success('Fondo de cambio guardado', `${fmtL(fondo)} para el ${fechaHN(f)}.`);
    } catch {
      toast.error('No se guardó', 'Revisa la conexión e intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const exportar = () => {
    const responsable = appUser?.name || '';
    const aoa = cuadroAoa(cuadro, { fecha: fechaHN(fecha), responsable, fondoCambio: fondo });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Totalizadores');
    const nombre = `Cuadro_Totalizadores_${fecha}.xlsx`;
    XLSX.writeFile(wb, nombre);
    toast.success('Excel generado', `${nombre} descargado.`);
  };

  const alertas = [
    cuadro.pendientes > 0 && `${cuadro.pendientes} manguera${cuadro.pendientes > 1 ? 's' : ''} sin lectura final`,
    cuadro.invalidas > 0 && `${cuadro.invalidas} con lectura final menor a la inicial`,
    cuadro.sinInicial > 0 && `${cuadro.sinInicial} sin lectura inicial`,
  ].filter(Boolean) as string[];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ background: 'linear-gradient(135deg,#0a1530,#14275a)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Cierre de turno · {fechaHN(fecha)}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, letterSpacing: -0.3 }}>Cuadro de totalizadores</div>
            <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 4 }}>Lectura inicial y final de cada manguera, litros vendidos y total en lempiras.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>
              Fecha
              <input
                type="date"
                value={fecha}
                max={hoy}
                onChange={e => { if (e.target.value) { setFecha(e.target.value); setFondoTxt(null); } }}
                aria-label="Fecha del cuadro"
                style={{ height: 38, borderRadius: 9, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: 'white', padding: '0 10px', fontFamily: 'inherit', fontSize: 13, colorScheme: 'dark' }}
              />
            </label>
            <Button variant="accent" icon="download" onClick={exportar} disabled={cargando || errorCarga}>Exportar Excel</Button>
          </div>
        </div>
      </Card>

      <div className="grid-cols-4">
        <StatCard tone="primary" label="Total ventas" icon="fuel" value={fmtL(cuadro.total)} sub="lecturas completas"/>
        <StatCard tone="neutral" label="Litros vendidos" icon="droplet" value={fmtNum(cuadro.litros, 3)} sub="L"/>
        <StatCard tone="neutral" label="Fondo de cambio" icon="tag" value={fmtL(fondo)} sub={cambiado ? 'sin guardar' : 'del día'}/>
        <StatCard tone="accent" label="Total en caja" icon="lock" value={fmtL(cuadro.total + fondo)} sub="ventas + cambio"/>
      </div>

      {errorCarga && (
        <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13, flexWrap: 'wrap' }}>
          <span><strong>No se pudieron leer las lecturas del {fechaHN(fecha)}.</strong> El cuadro no está disponible.</span>
          <Button variant="secondary" size="sm" icon="history" onClick={() => { setOtro(null); setIntento(n => n + 1); }}>Reintentar</Button>
        </div>
      )}

      {!errorCarga && alertas.length > 0 && (
        <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 16px', borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a', color: '#854d0e', fontSize: 13 }}>
          <Icon name="alert" size={16} style={{ marginTop: 1, flexShrink: 0 }}/>
          <div>
            <strong>Cuadro incompleto:</strong> {alertas.join(' · ')}. Esas mangueras no suman al total hasta corregir la lectura.
          </div>
        </div>
      )}

      <Card padding={0}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef0f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Totalizadores por manguera</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Manguera = cara-manguera de cada bomba. Total = litros × precio por litro.</div>
          </div>
          <div aria-live="polite">{cargando && <Badge tone="info" dot>Cargando…</Badge>}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Manguera</th>
                <th style={{ ...th, textAlign: 'left' }}>Producto</th>
                <th style={th}>Lectura inicial</th>
                <th style={th}>Lectura final</th>
                <th style={th}>Litros</th>
                <th style={th}>Precio / L</th>
                <th style={th}>Total Lps</th>
              </tr>
            </thead>
            {cuadro.grupos.map(g => (
              <tbody key={g.pumpId}>
                <tr style={{ background: '#0f172a' }}>
                  <td colSpan={7} style={{ padding: '8px 14px', color: '#fbbf24', fontSize: 11.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase' }}>{g.pumpName}</td>
                </tr>
                {g.filas.map(f => {
                  const mala = f.estado === 'invalida';
                  return (
                    <tr key={f.key} style={{ borderTop: '1px solid #f1f5f9', background: mala ? '#fef2f2' : 'white' }}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 800, color: '#0f172a' }}>{f.label}</td>
                      <td style={{ ...td, textAlign: 'left', fontFamily: 'inherit' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: f.fuelColor }}/>
                          {f.fuelName}
                        </span>
                      </td>
                      <td style={td}>{f.inicial !== null ? fmtNum(f.inicial, 3) : '—'}</td>
                      <td style={{ ...td, color: mala ? '#dc2626' : td.color }}>{f.final !== null ? fmtNum(f.final, 3) : '—'}</td>
                      <td style={{ ...td, fontWeight: 700, color: '#0f172a' }}>{f.estado === 'ok' ? fmtNum(f.litros, 3) : <EstadoBadge f={f}/>}</td>
                      <td style={td}>{fmtNum(f.precio, 2)}</td>
                      <td style={{ ...td, fontWeight: 800, color: '#0f172a' }}>{f.estado === 'ok' ? fmtL(f.total) : '—'}</td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <td colSpan={4} style={{ ...td, textAlign: 'left', fontFamily: 'inherit', fontWeight: 700, color: '#475569' }}>Subtotal {g.pumpName}</td>
                  <td style={{ ...td, fontWeight: 800, color: '#0f172a' }}>{fmtNum(g.litros, 3)}</td>
                  <td style={td}/>
                  <td style={{ ...td, fontWeight: 800, color: '#0f172a' }}>{fmtL(g.total)}</td>
                </tr>
              </tbody>
            ))}
            <tfoot>
              <tr style={{ background: '#0a1530', color: 'white' }}>
                <td colSpan={4} style={{ padding: '14px', fontWeight: 800 }}>TOTAL</td>
                <td style={{ ...td, color: 'white', fontWeight: 800 }}>{fmtNum(cuadro.litros, 3)}</td>
                <td style={td}/>
                <td style={{ ...td, color: '#fbbf24', fontWeight: 800, fontSize: 14 }}>{fmtL(cuadro.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {cuadro.grupos.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 13 }}>No hay bombas configuradas.</div>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <Card padding={20}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Resumen por producto</div>
          {cuadro.productos.length === 0 ? (
            <div style={{ fontSize: 13, color: '#64748b' }}>Aún no hay mangueras con lectura completa.</div>
          ) : cuadro.productos.map(p => (
            <div key={p.fuelId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #f1f5f9', fontSize: 13 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#334155' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: p.fuelColor }}/>{p.fuelName}
              </span>
              <span style={{ ...mono, color: '#475569' }}>{fmtNum(p.litros, 3)} L · <strong style={{ color: '#0f172a' }}>{fmtL(p.total)}</strong></span>
            </div>
          ))}
        </Card>
        <Card padding={20}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Fondo de cambio</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>Sencillo con el que abre la caja del turno. Se suma al total de ventas para el cuadre de caja.</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <TextField
              label="Monto"
              prefix="L."
              value={fondoTxt ?? String(fondoGuardado)}
              onChange={v => { if (/^\d*\.?\d{0,2}$/.test(v)) setFondoTxt(v); }}
              disabled={!puedeEditar}
              style={{ flex: 1 }}
            />
            <Button variant="primary" icon="check" onClick={guardarFondo} disabled={!puedeEditar || !cambiado || guardando}>Guardar</Button>
          </div>
          {!puedeEditar && !cargando && (
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8 }}>
              {diaCerrado ? 'El día está cerrado: el fondo de cambio ya no se edita.' : 'Solo quien puede cerrar el día edita el fondo de cambio.'}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
