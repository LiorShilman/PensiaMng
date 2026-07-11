import { useMemo, useState } from 'react';
import type { DeathProductOutcome } from './api';

/**
 * מפת זרימת הכסף במקרה מוות — Sankey בפריסה טבעית לעברית:
 * מקורות (מוצרים) בצד ימין ← מקבלים בצד שמאל.
 * התוויות יושבות בעמודות שמורות מחוץ לאזור הזרימה — לעולם לא על הרצועות.
 */

interface Props {
  products: DeathProductOutcome[];
  /** צבע מבטא לכל מוצר לפי המזהה */
  colorOf: (id: string) => string;
}

interface FlowLink {
  sourceId: string;
  sourceName: string;
  targetName: string;
  amount: number;
  color: string;
}

const W = 900;
const NODE_W = 10;
const GAP = 16;
const LABEL_W = 260; // עמודת תוויות שמורה בכל צד — הוגדל כדי שהשם יקבל שורה שלמה לעצמו
const MIN_NODE_H = 36; // מינימום שמבטיח שתי שורות תווית (שם + סכום) בלי התנגשות

/* בונים את המחרוזת ידנית (ולא style:'currency') כי הצבת סימן ה-₪
   האוטומטית של ה-locale מסתמכת על הקשר bidi של RTL — וזה מתהפך
   בתוך ה-SVG שנקבע כ-direction:ltr (תיקון עוגן הטקסט לתוויות). */
