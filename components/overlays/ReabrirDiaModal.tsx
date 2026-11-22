'use client';

// Reabrir un día cerrado, hoy o pasado (TASK-023): canCloseDay, motivo obligatorio y auditoría.
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/ui/Button';
import TextField from '@/components/ui/TextField';
import Modal from '@/components/overlays/Modal';
import { reabrirDia } from '@/lib/diaDb';
import { fechaCortaHN } from '@/lib/fecha';

const MOTIVO_MIN = 5;

interface Props {
  /** Día a reabrir (YYYY-MM-DD); null = cerrado el modal. */
  fecha: string | null;
  onClose: () => void;
  /** Qué permite la reapertura en la pantalla que la ofrece (subtítulo). */
  detalle?: string;
  /** Tras reabrir (p. ej. recargar una fecha pasada que no se escucha en vivo). */
  onReabierto?: () => void;
}

export default function ReabrirDiaModal({ fecha, onClose, onReabierto, detalle = 'Vuelve a permitir corregir lecturas, turnos y arqueos del día.' }: Props) {
  const { addAuditEntry } = useApp();
  const { appUser } = useAuth();
  const toast = useToast();
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cerrar = () => { setMotivo(''); onClose(); };

  const confirmar = async () => {
    if (!fecha) return;
    const m = motivo.trim();
    if (m.length < MOTIVO_MIN) { toast.error('Falta el motivo', `Escribe el motivo de la reapertura (mínimo ${MOTIVO_MIN} caracteres).`); return; }
    setOcupado(true);
    try {
      await reabrirDia(fecha, m, appUser?.email || '');
    } catch (e) {
      console.error(e);
      toast.error('No se reabrió', 'Revisa tu permiso y la conexión.');
      setOcupado(false);
      return;
    }
    toast.success('Día reabierto', `${fechaCortaHN(fecha)}: ya se puede corregir. Vuelve a cerrarlo al terminar.`);
    setOcupado(false);
    cerrar();
    onReabierto?.();
    try {
      await addAuditEntry({ action: 'Reapertura del día', target: fechaCortaHN(fecha), detail: detalle, icon: 'unlock', before: 'cerrado', after: 'en_proceso', reason: m });
    } catch (e) {
      console.error(e);
      toast.warning('Sin auditoría', 'El día se reabrió, pero no quedó el registro en la auditoría.');
    }
  };

  return (
    <Modal open={fecha !== null} onClose={cerrar} title={fecha ? `Reabrir el día ${fechaCortaHN(fecha)}` : ''}
      subtitle={`${detalle} El motivo queda en la auditoría.`} icon="unlock" iconTone="warning" width={460}
      footer={<>
        <Button variant="secondary" onClick={cerrar}>Cancelar</Button>
        <Button variant="primary" icon="unlock" disabled={ocupado} onClick={confirmar}>Reabrir día</Button>
      </>}>
      <TextField label="Motivo (obligatorio)" value={motivo} autoFocus placeholder="Ej.: lectura final de Bomba 02 mal digitada" onChange={setMotivo} />
    </Modal>
  );
}
