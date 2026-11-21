'use client';

// Última sugerencia automática del precio oficial (Cloud Function precioOficialSemanal, TASK-020).
// Solo informa: «Usar» la pasa a la tabla de PrecioOficialCard, que aplica la misma verificación.
import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { fmtNum } from '@/lib/utils';

type Clave = 'super' | 'regular' | 'diesel';
const CLAVES: Clave[] = ['super', 'regular', 'diesel'];
const NOMBRES: Record<Clave, string> = { super: 'Súper', regular: 'Regular', diesel: 'Diésel' };
/** Una sugerencia con vigencia más vieja que esto ya no se muestra. */
const DIAS_VALIDEZ = 10;

export interface SugerenciaOficial {
  vigencia: string;
  porGalon: Record<Clave, number>;
  fuentes: { medio: string; url: string | null }[];
  coinciden: boolean | null;
  senImagen: { url: string; fecha: string } | null;
}

/** Valida la forma del documento (lo escribe la función, pero se lee en el borde). */
function parsear(d: Record<string, unknown>): SugerenciaOficial | null {
  const pg = d.porGalon as Record<string, unknown> | undefined;
  const fuentes = d.fuentes as unknown;
  if (typeof d.vigencia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.vigencia)) return null;
  if (!pg || !CLAVES.every(c => typeof pg[c] === 'number')) return null;
  if (!Array.isArray(fuentes) || fuentes.length === 0) return null;
  const sen = d.senImagen as { url?: unknown; fecha?: unknown } | null | undefined;
  return {
    vigencia: d.vigencia,
    porGalon: { super: pg.super as number, regular: pg.regular as number, diesel: pg.diesel as number },
    fuentes: fuentes.map((f: { medio?: unknown; url?: unknown }) => ({
      medio: typeof f?.medio === 'string' ? f.medio : 'Medio',
      url: typeof f?.url === 'string' ? f.url : null,
    })),
    coinciden: d.coinciden === true ? true : d.coinciden === false ? false : null,
    senImagen: sen && typeof sen.url === 'string' ? { url: sen.url, fecha: typeof sen.fecha === 'string' ? sen.fecha : '' } : null,
  };
}

export default function SugerenciaSemanal({ onUsar }: { onUsar: (s: SugerenciaOficial) => void }) {
  const [s, setS] = useState<SugerenciaOficial | null>(null);

  useEffect(() => {
    getDocs(query(collection(db, 'prices_official'), orderBy('vigencia', 'desc'), limit(1)))
      .then(snap => {
        const d = snap.docs[0] ? parsear(snap.docs[0].data()) : null;
        const vieja = d && Date.parse(`${d.vigencia}T12:00:00Z`) < Date.now() - DIAS_VALIDEZ * 86400000;
        setS(d && !vieja ? d : null);
      })
      .catch(() => setS(null)); // sin colección o sin permiso: no se muestra nada
  }, []);

  if (!s) return null;
  return (
    <div style={{ padding: '10px 14px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: '#1e3a8a' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>Sugerencia automática de la semana</strong>
          <Badge tone="info" icon="calendar">Vigente desde {s.vigencia.split('-').reverse().join('/')}</Badge>
          {s.coinciden === true
            ? <Badge tone="success" icon="check">{s.fuentes.length} fuentes coinciden</Badge>
            : <Badge tone="warning" icon="alert">Una sola fuente</Badge>}
        </div>
        <div>
          Tegucigalpa L/gal: {CLAVES.map(c => `${NOMBRES[c]} ${fmtNum(s.porGalon[c], 2)}`).join(' · ')}
        </div>
      </div>
      <Button variant="secondary" icon="arrow-down" onClick={() => onUsar(s)}>Usar</Button>
    </div>
  );
}
