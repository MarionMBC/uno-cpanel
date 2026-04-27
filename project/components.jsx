// components.jsx — shared primitives

// ─── Icons (inline SVG, stroke-based, 1.5px) ─────────────────────────────────
const Icon = ({ name, size = 18, className = '', style }) => {
  const s = size;
  const props = {
    width: s, height: s, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
    className, style,
  };
  const paths = {
    'gauge': <><path d="M12 14l4-4"/><circle cx="12" cy="14" r="8"/><path d="M12 6V4M5.5 7.5l-1.4-1.4M18.5 7.5l1.4-1.4"/></>,
    'home': <><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></>,
    'log-in': <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></>,
    'log-out': <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></>,
    'file': <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></>,
    'calendar': <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
    'tag': <><path d="M20.59 13.41 12 22l-9-9V3h10z"/><circle cx="7.5" cy="7.5" r="1.2"/></>,
    'settings': <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    'shield': <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    'lock': <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    'unlock': <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></>,
    'plus': <><path d="M12 5v14M5 12h14"/></>,
    'minus': <><path d="M5 12h14"/></>,
    'check': <><path d="M20 6 9 17l-5-5"/></>,
    'x': <><path d="M18 6 6 18M6 6l12 12"/></>,
    'chevron-right': <><path d="M9 6l6 6-6 6"/></>,
    'chevron-down': <><path d="M6 9l6 6 6-6"/></>,
    'chevron-up': <><path d="M6 15l6-6 6 6"/></>,
    'arrow-right': <><path d="M5 12h14M13 5l7 7-7 7"/></>,
    'arrow-up': <><path d="M12 19V5M5 12l7-7 7 7"/></>,
    'arrow-down': <><path d="M12 5v14M5 12l7 7 7-7"/></>,
    'download': <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></>,
    'upload': <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></>,
    'edit': <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4z"/></>,
    'trash': <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>,
    'wrench': <><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5z"/></>,
    'alert': <><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>,
    'info': <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
    'search': <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    'bell': <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
    'sun': <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>,
    'moon': <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
    'user': <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    'users': <><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4.5a4 4 0 0 1 0 7.5M22 21a6.5 6.5 0 0 0-5-6.3"/></>,
    'fuel': <><path d="M3 22V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v18"/><path d="M3 22h12"/><path d="M14 9h2.5a1.5 1.5 0 0 1 1.5 1.5V17a2 2 0 0 0 4 0V8l-3-3"/><path d="M5 7h6"/></>,
    'droplet': <><path d="M12 2.5s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/></>,
    'trend-up': <><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></>,
    'list': <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
    'menu': <><path d="M3 6h18M3 12h18M3 18h18"/></>,
    'grid': <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    'history': <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></>,
    'eye': <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
    'sparkle': <><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.5 5.5l4 4M14.5 14.5l4 4M5.5 18.5l4-4M14.5 9.5l4-4"/></>,
    'building': <><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/></>,
  };
  return <svg {...props}>{paths[name] || <circle cx="12" cy="12" r="9"/>}</svg>;
};

// ─── Badge ─────────────────────────────────────────────────────────────────
const Badge = ({ tone = 'neutral', size = 'sm', children, dot, icon }) => {
  const tones = {
    neutral: { bg: '#eef0f3', fg: '#475569', dot: '#94a3b8' },
    success: { bg: '#dcfce7', fg: '#166534', dot: '#22c55e' },
    warning: { bg: '#fef3c7', fg: '#854d0e', dot: '#f59e0b' },
    danger: { bg: '#fee2e2', fg: '#991b1b', dot: '#ef4444' },
    info: { bg: '#dbeafe', fg: '#1e40af', dot: '#3b82f6' },
    accent: { bg: '#fff4d6', fg: '#7c4a03', dot: '#d97706' },
    primary: { bg: '#e0e7ff', fg: '#312e81', dot: '#4f46e5' },
  };
  const t = tones[tone] || tones.neutral;
  const pad = size === 'lg' ? '5px 10px' : '2px 8px';
  const fs = size === 'lg' ? 12 : 11;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: t.bg, color: t.fg, padding: pad, borderRadius: 999,
      fontSize: fs, fontWeight: 600, letterSpacing: 0.1, lineHeight: 1.3,
      whiteSpace: 'nowrap',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: t.dot }} />}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
};

