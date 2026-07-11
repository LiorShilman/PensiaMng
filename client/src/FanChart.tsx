import { useMemo, useRef, useState } from 'react';
import type { SeriesPoint } from './api';

/**
 * גרף מניפה (fan chart) — מסלול הצבירה עד הפרישה בשלושה תרחישים.
 * קו מרכזי + רצועת אי-ודאות בין פסימי לאופטימי.
 * פלטה מאומתת מול הרקע הכהה (validate_palette): amber-600 / sky-600 / emerald-600.
 */

const COLORS = {
  pessimistic: '#d97706',
  central: '#0284c7',
  optimistic: '#059669',
} as const;

const W = 760;
const H = 300;
const M = { top: 18, right: 8, bottom: 30, left: 64 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

interface Props {
  pessimistic: SeriesPoint[];
  central: SeriesPoint[];
  optimistic: SeriesPoint[];
}

const fmtCompact = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
};

const fmtFull = (n: number): string =>
  n.toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });

export function FanChart(props: Props) {
  const { pessimistic, central, optimistic } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const startYear = new Date().getFullYear();
  const maxMonth = central[central.length - 1]?.month ?? 1;
  const maxY = (optimistic[optimistic.length - 1]?.balance ?? 1) * 1.06;

  const x = (month: number) => M.left + (month / maxMonth) * PLOT_W;
  const y = (balance: number) => M.top + PLOT_H - (balance / maxY) * PLOT_H;

  const line = (pts: SeriesPoint[]) =>
    pts.map((p) => `${x(p.month).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ');

  // רצועת אי-הוודאות: אופטימי קדימה, פסימי אחורה
  const bandPath = useMemo(() => {
    const up = optimistic.map((p) => `${x(p.month).toFixed(1)},${y(p.balance).toFixed(1)}`);
    const down = [...pessimistic]
      .reverse()
      .map((p) => `${x(p.month).toFixed(1)},${y(p.balance).toFixed(1)}`);
    return `M${up.join('L')}L${down.join('L')}Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessimistic, optimistic, maxMonth, maxY]);

  // קווי רשת אופקיים — 4, רגועים
  const yTicks = useMemo(() => {
    const step = maxY / 4;
    return [1, 2, 3, 4].map((i) => i * step);
  }, [maxY]);

  // תוויות שנים — עד ~7
  const xTicks = useMemo(() => {
    const totalYears = Math.ceil(maxMonth / 12);
    const step = Math.max(1, Math.ceil(totalYears / 6));
    const ticks: number[] = [];
    for (let yr = 0; yr <= totalYears; yr += step) ticks.push(yr * 12);
    return ticks.filter((m) => m <= maxMonth);
  }, [maxMonth]);

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const svg = (e.target as SVGRectElement).ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const month = ((px - M.left) / PLOT_W) * maxMonth;
    let best = 0;
    let bestDist = Infinity;
    central.forEach((p, i) => {
      const d = Math.abs(p.month - month);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHoverIdx(best);
  }

  const hover =
    hoverIdx !== null && central[hoverIdx]
      ? {
          month: central[hoverIdx].month,
          central: central[hoverIdx].balance,
          pessimistic: pessimistic[hoverIdx]?.balance ?? 0,
          optimistic: optimistic[hoverIdx]?.balance ?? 0,
        }
      : null;

  // מיקום ה-tooltip — מתהפך ליד הקצה הימני
  const tooltipLeftPct = hover ? (x(hover.month) / W) * 100 : 0;
  const flip = tooltipLeftPct > 62;

  return (
    <div className="fan-chart-wrap" ref={wrapRef} dir="ltr">
      <div className="chart-legend" dir="rtl">
        <span className="legend-item">
          <i style={{ background: COLORS.optimistic }} /> אופטימי
        </span>
        <span className="legend-item">
          <i style={{ background: COLORS.central }} /> מרכזי
        </span>
        <span className="legend-item">
          <i style={{ background: COLORS.pessimistic }} /> פסימי
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="fan-chart"
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label="גרף הצבירה הצפויה לאורך השנים בשלושה תרחישים"
      >
        {/* רשת אופקית */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={y(v)}
              y2={y(v)}
              className="grid-line"
            />
            <text x={M.left - 8} y={y(v) + 4} className="axis-label" textAnchor="end">
              {fmtCompact(v)}
            </text>
          </g>
        ))}
        {/* ציר תחתון */}
        <line
          x1={M.left}
          x2={W - M.right}
          y1={M.top + PLOT_H}
          y2={M.top + PLOT_H}
          className="axis-line"
        />
        {xTicks.map((m) => (
          <text
            key={m}
            x={x(m)}
            y={H - 8}
            className="axis-label"
            textAnchor="middle"
          >
            {startYear + Math.round(m / 12)}
          </text>
        ))}

        {/* רצועת אי-ודאות */}
        <path d={bandPath} fill={COLORS.central} opacity={0.1} />

        {/* קווי תרחישים — 2px, דקים */}
        <polyline
          points={line(pessimistic)}
          fill="none"
          stroke={COLORS.pessimistic}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <polyline
          points={line(optimistic)}
          fill="none"
          stroke={COLORS.optimistic}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <polyline
          points={line(central)}
          fill="none"
          stroke={COLORS.central}
          strokeWidth={2.5}
        />

        {/* crosshair */}
        {hover && (
          <g>
            <line
              x1={x(hover.month)}
              x2={x(hover.month)}
              y1={M.top}
              y2={M.top + PLOT_H}
              className="crosshair"
            />
            {(['optimistic', 'central', 'pessimistic'] as const).map((k) => (
              <circle
                key={k}
                cx={x(hover.month)}
                cy={y(hover[k])}
                r={4.5}
                fill={COLORS[k]}
                stroke="#111827"
                strokeWidth={2}
              />
            ))}
          </g>
        )}

        {/* שכבת האזנה */}
        <rect
          x={M.left}
          y={M.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          onMouseMove={onMove}
        />
      </svg>

      {hover && (
        <div
          className={`chart-tooltip ${flip ? 'flip' : ''}`}
          style={{ left: `${tooltipLeftPct}%` }}
          dir="rtl"
        >
          <div className="tooltip-title">
            {startYear + Math.round(hover.month / 12)} · בעוד {Math.round(hover.month / 12)} שנים
          </div>
          <div className="tooltip-row">
            <i style={{ background: COLORS.optimistic }} /> אופטימי
            <span>{fmtFull(hover.optimistic)}</span>
          </div>
          <div className="tooltip-row">
            <i style={{ background: COLORS.central }} /> מרכזי
            <span>{fmtFull(hover.central)}</span>
          </div>
          <div className="tooltip-row">
            <i style={{ background: COLORS.pessimistic }} /> פסימי
            <span>{fmtFull(hover.pessimistic)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
