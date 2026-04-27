// overlays.jsx — Modal, ConfirmDialog, Toast system

const { useState: useOvState, useEffect: useOvEffect, createContext, useContext, useCallback } = React;

// ─── Toast context ──────────────────────────────────────────────────────────
const ToastCtx = createContext(null);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useOvState([]);

  const dismiss = useCallback((id) => {
    setToasts((s) => s.filter(t => t.id !== id));
  }, []);

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    const t = { id, tone: 'info', duration: 4200, ...toast };
    setToasts((s) => [...s, t]);
    if (t.duration > 0) setTimeout(() => dismiss(id), t.duration);
    return id;
  }, [dismiss]);

  const api = {
    push,
    dismiss,
    success: (title, sub) => push({ tone: 'success', title, sub, icon: 'check' }),
    error:   (title, sub) => push({ tone: 'danger',  title, sub, icon: 'alert' }),
    warning: (title, sub) => push({ tone: 'warning', title, sub, icon: 'alert' }),
    info:    (title, sub) => push({ tone: 'info',    title, sub, icon: 'info'  }),
  };

  const tones = {
    success: { bar: '#16a34a', bg: '#dcfce7', fg: '#166534', icBg: '#16a34a' },
    danger:  { bar: '#dc2626', bg: '#fee2e2', fg: '#991b1b', icBg: '#dc2626' },
    warning: { bar: '#d97706', bg: '#fef3c7', fg: '#854d0e', icBg: '#d97706' },
    info:    { bar: '#0f1f3d', bg: 'white',   fg: '#0f172a', icBg: '#0f1f3d' },
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div style={{
        position: 'absolute', right: 20, bottom: 20, zIndex: 100,
        display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none',
        maxWidth: 380, width: '100%',
      }}>
        {toasts.map((t) => {
          const c = tones[t.tone] || tones.info;
          return (
            <div key={t.id}
              className="toast-in"
              style={{
                background: 'white', borderRadius: 11,
                boxShadow: '0 12px 30px rgba(15,23,42,.18), 0 0 0 1px #e2e8f0',
                padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12,
                pointerEvents: 'auto', borderLeft: `3px solid ${c.bar}`,
              }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: c.icBg, color: 'white', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name={t.icon || 'info'} size={14}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{t.title}</div>
                {t.sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>{t.sub}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} style={{
                width: 22, height: 22, borderRadius: 6, border: 0, background: 'transparent',
                color: '#94a3b8', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0,
              }}><Icon name="x" size={12}/></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

const useToast = () => useContext(ToastCtx);

// ─── Modal (generic shell) ──────────────────────────────────────────────────
function Modal({ open, onClose, title, subtitle, icon, iconTone = 'primary', width = 520, children, footer }) {
  useOvEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const tones = {
    primary: { bg: '#0f1f3d', fg: '#fbbf24' },
    success: { bg: '#dcfce7', fg: '#16a34a' },
    danger:  { bg: '#fee2e2', fg: '#dc2626' },
    warning: { bg: '#fef3c7', fg: '#d97706' },
    info:    { bg: '#dbeafe', fg: '#1e40af' },
  };
  const t = tones[iconTone] || tones.primary;

  return (
    <div className="modal-backdrop" style={{
      position: 'absolute', inset: 0, background: 'rgba(8, 13, 30, .55)',
      backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
      zIndex: 90, display: 'grid', placeItems: 'center', padding: 24,
    }} onClick={onClose}>
      <div className="modal-in" onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: width, background: 'white', borderRadius: 14,
        boxShadow: '0 30px 80px rgba(8, 13, 30, .35), 0 0 0 1px rgba(15,23,42,.06)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90%',
      }}>
        <div style={{ padding: '18px 22px 14px', display: 'flex', alignItems: 'flex-start', gap: 14, borderBottom: '1px solid #f1f5f9' }}>
          {icon && (
            <div style={{ width: 38, height: 38, borderRadius: 10, background: t.bg, color: t.fg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon name={icon} size={18}/>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: -0.2 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0',
            background: 'white', cursor: 'pointer', color: '#64748b',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}><Icon name="x" size={14}/></button>
        </div>
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: '14px 22px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ConfirmDialog ──────────────────────────────────────────────────────────
function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'primary', icon = 'alert' }) {
  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={message} icon={icon} iconTone={tone} width={460}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'}
          onClick={() => { onConfirm && onConfirm(); onClose && onClose(); }}>{confirmLabel}</Button>
      </>}
    />
  );
}

// inject animations
const overlayStyle = document.createElement('style');
overlayStyle.textContent = `
  @keyframes toast-in { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform: translateY(0) } }
  .toast-in { animation: toast-in .18s cubic-bezier(.3,.7,.4,1); }
  @keyframes modal-fade { from { opacity:0 } to { opacity:1 } }
  @keyframes modal-pop { from { opacity:0; transform: scale(.96) translateY(6px) } to { opacity:1; transform: none } }
  .modal-backdrop { animation: modal-fade .14s ease; }
  .modal-in { animation: modal-pop .18s cubic-bezier(.3,.7,.4,1); }
`;
document.head.appendChild(overlayStyle);

Object.assign(window, { ToastProvider, useToast, Modal, ConfirmDialog });
