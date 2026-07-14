import { useMemo, useState } from 'react';
import type { SeriesPoint } from './api';

/**
 * "נהר הכסף" — streamgraph של הצבירה עד הפרישה, לפי מוצר. כל מוצר הוא זרם
 * צבעוני שרוחבו בכל נקודת זמן משקף את הצבירה שלו; הזרמים נערמים בהערמת
 * silhouette (סימטרית סביב מרכז אנכי, לא באפס) כדי ליצור צורת נהר אורגנית.
 * תרחיש מרכזי בלבד — ראו fan chart לרצועת אי-הוודאות בין התרחישים.
 *
 * צבע נקבע פר-מוצר (לא לפי סוג מוצר כמו ב-TYPE_META) — כדי שכמה מוצרים מאותו
 * סוג (למשל שתי קרנות פנסיה ממעסיקים שונים) יישארו מובחנים בבירור בנהר, גם
 * במחיר אי-עקביות מול הצבע שכל מוצר מקבל בכרטיסי התיק. פלטה קטגוריאלית
 * מאומתת (validate_palette.js, מול משטח הכרטיס הכהה #1e1f30) בסדר קבוע.
 */

const RIVER_PALETTE = [
  '#0284c7',
  '#0891b2',
  '#0d9488',
  '#16a34a',
  '#a16207',
  '#d97706',
  '#db2777',
  '#e11d48',
  '#c026d3',
  '#7c3aed',
  '#6366f1',
  '#4f46e5',
];

export interface RiverProduct {
  id: string;
  name: string;
  series: SeriesPoint[];
}

interface Props {
  products: RiverProduct[];
}

