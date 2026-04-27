'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';

export default function LoginScreen() {
  const { signInWithGoogle, signInWithEmail, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError(authError || e.message || 'Error al iniciar sesión con Google');
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async () => {
    if (!email || !password) { setError('Ingresa correo y contraseña'); return; }
    setLoading(true);
    setError('');
    try {
      await signInWithEmail(email, password);
    } catch (e: any) {
      setError('Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-grid">
      {/* Left brand panel */}
      <div style={{
        background: 'linear-gradient(140deg, #0a1530 0%, #14275a 60%, #0f1f3d 100%)',
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 48,
        color: 'white',
      }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08 }}>
          <defs>
            <pattern id="diag" patternUnits="userSpaceOnUse" width="20" height="20" patternTransform="rotate(35)">
              <line x1="0" y="0" x2="0" y2="20" stroke="#fbbf24" strokeWidth="1.2"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diag)"/>
        </svg>
        <svg style={{ position: 'absolute', right: -80, bottom: -80, opacity: 0.15 }} width="500" height="500" viewBox="0 0 100 100">
          <path d="M50 5 C 60 25, 85 45, 85 65 A 35 35 0 0 1 15 65 C 15 45, 40 25, 50 5 Z" fill="#fbbf24"/>
        </svg>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: '#fbbf24', display: 'grid', placeItems: 'center' }}>
            <Icon name="fuel" size={22} style={{ color: '#0a1530' }} />
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

          <button
            onClick={handleGoogle}
            disabled={loading}
            style={{
              width: '100%', height: 50, border: '1px solid #e2e8f0', borderRadius: 11,
              background: 'white', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 12, fontFamily: 'inherit', fontSize: 14,
              fontWeight: 600, color: '#0f172a',
              boxShadow: '0 1px 2px rgba(15,23,42,.04)',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.6 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.5 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.4-4.6 2.3-7.6 2.3-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.5 5.5C40.1 36 44 31 44 24c0-1.3-.1-2.4-.4-3.5z"/>
            </svg>
            {loading ? 'Iniciando sesión…' : 'Continuar con Google'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0', color: '#94a3b8', fontSize: 11, letterSpacing: 0.5 }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
            <span>O CON CORREO</span>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }}/>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TextField label="Correo corporativo" placeholder="usuario@unoguaimaca.hn" value={email} onChange={setEmail} type="email"/>
            <TextField label="Contraseña" type="password" placeholder="••••••••" value={password} onChange={setPassword}/>
            {error && <div style={{ fontSize: 12, color: '#dc2626', padding: '8px 12px', background: '#fee2e2', borderRadius: 8 }}>{error}</div>}
            <Button variant="primary" size="lg" onClick={handleEmail} disabled={loading} full>
              {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </Button>
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
