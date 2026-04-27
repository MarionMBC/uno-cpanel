'use client';

import Modal from './Modal';
import Button from '@/components/ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger' | 'warning';
  icon?: string;
}

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'primary', icon = 'alert' }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={message}
      icon={icon}
      iconTone={tone}
      width={460}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => { onConfirm?.(); onClose(); }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div />
    </Modal>
  );
}