const W = 760;
const H = 300;
const M = { top: 26, right: 22, bottom: 30, left: 22 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

type Pt = [number, number];

const fmtFull = (n: number): string =>
  `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

/* Catmull-Rom → cubic Bezier, ממ"מ אחיד — עקומה חלקה בלי ספריית chart חיצונית */
function smoothSegment(points: Pt[]): string {
  let d = '';
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function bandPath(top: Pt[], bottom: Pt[]): string {
  const bottomRev = [...bottom].reverse();
  return (
    `M${top[0][0].toFixed(1)},${top[0][1].toFixed(1)}` +
    smoothSegment(top) +
    ` L${bottomRev[0][0].toFixed(1)},${bottomRev[0][1].toFixed(1)}` +
    smoothSegment(bottomRev) +
    ' Z'
  );
}

export function MoneyRiver(props: Props) {
  // מוצרים עם צבירה סופית כמעט-אפס לא מוצגים — נמנעים מרצועות בלתי-נראות
  const products = props.products.filter(
    (p) => (p.series[p.series.length - 1]?.balance ?? 0) >= 1,
  );

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const layout = useMemo(() => {
    if (products.length === 0) return null;
    const months = products[0].series.map((s) => s.month);
    const n = months.length;

    // סך הצבירה בכל נקודת זמן, ובסיס ה-silhouette (סימטרי סביב 0)
    const totals = months.map((_, i) =>
      products.reduce((s, p) => s + (p.series[i]?.balance ?? 0), 0),
    );
    const maxTotal = Math.max(1, ...totals);
    const domainHalf = (maxTotal / 2) * 1.1;

    const maxMonth = months[n - 1] ?? 1;
    const x = (month: number) => M.left + (month / maxMonth) * PLOT_W;
    const y = (v: number) => M.top + PLOT_H / 2 - (v / domainHalf) * (PLOT_H / 2);

    // ערימת שכבות — כל שכבה: קצה תחתון וקצה עליון בכל נקודת זמן, וצבע לפי
    // מיקום המוצר ברשימה (לא לפי סוגו) כדי שמוצרים מאותו סוג יישארו מובחנים
    let bottomVal = totals.map((t) => -t / 2);
    const bands = products.map((p, idx) => {
      const top: Pt[] = [];
      const bottom: Pt[] = [];
      const nextBottomVal = [...bottomVal];
      for (let i = 0; i < n; i++) {
        const b0 = bottomVal[i];
        const b1 = b0 + (p.series[i]?.balance ?? 0);
        bottom.push([x(months[i]), y(b0)]);
        top.push([x(months[i]), y(b1)]);
        nextBottomVal[i] = b1;
      }
      bottomVal = nextBottomVal;
      const color = RIVER_PALETTE[idx % RIVER_PALETTE.length];
      return { product: p, color, top, bottom };
    });

    return { months, totals, bands, x, y, maxMonth };
  }, [products]);

  if (!layout) return null;
  const { months, totals, bands, x, y, maxMonth } = layout;

  const startYear = new Date().getFullYear();

  // תוויות שנים על ציר הזמן — עד ~6, כמו ב-fan chart. השנה האחרונה תמיד
  // בדיוק גיל הפרישה (maxMonth), לא עיגול של הצעד, כדי שלא תיחתך לפני הקצה
  const totalYears = Math.ceil(maxMonth / 12);
  const yearStep = Math.max(1, Math.ceil(totalYears / 6));
  const xTicks: number[] = [];
  for (let yr = 0; yr < totalYears; yr += yearStep) {
    xTicks.push(yr * 12);
  }
  if (xTicks[xTicks.length - 1] !== maxMonth) xTicks.push(maxMonth);

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const svg = (e.target as SVGRectElement).ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const month = ((px - M.left) / PLOT_W) * maxMonth;
    let best = 0;
    let bestDist = Infinity;
    months.forEach((m, i) => {
      const d = Math.abs(m - month);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHoverIdx(best);
  }

  const hover =
    hoverIdx !== null
      ? {
          idx: hoverIdx,
          month: months[hoverIdx],
          total: totals[hoverIdx],
          rows: bands.map((b) => ({
            name: b.product.name,
            color: b.color,
            balance: b.product.series[hoverIdx]?.balance ?? 0,
          })),
        }
      : null;

  const tooltipLeftPct = hover ? (x(hover.month) / W) * 100 : 0;
  const flip = tooltipLeftPct > 62;

  const startTotal = totals[0] ?? 0;
  const endTotal = totals[totals.length - 1] ?? 0;
  const startTopY = y(startTotal / 2) - 10;
  const endTopY = y(endTotal / 2) - 10;

  return (
    <div className="river-wrap" dir="ltr">
      <div className="chart-legend" dir="rtl">
        {bands.map((b) => (
          <span className="legend-item" key={b.product.id}>
            <i style={{ background: b.color }} /> {b.product.name}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="money-river"
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label="נהר הכסף — זרימת הצבירה של כל מוצר לאורך השנים עד הפרישה"
      >
        {bands.map((b) => (
          <path
            key={b.product.id}
            d={bandPath(b.top, b.bottom)}
            fill={b.color}
            stroke="var(--card-solid)"
            strokeWidth={1.5}
          />
        ))}

        <text x={x(0)} y={startTopY} className="river-label" textAnchor="start">
          היום · {fmtFull(startTotal)}
        </text>
        <text
          x={x(maxMonth)}
          y={endTopY}
          className="river-label"
          textAnchor="end"
        >
          בפרישה · {fmtFull(endTotal)}
        </text>

        {/* ציר שנים — הראשונה/אחרונה מעוגנות פנימה כדי שלא ייחתכו בקצוות ה-SVG */}
        {xTicks.map((m, i) => (
          <g key={m}>
            <line
              x1={x(m)}
              x2={x(m)}
              y1={M.top + PLOT_H}
              y2={M.top + PLOT_H + 5}
              className="axis-line"
            />
            <text
              x={x(m)}
              y={H - 8}
              className="axis-label"
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
            >
              {startYear + Math.round(m / 12)}
            </text>
          </g>
        ))}

        {hover && (
          <line
            x1={x(hover.month)}
            x2={x(hover.month)}
            y1={M.top}
            y2={M.top + PLOT_H}
            className="crosshair"
          />
        )}

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
            {' · '}סה"כ {fmtFull(hover.total)}
          </div>
          {hover.rows
            .filter((r) => r.balance >= 1)
            .map((r) => (
              <div className="tooltip-row" key={r.name}>
                <i style={{ background: r.color }} /> {r.name}
                <span>{fmtFull(r.balance)}</span>
              </div>
            ))}
        </div>
      )}

      <p className="hint river-note">
        מבוסס על התרחיש המרכזי בלבד — ראו "מסלול הצבירה עד הפרישה" למעלה לטווח
        שבין התרחיש הפסימי לאופטימי.
      </p>
    </div>
  );
}
