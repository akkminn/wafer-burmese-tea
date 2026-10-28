const FILL = {
  classic: ['#ffe6a0', '#ffe6a0'],
  choco: ['#3d1e0d', '#3d1e0d'],
  mixed: ['#ffe6a0', '#3d1e0d'],
}

function Sheet({ y }) {
  return (
    <g>
      <rect x="14" y={y} width="72" height="13" rx="3" fill="#e6b865" stroke="#b98532" strokeWidth="1.6" />
      {[26, 38, 50, 62, 74].map((x) => (
        <line key={x} x1={x} y1={y + 2} x2={x} y2={y + 11} stroke="#b98532" strokeWidth="1.2" />
      ))}
    </g>
  )
}

function Fill({ y, color }) {
  return (
    <g>
      <path d={`M16 ${y} h68 v5 q-3 5 -6 0 q-3 6 -7 0 q-4 5 -8 0 q-4 6 -8 0 q-4 5 -8 0 q-4 6 -8 0 q-4 5 -8 0 q-4 4 -7 0 Z`} fill={color} />
      <path d={`M20 ${y + 1} q6 -5 11 -1 M40 ${y} q7 -5 12 0 M60 ${y + 1} q6 -4 12 -1`} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </g>
  )
}

export function StackIcon({ flavor = 'classic', className = 'icon', size }) {
  const [a, b] = FILL[flavor] || FILL.classic
  return (
    <svg className={className} viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="A stack of three wafer sheets with filling and coconut between them">
      <ellipse cx="50" cy="88" rx="36" ry="5" fill="#000" opacity=".14" />
      <Sheet y={70} />
      <Fill y={64} color={a} />
      <Sheet y={48} />
      <Fill y={42} color={b} />
      <Sheet y={26} />
    </svg>
  )
}

export function CupIcon({ className = 'icon', size }) {
  return (
    <svg className={className} viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Small paper cup of Burmese tea">
      <ellipse cx="50" cy="88" rx="30" ry="5" fill="#000" opacity=".14" />
      <path d="M26 44 h48 l-6 40 q-18 5 -36 0 Z" fill="#fbfaf6" stroke="#d8d2c2" strokeWidth="1.5" />
      <circle cx="50" cy="64" r="11" fill="#fff" stroke="#0b5230" strokeWidth="2.4" />
      <path d="M44 66 q6 6 12 0" stroke="#f5a30a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <rect x="22" y="38" width="56" height="9" rx="4" fill="#f3f1ea" stroke="#d8d2c2" strokeWidth="1.2" />
      <rect x="20" y="28" width="60" height="12" rx="5" fill="#5a3520" />
      <path d="M26 30 q24 -14 48 0 Z" fill="#6a4228" />
    </svg>
  )
}
