// app.jsx — main app, routing, providers

const { useState: useAppState, useEffect: useAppEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "role": "Operador",
  "dayStatus": "en_proceso",
  "darkSidebar": true,
  "accent": "#d97706",
  "showFrame": true,
  "screen": "dashboard",
  "loggedIn": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useAppState(t.screen || 'dashboard');
  const [loggedIn, setLoggedIn] = useAppState(t.loggedIn !== false);
  const [pumps] = useAppState(PUMPS);
  const [userIdx, setUserIdx] = useAppState(0);

  useAppEffect(() => { setRoute(t.screen); }, [t.screen]);
  useAppEffect(() => { setLoggedIn(t.loggedIn); }, [t.loggedIn]);

  const user = USERS.find(u => u.role === t.role) || USERS[0];

  const handleSetRoute = (r) => {
    setRoute(r);
    setTweak('screen', r);
  };

  const cycleUser = () => {
    const next = (USERS.findIndex(u => u.role === t.role) + 1) % USERS.length;
    setTweak('role', USERS[next].role);
  };

  let content;
  if (!loggedIn) {
    content = <LoginScreen onLogin={() => setTweak('loggedIn', true)}/>;
  } else {
    let screen;
    switch (route) {
      case 'dashboard': screen = <DashboardScreen setRoute={handleSetRoute} dayStatus={t.dayStatus} user={user} pumps={pumps}/>; break;
      case 'lectura-inicial': screen = <LecturaInicialScreen pumps={pumps} dayStatus={t.dayStatus}/>; break;
      case 'lectura-final': screen = <LecturaFinalScreen pumps={pumps} dayStatus={t.dayStatus} onClose={() => setTweak('dayStatus', 'cerrado')}/>; break;
      case 'reporte-diario': screen = <ReporteDiarioScreen pumps={pumps}/>; break;
      case 'reporte-mensual': screen = <ReporteMensualScreen pumps={pumps}/>; break;
      case 'precios': screen = <PreciosScreen pumps={pumps}/>; break;
      case 'bombas': screen = <BombasScreen pumps={pumps}/>; break;
      case 'auditoria': screen = <AuditoriaScreen/>; break;
      default: screen = <DashboardScreen setRoute={handleSetRoute} dayStatus={t.dayStatus} user={user} pumps={pumps}/>;
    }
    content = (
      <div style={{ display: 'grid', gridTemplateColumns: '248px 1fr', height: '100%' }}>
        <Sidebar route={route} setRoute={handleSetRoute} station="Guaimaca Centro" dayStatus={t.dayStatus}/>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f4f6f9' }}>
          <Topbar user={user} route={route} onSwitchUser={cycleUser} onLogout={() => setTweak('loggedIn', false)}/>
          <div style={{ flex: 1, overflowY: 'auto' }} data-screen-label={`route ${route}`}>
            {screen}
          </div>
        </div>
      </div>
    );
  }

  // Tablet frame
  const frame = t.showFrame ? (
    <div style={{
      width: 1280, height: 900,
      background: '#0a1530', borderRadius: 28, padding: 16,
      boxShadow: '0 30px 80px rgba(15,23,42,.35), 0 0 0 1px #1e293b',
      position: 'relative',
    }}>
      <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: 999, background: '#1e293b' }}/>
      <div style={{
        width: '100%', height: '100%', borderRadius: 18, overflow: 'hidden',
        background: '#f4f6f9', position: 'relative',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.2)',
      }}>
        {content}
      </div>
    </div>
  ) : (
    <div style={{ width: '100vw', height: '100vh', background: '#f4f6f9', overflow: 'hidden' }}>{content}</div>
  );

  return (
    <>
      <ToastProvider>{frame}</ToastProvider>
      <TweaksPanel title="Tweaks">
        <TweakSection label="Aplicación"/>
        <TweakSelect label="Pantalla" value={route} options={[
          { value: 'dashboard', label: 'Dashboard' },
          { value: 'lectura-inicial', label: 'Lectura inicial' },
          { value: 'lectura-final', label: 'Lectura final' },
          { value: 'reporte-diario', label: 'Reporte diario' },
          { value: 'reporte-mensual', label: 'Reporte mensual' },
          { value: 'precios', label: 'Precios' },
          { value: 'bombas', label: 'Configuración bombas' },
          { value: 'auditoria', label: 'Auditoría' },
        ]} onChange={(v) => setTweak('screen', v)}/>
        <TweakToggle label="Sesión iniciada" value={t.loggedIn} onChange={(v) => setTweak('loggedIn', v)}/>
        <TweakSection label="Rol del usuario"/>
        <TweakRadio label="Rol activo" value={t.role}
          options={['Operador', 'Admin', 'Supervisor']}
          onChange={(v) => setTweak('role', v)}/>
        <TweakSection label="Estado del día"/>
        <TweakRadio label="Día" value={t.dayStatus}
          options={[
            { value: 'pendiente', label: 'Pendiente' },
            { value: 'en_proceso', label: 'En proceso' },
            { value: 'cerrado', label: 'Cerrado' },
          ]}
          onChange={(v) => setTweak('dayStatus', v)}/>
        <TweakSection label="Presentación"/>
        <TweakToggle label="Marco de tablet" value={t.showFrame} onChange={(v) => setTweak('showFrame', v)}/>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