const fmt = (n: number) => `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;

/** קיצור שם ארוך כדי שלא יגלוש מעמודת התוויות — הסכום עבר לשורה נפרדת, אז לשם יש תקציב תווים גדול יותר */
const clip = (s: string, max = 30) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

interface Node {
  name: string;
  total: number;
  y0: number;
  h: number;
  color?: string;
}

function layoutColumn(
  items: { name: string; total: number; color?: string }[],
  totalValue: number,
): { nodes: Node[]; height: number } {
  const basePlot = Math.max(120, items.length * 52);
  const k = (basePlot - GAP * Math.max(0, items.length - 1)) / totalValue;
  const nodes: Node[] = [];
  let y = 0;
  for (const it of items) {
    const h = Math.max(MIN_NODE_H, it.total * k);
    nodes.push({ ...it, y0: y, h });
    y += h + GAP;
  }
  return { nodes, height: y - GAP };
}

function Section(props: { title: string; unitLabel: string; links: FlowLink[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const { links } = props;

  const layout = useMemo(() => {
    const srcMap = new Map<string, { name: string; total: number; color: string }>();
    const tgtMap = new Map<string, number>();
    for (const l of links) {
      const s = srcMap.get(l.sourceId) ?? { name: l.sourceName, total: 0, color: l.color };
      s.total += l.amount;
      srcMap.set(l.sourceId, s);
      tgtMap.set(l.targetName, (tgtMap.get(l.targetName) ?? 0) + l.amount);
    }
    const totalValue = links.reduce((s, l) => s + l.amount, 0);
    const sourcesCol = layoutColumn([...srcMap.values()], totalValue);
    const targetsCol = layoutColumn(
      [...tgtMap.entries()].map(([name, total]) => ({ name, total })),
      totalValue,
    );
    const height = Math.max(sourcesCol.height, targetsCol.height);

    // רצועות: חלוקת גובה הצומת לפי חלקו של כל קישור
    const srcIds = [...srcMap.keys()];
    const srcOff = new Map<string, number>();
    const tgtOff = new Map<string, number>();
    const ribbons = links.map((l) => {
      const src = sourcesCol.nodes[srcIds.indexOf(l.sourceId)];
      const tgt = targetsCol.nodes.find((t) => t.name === l.targetName)!;
      const sOff = srcOff.get(l.sourceId) ?? 0;
      const tOff = tgtOff.get(l.targetName) ?? 0;
      const sh = (l.amount / src.total) * src.h;
      const th = (l.amount / tgt.total) * tgt.h;
      srcOff.set(l.sourceId, sOff + sh);
      tgtOff.set(l.targetName, tOff + th);
      return { link: l, sy0: src.y0 + sOff, sy1: src.y0 + sOff + sh, ty0: tgt.y0 + tOff, ty1: tgt.y0 + tOff + th };
    });

    return { sources: sourcesCol.nodes, targets: targetsCol.nodes, ribbons, height };
  }, [links]);

  if (links.length === 0) return null;

  // מקורות מימין, מקבלים משמאל (קריאה טבעית בעברית)
  const srcX = W - LABEL_W - NODE_W;
  const tgtX = LABEL_W;
  const svgH = layout.height + 10;

  const ribbonPath = (r: (typeof layout.ribbons)[number]) => {
    const xa = srcX; // הקצה השמאלי של צומת המקור
    const xb = tgtX + NODE_W; // הקצה הימני של צומת היעד
    const c = (xa - xb) / 2;
    return `M${xa},${r.sy0 + 5} C${xa - c},${r.sy0 + 5} ${xb + c},${r.ty0 + 5} ${xb},${r.ty0 + 5} L${xb},${r.ty1 + 5} C${xb + c},${r.ty1 + 5} ${xa - c},${r.sy1 + 5} ${xa},${r.sy1 + 5} Z`;
  };

  return (
    <div className="flow-section">
      <h4 className="flow-title">
        {props.title} <small>({props.unitLabel})</small>
      </h4>
      <svg viewBox={`0 0 ${W} ${svgH}`} className="flow-svg">
        {/* רצועות */}
        {layout.ribbons.map((r, i) => (
          <path
            key={i}
            d={ribbonPath(r)}
            fill={r.link.color}
            opacity={hover === null ? 0.32 : hover === i ? 0.68 : 0.1}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <title>
              {r.link.sourceName} ← {r.link.targetName}: {fmt(r.link.amount)}
            </title>
          </path>
        ))}

        {/* צמתי מקור (ימין) — שם ("שורה מלאה) וסכום בשורה נפרדת מתחתיו, מחוץ לגרף */}
        {layout.sources.map((s) => (
          <g key={s.name}>
            <rect x={srcX} y={s.y0 + 5} width={NODE_W} height={s.h} rx={4} fill={s.color} />
            <text
              x={srcX + NODE_W + 10}
              y={s.y0 + 5 + s.h / 2 - 5}
              className="flow-label"
              textAnchor="start"
            >
              <title>{s.name}</title>
              {clip(s.name)}
            </text>
            <text
              x={srcX + NODE_W + 10}
              y={s.y0 + 5 + s.h / 2 + 11}
              className="flow-amount"
              textAnchor="start"
            >
              {fmt(s.total)}
            </text>
          </g>
        ))}

        {/* צמתי יעד (שמאל) */}
        {layout.targets.map((t) => (
          <g key={t.name}>
            <rect x={tgtX} y={t.y0 + 5} width={NODE_W} height={t.h} rx={4} fill="#8285a6" />
            <text
              x={tgtX - 10}
              y={t.y0 + 5 + t.h / 2 - 5}
              className="flow-label"
              textAnchor="end"
            >
              <title>{t.name}</title>
              {clip(t.name)}
            </text>
            <text
              x={tgtX - 10}
              y={t.y0 + 5 + t.h / 2 + 11}
              className="flow-amount"
              textAnchor="end"
            >
              {fmt(t.total)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function MoneyFlow(props: Props) {
  const monthlyLinks: FlowLink[] = [];
  const lumpLinks: FlowLink[] = [];

  for (const p of props.products) {
    const color = props.colorOf(p.id);
    if (p.spouseMonthly > 0) {
      monthlyLinks.push({
        sourceId: p.id,
        sourceName: p.name,
        targetName: 'בן/בת זוג',
        amount: p.spouseMonthly,
        color,
      });
    }
    if (p.childrenMonthly > 0) {
      monthlyLinks.push({
        sourceId: p.id,
        sourceName: p.name,
        targetName: 'ילדים (יתומים)',
        amount: p.childrenMonthly,
        color,
      });
    }
    for (const s of p.lumpSumSplit) {
      lumpLinks.push({
        sourceId: p.id,
        sourceName: p.name,
        targetName: s.name,
        amount: s.amount,
        color,
      });
    }
  }

  if (monthlyLinks.length === 0 && lumpLinks.length === 0) return null;

  return (
    <div className="money-flow">
      <Section title="קצבאות חודשיות לשאירים" unitLabel="₪ לחודש" links={monthlyLinks} />
      <Section title="סכומים חד-פעמיים" unitLabel="₪" links={lumpLinks} />
    </div>
  );
}