// ─── Button ────────────────────────────────────────────────────────────────
const Button = ({ variant = 'primary', size = 'md', icon, iconRight, children, onClick, disabled, type = 'button', style = {}, full }) => {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    border: 0, fontFamily: 'inherit', fontWeight: 600, letterSpacing: 0.1,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    borderRadius: 10, transition: 'transform .08s, box-shadow .15s, background .15s',
    width: full ? '100%' : 'auto',
  };
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 12, height: 30 },
    md: { padding: '9px 16px', fontSize: 13, height: 38 },
    lg: { padding: '12px 20px', fontSize: 14, height: 46 },
  };
  const variants = {
    primary: { background: '#0f1f3d', color: 'white', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 1px 2px rgba(15,31,61,.25)' },
    accent: { background: '#d97706', color: 'white', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), 0 1px 2px rgba(217,119,6,.3)' },
    secondary: { background: 'white', color: '#0f1f3d', boxShadow: 'inset 0 0 0 1px #e2e8f0' },
    ghost: { background: 'transparent', color: '#475569' },
    success: { background: '#16a34a', color: 'white' },
    danger: { background: 'white', color: '#b91c1c', boxShadow: 'inset 0 0 0 1px #fecaca' },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  );
};

// ─── Card ──────────────────────────────────────────────────────────────────
const Card = ({ children, padding = 20, style = {}, hoverable }) => (
  <div className={hoverable ? 'card hov' : 'card'} style={{
    background: 'white', borderRadius: 14,
    boxShadow: '0 0 0 1px #e6e8ec, 0 1px 2px rgba(15,23,42,.04)',
    padding, ...style,
  }}>{children}</div>
);

// ─── StatCard ──────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon, tone = 'neutral', trend }) => {
  const accents = {
    primary: { bg: '#0f1f3d', fg: 'white', iconBg: 'rgba(255,255,255,.12)', iconFg: '#fbbf24' },
    accent: { bg: '#fff4d6', fg: '#0f1f3d', iconBg: '#fde68a', iconFg: '#92400e' },
    neutral: { bg: 'white', fg: '#0f172a', iconBg: '#f1f5f9', iconFg: '#0f1f3d' },
    success: { bg: 'white', fg: '#0f172a', iconBg: '#dcfce7', iconFg: '#16a34a' },
  };
  const a = accents[tone];
  return (
    <Card padding={0} style={{ background: a.bg, overflow: 'hidden' }}>
      <div style={{ padding: 18, color: a.fg }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', opacity: .7 }}>{label}</span>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: a.iconBg, color: a.iconFg, display: 'grid', placeItems: 'center' }}>
            <Icon name={icon} size={16}/>
          </div>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5, lineHeight: 1.1 }}>{value}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, opacity: .75 }}>
          {trend != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: trend >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
              <Icon name={trend >= 0 ? 'arrow-up' : 'arrow-down'} size={12}/> {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          <span>{sub}</span>
        </div>
      </div>
    </Card>
  );
};

