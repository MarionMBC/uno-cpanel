'use client';

import { Pump } from '@/types';

interface PumpDiagramProps {
  pump: Pump;
  activeFace?: string;
  activeDisp?: number;
  onPick?: (face: string) => void;
  compact?: boolean;
}

export default function PumpDiagram({ pump, activeFace, activeDisp, onPick, compact }: PumpDiagramProps) {
  const w = compact ? 220 : 300;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width={w} height={compact ? 200 : 260} viewBox="0 0 200 240">
        <rect x="20" y="200" width="160" height="20" rx="4" fill="#1e293b"/>
        <rect x="40" y="40" width="120" height="170" rx="10" fill="#0f1f3d" stroke="#1e293b"/>
        <rect x="46" y="46" width="108" height="40" rx="4" fill="#fbbf24"/>
        <text x="100" y="72" fontSize="14" fontWeight="800" textAnchor="middle" fill="#0f1f3d" fontFamily="system-ui">
          {pump.fuel.name.toUpperCase()}
        </text>
        <rect x="46" y="92" width="108" height="34" rx="3" fill="#0a0f1c" stroke="#fbbf24" strokeOpacity=".3"/>
        <text x="100" y="113" fontSize="11" textAnchor="middle" fill="#fbbf24" fontFamily="ui-monospace, monospace" fontWeight="600">
          L. {pump.fuel.price.toFixed(2)}
        </text>
        <g style={{ cursor: 'pointer' }} onClick={() => onPick?.('A')} opacity={activeFace === 'B' ? 0.4 : 1}>
          <line x1="40" y1="140" x2="20" y2="140" stroke="#94a3b8" strokeWidth="3"/>
          <rect x="6" y="132" width="18" height="18" rx="3" fill={activeFace === 'A' ? '#d97706' : '#475569'}/>
          <text x="15" y="145" fontSize="11" fontWeight="700" textAnchor="middle" fill="white">A</text>
        </g>
        <g style={{ cursor: 'pointer' }} onClick={() => onPick?.('B')} opacity={activeFace === 'A' ? 0.4 : 1}>
          <line x1="160" y1="140" x2="180" y2="140" stroke="#94a3b8" strokeWidth="3"/>
          <rect x="176" y="132" width="18" height="18" rx="3" fill={activeFace === 'B' ? '#d97706' : '#475569'}/>
          <text x="185" y="145" fontSize="11" fontWeight="700" textAnchor="middle" fill="white">B</text>
        </g>
        {[1, 2, 3].map((d, i) => (
          <circle key={d} cx={62 + i * 38} cy={170} r="6"
            fill={activeDisp === d ? '#fbbf24' : '#334155'}
            stroke={activeDisp === d ? '#fff' : 'none'} strokeWidth="2"/>
        ))}
        <text x="100" y="195" fontSize="9" textAnchor="middle" fill="#94a3b8" fontFamily="ui-monospace, monospace" letterSpacing="2">
          D1   D2   D3
        </text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {pump.name}
      </div>
    </div>
  );
}
