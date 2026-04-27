'use client';

import React from 'react';
import Icon from './Icon';

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'success' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
  full?: boolean;
}

const VARIANTS: Record<ButtonVariant, React.CSSProperties> = {
  primary:   { background: '#0f1f3d', color: 'white', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 1px 2px rgba(15,31,61,.25)' },
  accent:    { background: '#d97706', color: 'white', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), 0 1px 2px rgba(217,119,6,.3)' },
  secondary: { background: 'white', color: '#0f1f3d', boxShadow: 'inset 0 0 0 1px #e2e8f0' },
  ghost:     { background: 'transparent', color: '#475569' },
  success:   { background: '#16a34a', color: 'white' },
  danger:    { background: 'white', color: '#b91c1c', boxShadow: 'inset 0 0 0 1px #fecaca' },
};

const SIZES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 12, height: 30 },
  md: { padding: '9px 16px', fontSize: 13, height: 38 },
  lg: { padding: '12px 20px', fontSize: 14, height: 46 },
};

export default function Button({ variant = 'primary', size = 'md', icon, iconRight, children, onClick, disabled, type = 'button', style = {}, full }: ButtonProps) {
  const iconSize = size === 'sm' ? 14 : 16;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        border: 0, fontFamily: 'inherit', fontWeight: 600, letterSpacing: 0.1,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        borderRadius: 10, transition: 'transform .08s, box-shadow .15s, background .15s',
        width: full ? '100%' : 'auto', flexShrink: 0,
        ...SIZES[size],
        ...VARIANTS[variant],
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}
