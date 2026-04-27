// screens2.jsx — lecturas, reportes, config, auditoría

const { useState: useState2, useMemo: useMemo2 } = React;

// ─── Lectura inicial ────────────────────────────────────────────────────────
function LecturaInicialScreen({ pumps, dayStatus }) {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState2(false);
  const allRows = useMemo2(() => flatReadings(pumps).filter(r => r.pumpActive), [pumps]);
  const [values, setValues] = useState2(() => {
    const o = {};
    allRows.forEach(r => { o[r.id] = { value: r.initial.toFixed(2), status: r.status, obs: '' }; });
    return o;
  });
  const completed = Object.values(values).filter(v => v.value && v.status === 'activo').length;
  const total = allRows.filter(r => r.status === 'activo').length;
  const isClosed = dayStatus === 'cerrado';

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ background: 'linear-gradient(135deg,#0a1530,#14275a)', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: '#fbbf24', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Inicio del día · 26 abr 2026</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, letterSpacing: -0.3 }}>Registrar lectura inicial</div>
            <div style={{ fontSize: 12.5, color: '#cbd5e1', marginTop: 4 }}>Captura la lectura del totalizador antes de abrir cada dispensador.</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' }}>Progreso</div>
            <div style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#fbbf24', letterSpacing: -0.4 }}>{completed}<span style={{ color: '#94a3b8', fontSize: 18 }}> / {total}</span></div>
            <div style={{ width: 200, height: 6, background: 'rgba(255,255,255,.12)', borderRadius: 999, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: `${(completed/total)*100}%`, height: '100%', background: '#fbbf24' }}/>
            </div>
          </div>
        </div>
      </Card>

      {pumps.filter(p => p.isActive).map((p) => (
        <Card key={p.id} padding={0}>
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: p.fuel.color + '22', color: p.fuel.color, display: 'grid', placeItems: 'center' }}><Icon name="fuel" size={18}/></div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>{p.fuel.name} · 2 caras · 6 dispensadores</div>
              </div>
            </div>
            <Badge tone="success" icon="check">Listo para abrir</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {p.faces.map((face, fi) => (
              <div key={face.id} style={{ padding: 18, borderRight: fi === 0 ? '1px solid #f1f5f9' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: '#0f1f3d', color: '#fbbf24', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{face.id}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', letterSpacing: 0.3, textTransform: 'uppercase' }}>Cara {face.id}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {face.dispensers.map((d) => {
                    const v = values[d.id] || {};
                    const isMaint = v.status === 'mantenimiento';
                    return (
                      <div key={d.id} style={{
                        display: 'grid', gridTemplateColumns: '70px 1fr 130px',
                        gap: 10, alignItems: 'center',
                        padding: 10, background: isMaint ? '#fef3c7' : '#f8fafc',
                        borderRadius: 10, border: isMaint ? '1px dashed #f59e0b' : '1px solid #eef0f3',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'white', boxShadow: '0 0 0 1px #e2e8f0', fontSize: 10.5, fontWeight: 800, color: '#0f1f3d', display: 'grid', placeItems: 'center' }}>D{d.name.slice(-1)}</div>
                        </div>
                        <TextField
                          prefix="L"
                          value={v.value}
                          onChange={(val) => setValues(s => ({ ...s, [d.id]: { ...s[d.id], value: val } }))}
                          suffix="ltrs"
                          disabled={isMaint || isClosed}
                        />
                        <div style={{ display: 'flex', gap: 4 }}>
                          {['activo', 'mantenimiento'].map((st) => (
                            <button key={st} onClick={() => setValues(s => ({ ...s, [d.id]: { ...s[d.id], status: st } }))}
                              disabled={isClosed}
                              style={{
                                flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 10.5, fontWeight: 700,
                                fontFamily: 'inherit', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 0.4,
                                border: 0,
                                background: v.status === st ? (st === 'activo' ? '#dcfce7' : '#fef3c7') : 'white',
                                color: v.status === st ? (st === 'activo' ? '#166534' : '#854d0e') : '#94a3b8',
                                boxShadow: v.status === st ? 'none' : '0 0 0 1px #e2e8f0',
                              }}>{st === 'activo' ? 'Activo' : 'Mant.'}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px' }}>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          <Icon name="info" size={12} style={{ verticalAlign: -2 }}/> No se permite registrar dos lecturas iniciales para el mismo dispensador y fecha.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => toast.info('Borrador guardado', 'Puedes continuar más tarde sin perder datos.')}>Guardar borrador</Button>
          <Button variant="primary" icon="check" onClick={() => setConfirmOpen(true)}>Confirmar lectura inicial</Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar lectura inicial del día"
        message={`Vas a registrar ${completed} lecturas iniciales para el 26/04/2026. Una vez confirmadas no se podrán duplicar para esta fecha.`}
        confirmLabel="Sí, confirmar lecturas"
        icon="log-in"
        tone="primary"
        onConfirm={() => toast.success('Lecturas iniciales registradas', `${completed} dispensadores actualizados correctamente.`)}
      />
    </div>
  );
}

// ─── Lectura final ──────────────────────────────────────────────────────────
function LecturaFinalScreen({ pumps, dayStatus, onClose }) {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState2(false);
  const rows = useMemo2(() => flatReadings(pumps).filter(r => r.pumpActive && r.status === 'activo'), [pumps]);
  const [finals, setFinals] = useState2(() => {
    const o = {};
    rows.forEach(r => { o[r.id] = (r.final).toFixed(2); });
    return o;
  });

  const calc = (r) => {
    const f = parseFloat(finals[r.id]) || 0;
    const liters = Math.max(0, f - r.initial);
    const gallons = liters / LITERS_PER_GALLON;
    const lemp = liters * (pumps.find(p => p.id === r.pumpId)?.fuel.price || 0);
    return { liters, gallons, lemp };
  };

  const totals = rows.reduce((s, r) => {
    const c = calc(r);
    s.l += c.liters; s.g += c.gallons; s.m += c.lemp;
    return s;
  }, { l: 0, g: 0, m: 0 });

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
            <Button variant="secondary" icon="download" size="sm" onClick={() => toast.success('Excel generado', 'Reporte_Diario_26-04-2026.xlsx descargado.')}>Excel</Button>
            <Button variant="primary" size="sm" icon="lock" onClick={() => setConfirmOpen(true)}>Cerrar día</Button>
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
                const c = calc(r);
                const price = pumps.find(p => p.id === r.pumpId).fuel.price;
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{r.pumpName}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ width: 22, height: 22, borderRadius: 5, background: '#0f1f3d', color: '#fbbf24', fontSize: 10, fontWeight: 800, display: 'inline-grid', placeItems: 'center' }}>{r.face}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>D{r.name.slice(-1)}</td>
                    <td style={{ padding: '10px 14px' }}><Badge tone="neutral" dot>{r.fuelName}</Badge></td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(r.initial, 2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <input value={finals[r.id]} onChange={(e) => setFinals(s => ({ ...s, [r.id]: e.target.value }))}
                        style={{
                          width: 120, padding: '6px 8px', textAlign: 'right',
                          fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 700, color: '#0f172a',
                          border: '1px solid #e2e8f0', borderRadius: 7, background: 'white', outline: 'none',
                        }}/>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#16a34a' }}>+{fmtNum(c.liters, 2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(c.gallons, 2)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>L. {price.toFixed(2)}</td>
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

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="¿Cerrar el día 26/04/2026?"
        message={`Se cerrará el día con ${rows.length} dispensadores registrados, total de ${fmtL(totals.m)}. Después del cierre solo un administrador podrá editar las lecturas.`}
        confirmLabel="Sí, cerrar día"
        icon="lock"
        tone="warning"
        onConfirm={() => { onClose(); toast.success('Día cerrado', `Resumen final guardado · ${fmtL(totals.m)}`); }}
      />
    </div>
  );
}

// ─── Reporte diario ─────────────────────────────────────────────────────────
function ReporteDiarioScreen({ pumps }) {
  const [selectedDate, setSelectedDate] = useState2('25/04/2026');
  const rows = useMemo2(() => flatReadings(pumps).filter(r => r.pumpActive && r.status === 'activo'), [pumps]);
  const totals = rows.reduce((s, r) => {
    const price = pumps.find(p => p.id === r.pumpId).fuel.price;
    s.l += r.liters; s.g += r.liters / LITERS_PER_GALLON; s.m += r.liters * price;
    return s;
  }, { l: 0, g: 0, m: 0 });

  // group by pump
  const byPump = pumps.filter(p => p.isActive).map(p => {
    const allD = rows.filter(r => r.pumpId === p.id);
    const sumL = allD.reduce((s, r) => s + r.liters, 0);
    return { pump: p, dispensers: allD, liters: sumL, lemp: sumL * p.fuel.price };
  });

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="calendar" size={18} style={{ color: '#0f1f3d' }}/>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Reporte del</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: -0.2 }}>{selectedDate}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {['23/04', '24/04', '25/04', '26/04'].map((d) => {
              const full = `${d}/2026`;
              return (
                <button key={d} onClick={() => setSelectedDate(full)} style={{
                  padding: '8px 14px', borderRadius: 9,
                  background: selectedDate === full ? '#0f1f3d' : 'white',
                  color: selectedDate === full ? 'white' : '#475569',
                  border: '1px solid ' + (selectedDate === full ? '#0f1f3d' : '#e2e8f0'),
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>{d}</button>
              );
            })}
            <div style={{ width: 1, height: 24, background: '#e2e8f0' }}/>
            <Button variant="secondary" icon="download" size="sm">Excel</Button>
            <Button variant="primary" icon="file" size="sm">PDF</Button>
          </div>
        </div>

        {/* metadata strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          {[
            { l: 'Estación', v: 'UNO Guaimaca Centro' },
            { l: 'Generado por', v: 'Daniel Ortez' },
            { l: 'Cierre por', v: 'Daniel Ortez · 14:32' },
            { l: 'Estado', v: <Badge tone="success" icon="lock">Cerrado</Badge> },
            { l: 'Generado', v: '26/04 · 09:14' },
          ].map((m) => (
            <div key={m.l}>
              <div style={{ fontSize: 10.5, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>{m.l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{m.v}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard tone="primary" label="Total general" icon="fuel" value={fmtL(totals.m)} sub="lempiras del día"/>
        <StatCard tone="neutral" label="Total litros" icon="droplet" value={fmtNum(totals.l, 2)} sub="L · ventas confirmadas"/>
        <StatCard tone="neutral" label="Total galones" icon="droplet" value={fmtNum(totals.g, 2)} sub="gal · ventas confirmadas"/>
      </div>

      {byPump.map(({ pump, dispensers, liters, lemp }) => (
        <Card key={pump.id} padding={0}>
          <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: pump.fuel.color + '22', color: pump.fuel.color, display: 'grid', placeItems: 'center' }}><Icon name="fuel" size={16}/></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{pump.name} · {pump.fuel.name}</div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>L. {pump.fuel.price.toFixed(2)} por litro</div>
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
                {['Cara', 'Disp.', 'Inicial', 'Final', 'Litros', 'Galones', 'Total L.'].map((h, i) => (
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
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>D{d.name.slice(-1)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(d.initial, 2)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(d.final, 2)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#0f172a' }}>{fmtNum(d.liters, 2)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(d.liters / LITERS_PER_GALLON, 2)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#0f172a' }}>{fmtL(d.liters * pump.fuel.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

// ─── Reporte mensual ────────────────────────────────────────────────────────
function ReporteMensualScreen({ pumps }) {
  const days = Array.from({ length: 26 }, (_, i) => {
    const r = ((i * 13) % 9 + 5) / 10;
    return {
      day: i + 1,
      liters: 2200 + r * 1400 + (i % 6 === 0 ? 800 : 0),
      lemp: (2200 + r * 1400 + (i % 6 === 0 ? 800 : 0)) * 105,
      complete: i < 25,
    };
  });
  const total = days.reduce((s, d) => ({ l: s.l + d.liters, m: s.m + d.lemp }), { l: 0, m: 0 });
  const max = Math.max(...days.map(d => d.liters));

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Período</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3, marginTop: 2 }}>Abril 2026</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, background: 'white' }}>
              <option>Abril 2026</option><option>Marzo 2026</option><option>Febrero 2026</option>
            </select>
            <Button variant="secondary" icon="download" size="sm">Excel</Button>
            <Button variant="primary" icon="file" size="sm">PDF</Button>
          </div>
        </div>
      </Card>

      <Card style={{ background: '#fef3c7', borderLeft: '3px solid #f59e0b', boxShadow: '0 0 0 1px #fde68a' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Icon name="alert" size={18} style={{ color: '#92400e', marginTop: 1 }}/>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#78350f' }}>1 día con lectura final faltante</div>
            <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>El día 26/04/2026 todavía no se ha cerrado. El reporte mensual es preliminar hasta completar todas las lecturas.</div>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <StatCard tone="primary" label="Total mes" icon="fuel" value={fmtL(total.m)} sub="lempiras"/>
        <StatCard tone="neutral" label="Total litros" icon="droplet" value={fmtNum(total.l, 0)} sub="L mes a la fecha"/>
        <StatCard tone="neutral" label="Total galones" icon="droplet" value={fmtNum(total.l / LITERS_PER_GALLON, 0)} sub="galones"/>
        <StatCard tone="accent" label="Promedio diario" icon="trend-up" value={fmtL(total.m / days.length)} sub="L. / día"/>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Ventas por día (litros)</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Pico el día 23 · 3,512 L</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: 160, gap: 4 }}>
          {days.map((d) => (
            <div key={d.day} style={{ flex: 1, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', justifyContent: 'flex-end' }}>
              <div style={{
                width: '100%',
                height: `${(d.liters / max) * 100}%`,
                background: !d.complete ? 'repeating-linear-gradient(45deg,#fef3c7 0 4px,#fde68a 4px 8px)' : (d.day === 23 ? '#d97706' : '#0f1f3d'),
                borderRadius: '3px 3px 0 0',
                opacity: d.complete ? 1 : 0.9,
              }}/>
              <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>{d.day}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Resumen por bomba · Abril</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Bomba', 'Combustible', 'L. inicial mes', 'L. final mes', 'Litros', 'Galones', 'Total L.'].map((h, i) => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pumps.filter(p => p.isActive).map((p, idx) => {
              const liters = 18450 + idx * 4200;
              return (
                <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>{p.name}</td>
                  <td style={{ padding: '12px 14px' }}><Badge tone="neutral" dot>{p.fuel.name}</Badge></td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(120000 + idx * 5000, 2)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(120000 + idx * 5000 + liters, 2)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{fmtNum(liters, 2)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', color: '#475569' }}>{fmtNum(liters / LITERS_PER_GALLON, 2)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace', fontWeight: 800, color: '#0f172a' }}>{fmtL(liters * p.fuel.price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Precios ────────────────────────────────────────────────────────────────
function PreciosScreen({ pumps }) {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState2(false);
  const [draft, setDraft] = useState2(() => Object.fromEntries(FUELS.map(f => [f.id, f.price.toFixed(2)])));
  const history = [
    { d: '26/04/2026', s: 108.42, r: 102.18, di: 96.74, by: 'Cinthia López' },
    { d: '20/04/2026', s: 107.10, r: 101.55, di: 95.90, by: 'Cinthia López' },
    { d: '13/04/2026', s: 106.74, r: 100.82, di: 95.41, by: 'Cinthia López' },
    { d: '06/04/2026', s: 105.22, r: 99.65, di: 94.18, by: 'Daniel Ortez' },
    { d: '30/03/2026', s: 104.10, r: 98.40, di: 93.05, by: 'Cinthia López' },
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {FUELS.map((f) => {
          const last = history[1];
          const lastPrice = f.id === 'super' ? last.s : f.id === 'regular' ? last.r : last.di;
          const diff = parseFloat(draft[f.id]) - lastPrice;
          return (
            <Card key={f.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: f.color + '22', color: f.color, display: 'grid', placeItems: 'center' }}><Icon name="droplet" size={18}/></div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{f.name}</div>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>Anterior: L. {lastPrice.toFixed(2)}</div>
                </div>
              </div>
              <TextField label="Precio del día (por litro)" prefix="L." value={draft[f.id]} onChange={(v) => setDraft(s => ({ ...s, [f.id]: v }))} suffix="/ L"/>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <Badge tone={diff >= 0 ? 'danger' : 'success'} icon={diff >= 0 ? 'arrow-up' : 'arrow-down'}>
                  {diff >= 0 ? '+' : ''}{diff.toFixed(2)} L. ({((diff / lastPrice) * 100).toFixed(2)}%)
                </Badge>
                <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>≈ L. {(parseFloat(draft[f.id]) * LITERS_PER_GALLON).toFixed(2)}/gal</span>
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
          <Button variant="secondary" onClick={() => toast.info('Cambios descartados')}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={() => setConfirmOpen(true)}>Guardar precios del 26/04</Button>
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
            {history.map((h, i) => (
              <tr key={h.d} style={{ borderTop: '1px solid #f1f5f9', background: i === 0 ? '#fff8e6' : 'white' }}>
                <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                  {h.d} {i === 0 && <Badge tone="accent" size="sm">Vigente</Badge>}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>L. {h.s.toFixed(2)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>L. {h.r.toFixed(2)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' }}>L. {h.di.toFixed(2)}</td>
                <td style={{ padding: '12px 14px', color: '#475569' }}>{h.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Bombas (config) ────────────────────────────────────────────────────────
function BombasScreen({ pumps, setPumps }) {
  const toast = useToast();
  const [picked, setPicked] = useState2(pumps[0].id);
  const pump = pumps.find(p => p.id === picked) || pumps[0];

  const [newPumpOpen, setNewPumpOpen] = useState2(false);
  const [editDispenser, setEditDispenser] = useState2(null); // {face, dispenser}
  const [addDispenserFace, setAddDispenserFace] = useState2(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState2(false);
  const [confirmDelDisp, setConfirmDelDisp] = useState2(null);

  const [pumpDraft, setPumpDraft] = useState2({ name: '', fuel: 'Súper' });
  const [dispDraft, setDispDraft] = useState2({ name: '', sn: '', status: 'activo' });

  return (
    <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Bombas</div>
          <Button variant="primary" icon="plus" size="sm" onClick={() => { setPumpDraft({ name: '', fuel: 'Súper' }); setNewPumpOpen(true); }}>Nueva bomba</Button>
        </div>
        {pumps.map((p) => (
          <Card key={p.id} hoverable padding={14} style={{
            cursor: 'pointer',
            boxShadow: picked === p.id ? '0 0 0 2px #0f1f3d' : '0 0 0 1px #e6e8ec',
          }}>
            <div onClick={() => setPicked(p.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: p.fuel.color + '22', color: p.fuel.color, display: 'grid', placeItems: 'center' }}><Icon name="fuel" size={16}/></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{p.fuel.name} · 6 dispensadores</div>
                </div>
                {p.isActive ? <Badge tone="success" dot size="sm">Activa</Badge> : <Badge tone="warning" size="sm">Mant.</Badge>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: '#d97706', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Configuración de bomba</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3, marginTop: 4 }}>{pump.name}</h2>
              <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                <TextField label="Nombre interno" value={pump.name} style={{ flex: 1 }}/>
                <TextField label="Combustible" value={pump.fuel.name} style={{ flex: 1 }}/>
                <TextField label="Caras" value="2" style={{ width: 90 }}/>
                <TextField label="Dispensadores/cara" value="3" style={{ width: 130 }}/>
              </div>
            </div>
            <div>
              <PumpDiagram pump={pump} compact/>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button style={{
                width: 40, height: 22, borderRadius: 999,
                background: pump.isActive ? '#16a34a' : '#cbd5e1', border: 0, position: 'relative', cursor: 'pointer',
              }}>
                <span style={{ position: 'absolute', top: 2, left: pump.isActive ? 20 : 2, width: 18, height: 18, borderRadius: 999, background: 'white', transition: 'left .15s' }}/>
              </button>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Bomba activa</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="danger" icon="trash" onClick={() => setConfirmDeactivate(true)}>Desactivar</Button>
              <Button variant="primary" icon="check" onClick={() => toast.success('Cambios guardados', `${pump.name} actualizada correctamente.`)}>Guardar cambios</Button>
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {pump.faces.map((face) => (
            <Card key={face.id} padding={0}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#0f1f3d', color: '#fbbf24', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{face.id}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Cara {face.id}</div>
                </div>
                <Button variant="ghost" icon="plus" size="sm" onClick={() => { setDispDraft({ name: `Dispensador ${face.dispensers.length + 1}`, sn: '', status: 'activo' }); setAddDispenserFace(face.id); }}>Dispensador</Button>
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {face.dispensers.map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: '#f8fafc', borderRadius: 9 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'white', boxShadow: '0 0 0 1px #e2e8f0', fontSize: 11, fontWeight: 800, color: '#0f1f3d', display: 'grid', placeItems: 'center' }}>D{d.name.slice(-1)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>SN-{d.id.toUpperCase()}</div>
                    </div>
                    {d.status === 'mantenimiento'
                      ? <Badge tone="warning" icon="wrench" size="sm">Mantenim.</Badge>
                      : <Badge tone="success" dot size="sm">Activo</Badge>}
                    <button onClick={() => { setDispDraft({ name: d.name, sn: `SN-${d.id.toUpperCase()}`, status: d.status }); setEditDispenser({ face: face.id, id: d.id }); }} style={{ width: 26, height: 26, borderRadius: 6, border: 0, background: 'white', boxShadow: '0 0 0 1px #e2e8f0', cursor: 'pointer', color: '#475569', display: 'grid', placeItems: 'center' }}><Icon name="edit" size={12}/></button>
                    <button onClick={() => setConfirmDelDisp({ face: face.id, id: d.id, name: d.name })} style={{ width: 26, height: 26, borderRadius: 6, border: 0, background: 'white', boxShadow: '0 0 0 1px #fecaca', cursor: 'pointer', color: '#dc2626', display: 'grid', placeItems: 'center' }}><Icon name="trash" size={12}/></button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* New Pump Modal */}
      <Modal open={newPumpOpen} onClose={() => setNewPumpOpen(false)}
        title="Agregar nueva bomba"
        subtitle="Por defecto se crearán 2 caras (A y B) con 3 dispensadores cada una."
        icon="fuel" iconTone="primary" width={520}
        footer={<>
          <Button variant="secondary" onClick={() => setNewPumpOpen(false)}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={() => {
            if (!pumpDraft.name.trim()) { toast.error('Falta el nombre', 'Ingresa un nombre para la bomba.'); return; }
            setNewPumpOpen(false);
            toast.success('Bomba creada', `${pumpDraft.name} agregada con 6 dispensadores.`);
          }}>Crear bomba</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TextField label="Nombre de la bomba" placeholder="Ej. Bomba 04" value={pumpDraft.name} onChange={(v) => setPumpDraft(s => ({ ...s, name: v }))} autoFocus/>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Tipo de combustible</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {FUELS.map(f => (
                <button key={f.id} onClick={() => setPumpDraft(s => ({ ...s, fuel: f.name }))} style={{
                  padding: 12, borderRadius: 10, fontFamily: 'inherit', cursor: 'pointer',
                  border: 0, background: pumpDraft.fuel === f.name ? f.color + '22' : '#f8fafc',
                  boxShadow: pumpDraft.fuel === f.name ? `0 0 0 2px ${f.color}` : '0 0 0 1px #e2e8f0',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: f.color, color: 'white', display: 'grid', placeItems: 'center' }}><Icon name="droplet" size={13}/></div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>L. {f.price.toFixed(2)}/L</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <TextField label="Caras" value="2" style={{ flex: 1 }}/>
            <TextField label="Dispensadores por cara" value="3" style={{ flex: 1 }}/>
          </div>
          <div style={{ background: '#dbeafe', borderRadius: 9, padding: 12, fontSize: 12, color: '#1e40af', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="info" size={14} style={{ marginTop: 1 }}/>
            <span>Después de crearla podrás añadir o quitar dispensadores y editar números de serie.</span>
          </div>
        </div>
      </Modal>

      {/* Edit Dispenser Modal */}
      <Modal open={!!editDispenser} onClose={() => setEditDispenser(null)}
        title="Editar dispensador"
        subtitle={editDispenser ? `${pump.name} · Cara ${editDispenser.face}` : ''}
        icon="edit" iconTone="info" width={460}
        footer={<>
          <Button variant="secondary" onClick={() => setEditDispenser(null)}>Cancelar</Button>
          <Button variant="primary" icon="check" onClick={() => {
            setEditDispenser(null);
            toast.success('Dispensador actualizado', `${dispDraft.name} guardado correctamente.`);
          }}>Guardar cambios</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TextField label="Nombre" value={dispDraft.name} onChange={(v) => setDispDraft(s => ({ ...s, name: v }))}/>
          <TextField label="Número de serie" value={dispDraft.sn} onChange={(v) => setDispDraft(s => ({ ...s, sn: v }))}/>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Estado del dispensador</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { v: 'activo', l: 'Activo', t: 'success', i: 'check' },
                { v: 'inactivo', l: 'Inactivo', t: 'neutral', i: 'minus' },
                { v: 'mantenimiento', l: 'Mantenim.', t: 'warning', i: 'wrench' },
              ].map(o => (
                <button key={o.v} onClick={() => setDispDraft(s => ({ ...s, status: o.v }))} style={{
                  padding: 10, borderRadius: 9, fontFamily: 'inherit', cursor: 'pointer',
                  border: 0, fontSize: 12, fontWeight: 700,
                  background: dispDraft.status === o.v
                    ? (o.v === 'activo' ? '#dcfce7' : o.v === 'mantenimiento' ? '#fef3c7' : '#f1f5f9')
                    : 'white',
                  color: dispDraft.status === o.v
                    ? (o.v === 'activo' ? '#166534' : o.v === 'mantenimiento' ? '#854d0e' : '#475569')
                    : '#94a3b8',
                  boxShadow: dispDraft.status === o.v ? 'none' : '0 0 0 1px #e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <Icon name={o.i} size={12}/>{o.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Add Dispenser Modal */}
      <Modal open={!!addDispenserFace} onClose={() => setAddDispenserFace(null)}
        title="Agregar dispensador"
        subtitle={addDispenserFace ? `${pump.name} · Cara ${addDispenserFace}` : ''}
        icon="plus" iconTone="success" width={460}
        footer={<>
          <Button variant="secondary" onClick={() => setAddDispenserFace(null)}>Cancelar</Button>
          <Button variant="primary" icon="plus" onClick={() => {
            setAddDispenserFace(null);
            toast.success('Dispensador agregado', `${dispDraft.name} disponible para registrar lecturas.`);
          }}>Agregar</Button>
        </>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TextField label="Nombre del dispensador" value={dispDraft.name} onChange={(v) => setDispDraft(s => ({ ...s, name: v }))} autoFocus/>
          <TextField label="Número de serie" placeholder="SN-XXXX" value={dispDraft.sn} onChange={(v) => setDispDraft(s => ({ ...s, sn: v }))}/>
        </div>
      </Modal>

      {/* Confirm deactivate pump */}
      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        title={`¿Desactivar ${pump.name}?`}
        message="Los dispensadores de esta bomba dejarán de aparecer en los registros de lectura. Podrás reactivarla más tarde."
        confirmLabel="Sí, desactivar"
        cancelLabel="Mantener activa"
        icon="alert" tone="danger"
        onConfirm={() => toast.warning(`${pump.name} desactivada`, 'Ya no aparecerá en las lecturas diarias.')}
      />

      {/* Confirm delete dispenser */}
      <ConfirmDialog
        open={!!confirmDelDisp}
        onClose={() => setConfirmDelDisp(null)}
        title={confirmDelDisp ? `¿Eliminar ${confirmDelDisp.name}?` : ''}
        message="Se perderá su histórico de lecturas. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        icon="trash" tone="danger"
        onConfirm={() => toast.error('Dispensador eliminado', `${confirmDelDisp?.name} fue removido permanentemente.`)}
      />
    </div>
  );
}

// ─── Auditoría ─────────────────────────────────────────────────────────────
function AuditoriaScreen() {
  const tones = { 'Operador': 'accent', 'Admin': 'info', 'Supervisor': 'success' };
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Auditoría</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', letterSpacing: -0.2 }}>Historial completo · 26 abr 2026</div>
          </div>
          <select style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>
            <option>Todos los usuarios</option>
            {USERS.map(u => <option key={u.id}>{u.name}</option>)}
          </select>
          <select style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>
            <option>Todas las acciones</option>
            <option>Lectura inicial</option>
            <option>Lectura final</option>
            <option>Edición</option>
            <option>Cierre del día</option>
          </select>
          <Button variant="secondary" icon="download" size="sm">Exportar</Button>
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {AUDIT_LOG.map((a, i) => {
            const u = USERS.find(u => u.name === a.user) || USERS[0];
            return (
              <div key={a.id} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr 200px 140px 80px',
                gap: 14, padding: '14px 18px', alignItems: 'center',
                borderTop: i ? '1px solid #f1f5f9' : 0,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f1f5f9', color: '#0f1f3d', display: 'grid', placeItems: 'center' }}>
                  <Icon name={a.icon} size={16}/>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                    {a.action} · <span style={{ color: '#475569', fontWeight: 600 }}>{a.target}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3, fontFamily: 'ui-monospace, monospace' }}>{a.detail}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={u.name} initials={u.initials} color={u.color} size={28}/>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{u.name}</div>
                    <Badge tone={tones[a.role]} size="sm">{a.role}</Badge>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', fontFamily: 'ui-monospace, monospace' }}>{a.date}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'ui-monospace, monospace', textAlign: 'right' }}>{a.t}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, {
  LecturaInicialScreen, LecturaFinalScreen, ReporteDiarioScreen,
  ReporteMensualScreen, PreciosScreen, BombasScreen, AuditoriaScreen,
});