// ─── Sparkline ─────────────────────────────────────────────────────────────
const Sparkline = ({ data, height = 40, width = 120, color = '#0f1f3d', fill = 'rgba(15,31,61,.08)' }) => {
  if (!data || !data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 4) - 2]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = d + ` L${width} ${height} L0 ${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={area} fill={fill}/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.5" fill={color}/>
    </svg>
  );
};

// ─── Avatar ────────────────────────────────────────────────────────────────
const Avatar = ({ name, initials, size = 32, color = '#0f1f3d' }) => {
  const init = initials || (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, background: color, color: 'white',
      display: 'grid', placeItems: 'center', fontSize: size * 0.38, fontWeight: 700,
      letterSpacing: 0.4, flexShrink: 0,
    }}>{init}</div>
  );
};

// ─── Status badge for day status ───────────────────────────────────────────
const DayStatusBadge = ({ status }) => {
  const map = {
    pendiente: { tone: 'neutral', label: 'Pendiente', icon: 'history' },
    en_proceso: { tone: 'warning', label: 'En proceso', icon: 'gauge' },
    cerrado: { tone: 'success', label: 'Cerrado', icon: 'lock' },
    incompleto: { tone: 'danger', label: 'Incompleto', icon: 'alert' },
  };
  const m = map[status] || map.pendiente;
  return <Badge tone={m.tone} icon={m.icon} size="lg" dot>{m.label}</Badge>;
};

// ─── Inputs ────────────────────────────────────────────────────────────────
const TextField = ({ label, value, onChange, placeholder, type = 'text', suffix, prefix, error, hint, autoFocus, disabled, style = {} }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
    {label && <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{label}</span>}
    <div style={{
      display: 'flex', alignItems: 'center',
      background: disabled ? '#f8fafc' : 'white',
      border: `1px solid ${error ? '#ef4444' : '#e2e8f0'}`,
      borderRadius: 10, padding: '0 12px', height: 42,
      transition: 'border-color .15s, box-shadow .15s',
    }}>
      {prefix && <span style={{ color: '#64748b', fontSize: 13, marginRight: 8, fontWeight: 500 }}>{prefix}</span>}
      <input
        type={type}
        value={value ?? ''}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        style={{
          flex: 1, border: 0, outline: 'none', background: 'transparent',
          fontSize: 14, fontFamily: 'inherit', color: '#0f172a',
          fontVariantNumeric: type === 'number' ? 'tabular-nums' : undefined,
        }}
      />
      {suffix && <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8, fontWeight: 500 }}>{suffix}</span>}
    </div>
    {hint && !error && <span style={{ fontSize: 11, color: '#64748b' }}>{hint}</span>}
    {error && <span style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="alert" size={12}/> {error}</span>}
  </label>
);

// ─── Empty / placeholder for graphics ──────────────────────────────────────
const Striped = ({ width = '100%', height = 60, label, style = {} }) => (
  <div style={{
    width, height, borderRadius: 10,
    background: 'repeating-linear-gradient(45deg, #f1f5f9 0 8px, #e2e8f0 8px 16px)',
    display: 'grid', placeItems: 'center', color: '#64748b',
    fontFamily: 'ui-monospace, monospace', fontSize: 11,
    ...style,
  }}>{label}</div>
);

// ─── PumpDiagram (visual pump w/ faces & dispensers) ───────────────────────
const PumpDiagram = ({ pump, activeFace, activeDisp, onPick, compact }) => {
  const w = compact ? 220 : 300;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={w} height={compact ? 200 : 260} viewBox="0 0 200 240">
        {/* base */}
        <rect x="20" y="200" width="160" height="20" rx="4" fill="#1e293b"/>
        {/* body */}
        <rect x="40" y="40" width="120" height="170" rx="10" fill="#0f1f3d" stroke="#1e293b"/>
        <rect x="46" y="46" width="108" height="40" rx="4" fill="#fbbf24"/>
        <text x="100" y="72" fontSize="14" fontWeight="800" textAnchor="middle" fill="#0f1f3d" fontFamily="system-ui">
          {pump.fuel.name.toUpperCase()}
        </text>
        {/* screen */}
        <rect x="46" y="92" width="108" height="34" rx="3" fill="#0a0f1c" stroke="#fbbf24" strokeOpacity=".3"/>
        <text x="100" y="113" fontSize="11" textAnchor="middle" fill="#fbbf24" fontFamily="ui-monospace, monospace" fontWeight="600">
          L. {pump.fuel.price.toFixed(2)}
        </text>
        {/* face A nozzle (left) */}
        <g style={{ cursor: 'pointer' }} onClick={() => onPick && onPick('A')} opacity={activeFace === 'B' ? 0.4 : 1}>
          <line x1="40" y1="140" x2="20" y2="140" stroke="#94a3b8" strokeWidth="3"/>
          <rect x="6" y="132" width="18" height="18" rx="3" fill={activeFace === 'A' ? '#d97706' : '#475569'}/>
          <text x="15" y="145" fontSize="11" fontWeight="700" textAnchor="middle" fill="white">A</text>
        </g>
        {/* face B nozzle (right) */}
        <g style={{ cursor: 'pointer' }} onClick={() => onPick && onPick('B')} opacity={activeFace === 'A' ? 0.4 : 1}>
          <line x1="160" y1="140" x2="180" y2="140" stroke="#94a3b8" strokeWidth="3"/>
          <rect x="176" y="132" width="18" height="18" rx="3" fill={activeFace === 'B' ? '#d97706' : '#475569'}/>
          <text x="185" y="145" fontSize="11" fontWeight="700" textAnchor="middle" fill="white">B</text>
        </g>
        {/* dispenser dots */}
        {[1,2,3].map((d, i) => (
          <circle key={d} cx={62 + i * 38} cy={170} r="6"
            fill={activeDisp === d ? '#fbbf24' : '#334155'}
            stroke={activeDisp === d ? '#fff' : 'none'} strokeWidth="2"/>
        ))}
        <text x="100" y="195" fontSize="9" textAnchor="middle" fill="#94a3b8" fontFamily="ui-monospace, monospace" letterSpacing="2">
          D1   D2   D3
        </text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#0f1f3d', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {pump.name}
      </div>
    </div>
  );
};

Object.assign(window, {
  Icon, Badge, Button, Card, StatCard, Sparkline, Avatar, DayStatusBadge,
  TextField, Striped, PumpDiagram,
});
