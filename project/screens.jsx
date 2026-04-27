// screens.jsx — all screen components

const { useState, useMemo, useEffect } = React;

// ─── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ route, setRoute, station, dayStatus }) {
  const items = [
    { key: 'dashboard', label: 'Dashboard', icon: 'home' },
    { key: 'lectura-inicial', label: 'Lectura inicial', icon: 'log-in' },
    { key: 'lectura-final', label: 'Lectura final', icon: 'log-out' },
    { key: 'reporte-diario', label: 'Reporte diario', icon: 'file' },
    { key: 'reporte-mensual', label: 'Reporte mensual', icon: 'calendar' },
    { key: 'precios', label: 'Precio del combustible', icon: 'tag' },
    { key: 'bombas', label: 'Configuración bombas', icon: 'fuel' },
    { key: 'auditoria', label: 'Auditoría', icon: 'shield' },
  ];
  return (
    <aside style={{
      width: 248, background: '#0a1530', color: '#cbd5e1',
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid rgba(255,255,255,.06)',
    }}>
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: '#fbbf24', display: 'grid', placeItems: 'center' }}>
            <Icon name="fuel" size={20} style={{ color: '#0a1530' }}/>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'white', lineHeight: 1.1 }}>Combustibles</div>
            <div style={{ fontSize: 10.5, color: '#94a3b8', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 2 }}>{station}</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((it) => {
          const active = route === it.key;
          return (
            <button key={it.key} onClick={() => setRoute(it.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8, border: 0, cursor: 'pointer',
                background: active ? 'rgba(251,191,36,.12)' : 'transparent',
                color: active ? '#fbbf24' : '#cbd5e1',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit', letterSpacing: 0.1,
                textAlign: 'left', position: 'relative',
              }}>
              {active && <span style={{ position: 'absolute', left: -10, top: 8, bottom: 8, width: 3, borderRadius: 2, background: '#fbbf24' }}/>}
              <Icon name={it.icon} size={16}/>
              <span>{it.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ padding: 14, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{
          background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: 12,
          border: '1px solid rgba(255,255,255,.06)',
        }}>
          <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Estado del día</div>
          <DayStatusBadge status={dayStatus}/>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, fontFamily: 'ui-monospace, monospace' }}>
            26 abr 2026 · {new Date().toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Topbar ─────────────────────────────────────────────────────────────────
function Topbar({ user, route, onSwitchUser, onLogout }) {
  const titles = {
    'dashboard': 'Dashboard',
    'lectura-inicial': 'Registro de lectura inicial',
    'lectura-final': 'Registro de lectura final',
    'reporte-diario': 'Reporte diario',
    'reporte-mensual': 'Reporte mensual',
    'precios': 'Precio del combustible',
    'bombas': 'Configuración de bombas',
    'auditoria': 'Auditoría y control',
  };
  return (
    <header style={{
      height: 64, background: 'white', borderBottom: '1px solid #e6e8ec',
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: '#64748b', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>
          UNO Guaimaca Centro
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', letterSpacing: -0.2 }}>
          {titles[route] || 'Panel'}
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        background: '#f8fafc', borderRadius: 10, padding: '6px 12px',
        border: '1px solid #e2e8f0',
      }}>
        <Icon name="search" size={14} style={{ color: '#94a3b8' }}/>
        <input placeholder="Buscar bomba, dispensador…" style={{
          border: 0, background: 'transparent', outline: 'none',
          fontSize: 12, fontFamily: 'inherit', width: 160, color: '#334155',
        }}/>
        <kbd style={{ fontSize: 10, color: '#94a3b8', background: 'white', padding: '2px 6px', borderRadius: 4, border: '1px solid #e2e8f0', fontFamily: 'ui-monospace, monospace' }}>⌘K</kbd>
      </div>

      <button title="Notificaciones" style={{
        position: 'relative', width: 38, height: 38, borderRadius: 9,
        background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer',
        display: 'grid', placeItems: 'center', color: '#475569',
      }}>
        <Icon name="bell" size={16}/>
        <span style={{ position: 'absolute', top: 8, right: 8, width: 6, height: 6, background: '#ef4444', borderRadius: 999 }}/>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12, borderLeft: '1px solid #e2e8f0', flexShrink: 0 }}>
        <Avatar name={user.name} initials={user.initials} color={user.color} size={36}/>
        <div style={{ lineHeight: 1.15, whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{user.name}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{user.role}</div>
        </div>
        <button onClick={onSwitchUser} title="Cambiar de usuario" style={{
          width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0',
          background: 'white', cursor: 'pointer', color: '#64748b',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <Icon name="users" size={14}/>
        </button>
      </div>
    </header>
  );
}

// ─── Login ──────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr',
      background: 'white',
    }}>
      {/* Left brand panel */}
      <div style={{
        background: 'linear-gradient(140deg, #0a1530 0%, #14275a 60%, #0f1f3d 100%)',
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 48,
        color: 'white',
      }}>
        {/* decorative diagonals */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08 }}>
          <defs>
            <pattern id="diag" patternUnits="userSpaceOnUse" width="20" height="20" patternTransform="rotate(35)">
              <line x1="0" y="0" x2="0" y2="20" stroke="#fbbf24" strokeWidth="1.2"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diag)"/>
        </svg>
        {/* fuel-drop shape */}
        <svg style={{ position: 'absolute', right: -80, bottom: -80, opacity: 0.15 }} width="500" height="500" viewBox="0 0 100 100">
          <path d="M50 5 C 60 25, 85 45, 85 65 A 35 35 0 0 1 15 65 C 15 45, 40 25, 50 5 Z" fill="#fbbf24"/>
        </svg>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: '#fbbf24', display: 'grid', placeItems: 'center' }}>
            <Icon name="fuel" size={22} style={{ color: '#0a1530' }}/>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.2 }}>Panel de Combustibles</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Sistema de control y reportes</div>
          </div>
        </div>

        <div style={{ position: 'relative', maxWidth: 380 }}>
          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.6, marginBottom: 14 }}>
            Lecturas, ventas y reportes en un solo lugar.
          </div>
          <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.55 }}>
            Registra lecturas iniciales y finales, calcula ventas en litros, galones y lempiras, y exporta reportes profesionales para tu estación.
          </div>
          <div style={{ display: 'flex', gap: 28, marginTop: 36 }}>
            {[
              { v: '3', l: 'Bombas activas' },
              { v: '18', l: 'Dispensadores' },
              { v: '24/7', l: 'Auditoría' },
            ].map((s) => (
              <div key={s.l}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#fbbf24', letterSpacing: -0.5 }}>{s.v}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
          <span>v2.4.1 · Estación Guaimaca Centro</span>
          <span>© 2026 Operaciones Combustibles</span>
        </div>
      </div>

      {/* Right form */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', letterSpacing: 1, textTransform: 'uppercase' }}>Iniciar sesión</div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', letterSpacing: -0.6, marginTop: 6, marginBottom: 8 }}>
            Bienvenido de vuelta
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 28, lineHeight: 1.5 }}>
            Continúa con tu cuenta corporativa de Google para acceder al panel.
          </p>

          <button onClick={onLogin} style={{
            width: '100%', height: 50, border: '1px solid #e2e8f0', borderRadius: 11,
            background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 12, fontFamily: 'inherit', fontSize: 14,
            fontWeight: 600, color: '#0f172a',
            boxShadow: '0 1px 2px rgba(15,23,42,.04)',
          }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.6 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.4-4.6 2.3-7.6 2.3-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.5 5.5C40.1 36 44 31 44 24c0-1.3-.1-2.4-.4-3.5z"/>
            </svg>
            Continuar con Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0', color: '#94a3b8', fontSize: 11, letterSpacing: 0.5 }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
            <span>O CON CORREO</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TextField label="Correo corporativo" placeholder="usuario@unoguaimaca.hn" value="marlon@unoguaimaca.hn"/>
            <TextField label="Contraseña" type="password" placeholder="••••••••" value="opcional123"/>
            <Button variant="primary" size="lg" onClick={onLogin} full>Iniciar sesión</Button>
          </div>

          <div style={{ marginTop: 22, fontSize: 12, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
            <a href="#" style={{ color: '#0f1f3d', fontWeight: 600 }}>¿Olvidaste tu contraseña?</a>
            <span>¿Necesitas ayuda? <a href="#" style={{ color: '#d97706', fontWeight: 600 }}>Soporte</a></span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
function DashboardScreen({ setRoute, dayStatus, user, pumps }) {
  const totals = {
    lempiras: 287_412.55, liters: 2842.18, gallons: 750.97,
  };
  const trendL = TREND_14D.map(d => d.liters);
  const trendM = TREND_14D.map(d => d.lempiras);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Greeting */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: '#d97706', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            Lunes · 26 de abril, 2026
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', letterSpacing: -0.4, marginTop: 4 }}>
            Buenos días, {user.name.split(' ')[0]}.
          </h2>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Tienes <b style={{ color: '#d97706' }}>3 lecturas finales pendientes</b> antes de cerrar el día.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" icon="download">Exportar Excel</Button>
          <Button variant="primary" icon="log-out" onClick={() => setRoute('lectura-final')}>Registrar lectura final</Button>
        </div>
      </div>

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <StatCard tone="primary" label="Vendido hoy" icon="fuel" value={fmtL(totals.lempiras)} sub="vs. ayer" trend={6.2}/>
        <StatCard tone="neutral" label="Litros vendidos" icon="droplet" value={fmtNum(totals.liters, 2)} sub="L · hoy" trend={4.8}/>
        <StatCard tone="neutral" label="Galones vendidos" icon="droplet" value={fmtNum(totals.gallons, 2)} sub="gal · hoy" trend={4.8}/>
        <StatCard tone="accent" label="Bombas activas" icon="gauge" value="2 / 3" sub="1 en mantenimiento"/>
      </div>

      {/* Trend + quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Ventas · últimos 14 días</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.3, marginTop: 4 }}>
                {fmtL(trendM.reduce((a,b)=>a+b,0))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge tone="success" dot>Lempiras</Badge>
              <Badge tone="neutral" dot>Litros</Badge>
            </div>
          </div>
          {/* Bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, marginTop: 12 }}>
            {TREND_14D.map((d, i) => {
              const maxV = Math.max(...trendM);
              const h = (d.lempiras / maxV) * 100;
              const isToday = i === TREND_14D.length - 1;
              return (
                <div key={i} style={{ flex: 1, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                  <div style={{
                    width: '100%', height: `${h}%`,
                    background: isToday ? '#d97706' : '#0f1f3d',
                    borderRadius: '4px 4px 0 0',
                    opacity: isToday ? 1 : 0.85,
                  }}/>
                  <span style={{ fontSize: 9.5, color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>
                    {String(26 - (TREND_14D.length - 1 - i)).padStart(2,'0')}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, marginBottom: 12 }}>Accesos rápidos</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { l: 'Lectura inicial', i: 'log-in', r: 'lectura-inicial', c: '#16a34a' },
              { l: 'Lectura final', i: 'log-out', r: 'lectura-final', c: '#d97706' },
              { l: 'Reporte diario', i: 'file', r: 'reporte-diario', c: '#0f1f3d' },
              { l: 'Configurar precios', i: 'tag', r: 'precios', c: '#3b82f6' },
              { l: 'Configurar bombas', i: 'fuel', r: 'bombas', c: '#475569' },
              { l: 'Auditoría', i: 'shield', r: 'auditoria', c: '#475569' },
            ].map((a) => (
              <button key={a.l} onClick={() => setRoute(a.r)} style={{
                background: '#f8fafc', border: '1px solid #e6e8ec', borderRadius: 10,
                padding: '12px 10px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'inherit',
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'white', boxShadow: '0 0 0 1px #e6e8ec', display: 'grid', placeItems: 'center', color: a.c }}>
                  <Icon name={a.i} size={14}/>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{a.l}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Pump status row */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: -0.2 }}>Estado de bombas</h3>
          <button onClick={() => setRoute('bombas')} style={{ background: 'transparent', border: 0, color: '#0f1f3d', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
            Ver todas <Icon name="chevron-right" size={12}/>
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {pumps.map((p) => {
            const allRows = [];
            p.faces.forEach(f => f.dispensers.forEach(d => allRows.push(d)));
            const liters = allRows.reduce((s, r) => s + (r.liters || 0), 0);
            const lemp = liters * p.fuel.price;
            const completed = allRows.filter(r => r.final > 0).length;
            return (
              <Card key={p.id} hoverable>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: p.fuel.color + '22', color: p.fuel.color, display: 'grid', placeItems: 'center' }}>
                      <Icon name="fuel" size={18}/>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{p.fuel.name} · L. {p.fuel.price.toFixed(2)}/L</div>
                    </div>
                  </div>
                  {p.isActive
                    ? <Badge tone="success" dot>Activa</Badge>
                    : <Badge tone="warning" icon="wrench">Mantenim.</Badge>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>Vendido hoy</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtL(lemp)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: 600 }}>Litros</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtNum(liters, 1)}</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, padding: 10, background: '#f8fafc', borderRadius: 8, fontSize: 11, color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Dispensadores completos</span>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{completed} / {allRows.length}</span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Latest activity */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: -0.2 }}>Actividad reciente</h3>
          <button onClick={() => setRoute('auditoria')} style={{ background: 'transparent', border: 0, color: '#0f1f3d', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Ver auditoría →
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {AUDIT_LOG.slice(0, 5).map((a, i) => (
            <div key={a.id} style={{
              display: 'grid', gridTemplateColumns: '40px 1fr auto auto', gap: 12,
              padding: '12px 4px', alignItems: 'center',
              borderTop: i ? '1px solid #f1f5f9' : 0,
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f1f5f9', color: '#0f1f3d', display: 'grid', placeItems: 'center' }}>
                <Icon name={a.icon} size={14}/>
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{a.action} · <span style={{ color: '#475569', fontWeight: 500 }}>{a.target}</span></div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{a.detail}</div>
              </div>
              <div style={{ fontSize: 11.5, color: '#475569' }}>{a.user}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>{a.t}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, LoginScreen, DashboardScreen });
