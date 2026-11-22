'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import TextField from '@/components/ui/TextField';
import { useToast } from '@/contexts/ToastContext';
import { fmtNum } from '@/lib/utils';
import { DEFAULT_DIFERENCIAL_POR_LITRO } from '@/lib/constants';
import {
  extraerPrecios, notaCompleta, diferencias, porLitro, esNotaDePrecios, PreciosNota,
} from '@/lib/preciosOficiales';
import SugerenciaSemanal, { SugerenciaOficial } from './SugerenciaSemanal';

type Clave = 'super' | 'regular' | 'diesel';
const PRODUCTOS: { id: Clave; nombre: string; color: string }[] = [
  { id: 'super', nombre: 'Súper', color: '#ef4444' },
  { id: 'regular', nombre: 'Regular', color: '#22c55e' },
  { id: 'diesel', nombre: 'Diésel', color: '#f59e0b' },
];

// Medios con WordPress que publican la tabla de la SEN en texto el viernes (CORS abierto, sin costo).
const MEDIOS = [
  { nombre: 'Once Noticias', api: 'https://oncenoticias.hn/wp-json/wp/v2/posts' },
  { nombre: 'HCH', api: 'https://hch.tv/wp-json/wp/v2/posts' },
];
const SEN_MEDIA = 'https://sen.hn/wp-json/wp/v2/media?search=Precios&orderby=date&order=desc&per_page=1&_fields=date,source_url';
const SEN_HISTORICO = 'https://sen.hn/historico-de-precios-de-los-combustibles';
const DIAS_VALIDEZ = 10;
const TIMEOUT_MS = 10000;
/** Diferencial razonable de flete/margen sobre Tegucigalpa, en L/litro. */
const DIF_MIN = -5;
const DIF_MAX = 5;
/** Variación contra el precio vigente que exige revisar antes de usar. */
const SALTO_ALERTA = 0.15;

const httpsOnly = (u: string) => (/^https:\/\//i.test(u) ? u : undefined);

async function fetchConTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try { return await fetch(url, { signal: ctrl.signal }); } finally { clearTimeout(t); }
}

interface Lectura { medio: string; link: string; fecha: string; precios: PreciosNota }
interface Resultado { lecturas: Lectura[]; coinciden: boolean | null; sen: { date: string; source_url: string } | null }

/** null = el medio respondió pero no hay nota útil; lanza error si no se pudo consultar. */
async function leerMedio(m: (typeof MEDIOS)[number]): Promise<Lectura | null> {
  const url = `${m.api}?search=${encodeURIComponent('precios combustibles')}&per_page=10&_fields=date,link,title,content`;
  const res = await fetchConTimeout(url);
  if (!res.ok) throw new Error(`${m.nombre}: HTTP ${res.status}`);
  const posts: { date: string; link: string; title: { rendered: string }; content: { rendered: string } }[] = await res.json();
  const limite = Date.now() - DIAS_VALIDEZ * 86400000;
  for (const p of posts) {
    if (new Date(p.date).getTime() < limite || !esNotaDePrecios(p.title.rendered)) continue;
    const precios = extraerPrecios(p.content.rendered, new Date(p.date).getFullYear(), new Date(p.date).getMonth() + 1);
    if (notaCompleta(precios)) return { medio: m.nombre, link: p.link, fecha: p.date, precios };
  }
  return null;
}

