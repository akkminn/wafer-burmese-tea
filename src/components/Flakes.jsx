import { useMemo } from 'react'

export default function Flakes({ count = 16 }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 8 + Math.random() * 14,
        delay: -Math.random() * 16,
        dur: 12 + Math.random() * 10,
        drift: (Math.random() - 0.5) * 140,
        spin: Math.random() * 360,
      })),
    [count],
  )
  return (
    <div className="flakes" aria-hidden="true">
      {flakes.map((f) => (
        <span
          key={f.id}
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size * 0.55,
            animationDelay: `${f.delay}s`,
            animationDuration: `${f.dur}s`,
            '--drift': `${f.drift}px`,
            '--spin': `${f.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}
