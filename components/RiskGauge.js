'use client';

import { useEffect, useState } from 'react';
import { THRESHOLDS } from '@/lib/scamRules';

const CX = 120;
const CY = 120;
const R = 92;

// 0..100 -> point on the top half-circle (0 = far left, 100 = far right)
function polar(value, radius = R) {
  const angle = Math.PI * (1 - value / 100);
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
}

function arc(from, to) {
  const [x1, y1] = polar(from);
  const [x2, y2] = polar(to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

const ZONES = [
  { from: 0, to: THRESHOLDS.suspicious, color: 'rgb(var(--safe))' },
  { from: THRESHOLDS.suspicious, to: THRESHOLDS.high, color: 'rgb(var(--warn))' },
  { from: THRESHOLDS.high, to: 100, color: 'rgb(var(--danger))' },
];

export default function RiskGauge({ score, levelLabel, levelClass }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(score);
      return undefined;
    }

    let frame;
    let start = null;
    const duration = 900;

    const tick = (now) => {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(score * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    setShown(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const needleAngle = (shown / 100) * 180 - 90;
  const ticks = Array.from({ length: 11 }, (_, i) => i * 10);

  return (
    <figure className="m-0 text-center" aria-label={`Risk score ${score} out of 100, ${levelLabel}`}>
      <svg viewBox="0 0 240 140" className="mx-auto w-full max-w-[320px]" role="img" aria-hidden="true">
        {ZONES.map((zone) => (
          <path
            key={zone.from}
            d={arc(zone.from + 0.6, zone.to - 0.6)}
            fill="none"
            stroke={zone.color}
            strokeWidth="14"
            strokeLinecap="butt"
            opacity="0.9"
          />
        ))}

        {ticks.map((t) => {
          const [x1, y1] = polar(t, R + 13);
          const [x2, y2] = polar(t, R + (t % 50 === 0 ? 21 : 17));
          return (
            <line
              key={t}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgb(var(--muted))"
              strokeWidth={t % 50 === 0 ? 2 : 1}
              opacity="0.7"
            />
          );
        })}

        <g style={{ transform: `rotate(${needleAngle}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
          <line x1={CX} y1={CY} x2={CX} y2={CY - 78} stroke="rgb(var(--ink))" strokeWidth="3.5" strokeLinecap="round" />
        </g>
        <circle cx={CX} cy={CY} r="9" fill="rgb(var(--ink))" />
        <circle cx={CX} cy={CY} r="3.5" fill="rgb(var(--surface))" />
      </svg>

      <div className="-mt-1 font-display text-5xl font-bold leading-none tabular-nums">
        {shown}
        <span className="text-2xl font-semibold text-muted">%</span>
      </div>
      <figcaption className={`mt-2 font-display text-lg font-semibold ${levelClass}`}>{levelLabel}</figcaption>
    </figure>
  );
}
