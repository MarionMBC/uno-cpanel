'use client';

interface AvatarProps {
  name?: string;
  initials?: string;
  size?: number;
  color?: string;
}

export default function Avatar({ name, initials, size = 32, color = '#0f1f3d' }: AvatarProps) {
  const init = initials || (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, background: color, color: 'white',
      display: 'grid', placeItems: 'center', fontSize: size * 0.38, fontWeight: 700,
      letterSpacing: 0.4, flexShrink: 0,
    }}>
      {init}
    </div>
  );
}
