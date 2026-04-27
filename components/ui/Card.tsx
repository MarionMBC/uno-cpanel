'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  padding?: number;
  style?: React.CSSProperties;
  hoverable?: boolean;
  onClick?: () => void;
}

export default function Card({ children, padding = 20, style = {}, hoverable, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={hoverable ? 'card-hover' : undefined}
      style={{
        background: 'white', borderRadius: 14,
        boxShadow: '0 0 0 1px #e6e8ec, 0 1px 2px rgba(15,23,42,.04)',
        padding,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