export default function PrecioOficialCard({ onUsar, puedeEditar, vigentes }: { onUsar: (porLitro: Record<Clave, string>) => void; puedeEditar: boolean; vigentes: Record<Clave, number> }) {
  const toast = useToast();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [res, setRes] = useState<Resultado | null>(null);
  const DIF_DEF = { super: String(DEFAULT_DIFERENCIAL_POR_LITRO.super), regular: String(DEFAULT_DIFERENCIAL_POR_LITRO.regular), diesel: String(DEFAULT_DIFERENCIAL_POR_LITRO.diesel) };
  const [dif, setDif] = useState<Record<Clave, string>>(DIF_DEF);
  const [difGuardado, setDifGuardado] = useState<Record<Clave, string> | null>(null);
  const [verificado, setVerificado] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'precios'))
      .then(s => {
        const d = s.exists() ? (s.data().diferencialPorLitro as Partial<Record<Clave, number>> | undefined) : undefined;
        if (d) {
          const v = { super: String(d.super ?? 0), regular: String(d.regular ?? 0), diesel: String(d.diesel ?? 0) };
          setDif(v);
          setDifGuardado(v);
        }
      })
      .catch(() => { /* sin configuración: diferencial 0 */ });
  }, []);

  const consultar = async () => {
    setCargando(true);
    setError('');
    setVerificado(false);
    try {
      let fallosRed = 0;
      const [lecturas, sen] = await Promise.all([
        Promise.all(MEDIOS.map(m => leerMedio(m).catch(() => { fallosRed += 1; return null; }))),
        fetchConTimeout(SEN_MEDIA).then(r => (r.ok ? r.json() : [])).then((a: { date: string; source_url: string }[]) => a[0] ?? null).catch(() => null),
      ]);
      const ok = lecturas.filter((l): l is Lectura => l !== null)
        .sort((a, b) => (b.precios.vigencia || b.fecha).localeCompare(a.precios.vigencia || a.fecha));
      if (ok.length === 0) {
        setRes(null);
        setError(fallosRed === MEDIOS.length
          ? 'No fue posible conectar con las fuentes (sin conexión o bloqueo). Consulte la publicación oficial de la SEN.'
          : 'No se encontró una nota reciente con los precios de esta semana. Consulte la publicación oficial de la SEN.');
        return;
      }
      // Solo se comparan notas de la misma semana de vigencia.
      const mismaSemana = ok.filter(l => l.precios.vigencia === ok[0].precios.vigencia);
      const coinciden = mismaSemana.length < 2 ? null : diferencias(mismaSemana[0].precios, mismaSemana[1].precios).length === 0;
      setRes({ lecturas: mismaSemana, coinciden, sen });
    } catch {
      setError('No fue posible consultar las fuentes (sin conexión o bloqueo). Consulte la publicación oficial de la SEN.');
    } finally {
      setCargando(false);
    }
  };

  // La sugerencia automática entra por el mismo camino que una consulta manual (misma verificación).
  const usarSugerencia = (s: SugerenciaOficial) => {
    setError('');
    setVerificado(false);
    setRes({
      lecturas: s.fuentes.map(f => ({
        medio: f.medio, link: f.url ?? '', fecha: s.vigencia,
        precios: { porGalon: { ...s.porGalon, kerosene: null }, vigencia: s.vigencia },
      })),
      coinciden: s.coinciden,
      sen: s.senImagen ? { date: s.senImagen.fecha, source_url: s.senImagen.url } : null,
    });
  };

  const base = res?.lecturas[0]?.precios;
  const difValido = (p: Clave) => { const n = parseFloat(dif[p] || '0'); return Number.isFinite(n) && n >= DIF_MIN && n <= DIF_MAX; };
  const sugerido = (p: Clave) => {
    const g = base?.porGalon[p];
    if (g == null || !difValido(p)) return null;
    const v = Math.round((porLitro(g) + (parseFloat(dif[p]) || 0)) * 100) / 100;
    return v > 0 ? v : null;
  };
  const salto = (p: Clave) => {
    const v = sugerido(p);
    const a = vigentes[p];
    return v != null && a > 0 ? (v - a) / a : null;
  };
  const todosValidos = PRODUCTOS.every(p => sugerido(p.id) != null);
  const hayDudas = res?.coinciden !== true || PRODUCTOS.some(p => Math.abs(salto(p.id) ?? 0) > SALTO_ALERTA);
  const puedeUsar = puedeEditar && todosValidos && (!hayDudas || verificado);
  const difCambiado = JSON.stringify(dif) !== JSON.stringify(difGuardado ?? DIF_DEF);

  const guardarDif = async () => {
    if (!PRODUCTOS.every(p => difValido(p.id))) {
      toast.error('Diferencial fuera de rango', `Use valores entre ${DIF_MIN} y +${DIF_MAX} L por litro.`);
      return;
    }
    try {
      await setDoc(doc(db, 'settings', 'precios'), {
        diferencialPorLitro: Object.fromEntries(PRODUCTOS.map(p => [p.id, parseFloat(dif[p.id]) || 0])),
      }, { merge: true });
      setDifGuardado(dif);
      toast.success('Diferencial guardado', 'Se usará en las próximas consultas.');
    } catch {
      toast.error('No se guardó', 'Revise la conexión e intente de nuevo.');
    }
  };

  const usar = () => {
    const v = Object.fromEntries(PRODUCTOS.map(p => [p.id, (sugerido(p.id) ?? 0).toFixed(2)])) as Record<Clave, string>;
    onUsar(v);
    toast.info('Precios cargados en el formulario', 'Revíselos y pulse «Guardar precios» para aplicarlos.');
  };

  return (
    <Card padding={0}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef0f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Precio oficial de referencia · SEN</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Precios máximos semanales de la Secretaría de Energía para Tegucigalpa (vigentes desde el lunes). Guaimaca = Tegucigalpa + diferencial de flete.
          </div>
        </div>
        <Button variant="secondary" icon="search" onClick={consultar} disabled={cargando}>{cargando ? 'Consultando…' : 'Consultar precio oficial'}</Button>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SugerenciaSemanal onUsar={usarSugerencia}/>
        {error && (
          <div role="alert" style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 13 }}>
            {error} <a href={SEN_HISTORICO} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700 }}>sen.hn</a>
          </div>
        )}

        {!res && !error && (
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Pulse «Consultar precio oficial» para traer la tabla de esta semana. Nada se aplica sin su confirmación.
          </div>
        )}

        {res && base && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: '#475569' }}>
              <Badge tone="info" icon="calendar">Vigente desde {base.vigencia ? base.vigencia.split('-').reverse().join('/') : 'fecha no indicada'}</Badge>
              {res.coinciden === true && <Badge tone="success" icon="check">{res.lecturas.length} fuentes coinciden</Badge>}
              {res.coinciden === false && <Badge tone="danger" icon="alert">Las fuentes no coinciden: verifique en sen.hn</Badge>}
              {res.coinciden === null && <Badge tone="warning" icon="alert">Una sola fuente: verifique en sen.hn</Badge>}
              <span>Fuente: {res.lecturas.map((l, i) => (
                <a key={l.link} href={httpsOnly(l.link)} target="_blank" rel="noopener noreferrer" style={{ color: '#1d4ed8' }}>{i > 0 ? ', ' : ''}{l.medio}</a>
              ))}</span>
              {res.sen && (
                <a href={httpsOnly(res.sen.source_url)} target="_blank" rel="noopener noreferrer" style={{ color: '#1d4ed8' }}>
                  Imagen oficial SEN ({res.sen.date.slice(0, 10).split('-').reverse().join('/')})
                </a>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>
                    {['Producto', 'Tegucigalpa L/gal', 'Tegucigalpa L/litro', 'Diferencial Guaimaca L/litro', 'Sugerido L/litro'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: i ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PRODUCTOS.map(p => {
                    const g = base.porGalon[p.id];
                    return (
                      <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }}/>{p.nombre}</span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{g != null ? fmtNum(g, 2) : '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>{g != null ? fmtNum(porLitro(g), 2) : '—'}</td>
                        <td style={{ padding: '4px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-block', width: 120 }}>
                            <TextField
                              value={dif[p.id]}
                              onChange={v => { if (/^-?\d*\.?\d{0,2}$/.test(v)) { setDif(d => ({ ...d, [p.id]: v })); setVerificado(false); } }}
                              prefix="+"
                              disabled={!puedeEditar}
                              error={difValido(p.id) ? undefined : `${DIF_MIN} a +${DIF_MAX}`}
                              inputStyle={{ minWidth: 0, width: '100%', textAlign: 'right' }}
                            />
                          </div>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: '#0f172a' }}>
                          {sugerido(p.id) != null ? `L. ${fmtNum(sugerido(p.id) as number, 2)}` : '—'}
                          {salto(p.id) != null && (
                            <div style={{ fontSize: 11, fontWeight: 600, color: Math.abs(salto(p.id) as number) > SALTO_ALERTA ? '#dc2626' : '#64748b' }}>
                              {(salto(p.id) as number) >= 0 ? '+' : ''}{fmtNum((salto(p.id) as number) * 100, 1)} % vs vigente
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="info" size={12}/> El diferencial es el flete/margen de la estación sobre el precio de Tegucigalpa (configurable).
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {hayDudas && (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#92400e', fontWeight: 600 }}>
                    <input type="checkbox" checked={verificado} onChange={e => setVerificado(e.target.checked)} disabled={!puedeEditar}/>
                    Verifiqué estos precios en la imagen oficial de la SEN
                  </label>
                )}
                <Button variant="ghost" onClick={guardarDif} disabled={!puedeEditar || !difCambiado}>Guardar diferencial</Button>
                <Button variant="accent" icon="arrow-down" onClick={usar} disabled={!puedeUsar}>Usar estos precios</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
