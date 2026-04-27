'use client';

import React from 'react';
import Icon from './Icon';

interface TextFieldProps {
  label?: string;
  value?: string | number;
  onChange?: (val: string) => void;
  placeholder?: string;
  type?: string;
  suffix?: string;
  prefix?: string;
  error?: string;
  hint?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}

export default function TextField({ label, value, onChange, placeholder, type = 'text', suffix, prefix, error, hint, autoFocus, disabled, style = {}, inputStyle = {} }: TextFieldProps) {
  return (
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
            ...inputStyle,
          }}
        />
        {suffix && <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8, fontWeight: 500 }}>{suffix}</span>}
      </div>
      {hint && !error && <span style={{ fontSize: 11, color: '#64748b' }}>{hint}</span>}
      {error && (
        <span style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="alert" size={12} /> {error}
        </span>
      )}
    </label>
  );
}
