/**
 * מסלולי השקעה סטנדרטיים (מפרט 3.5) — הנחות תשואה ריאלית מקובלות לתכנון.
 * הערכים הם הנחות ברירת מחדל לטווח ארוך, מנוכות אינפלציה;
 * בהמשך יעברו לטבלת RegulatoryParameter לעדכון שוטף.
 */

export interface TrackDef {
  category: string;
  label: string;
  /** הנחת תשואה שנתית ריאלית (%) */
  realReturnPct: number;
  /** רמת סיכון 1–7 */
  riskLevel: number;
}

export const TRACK_DEFS: readonly TrackDef[] = [
  { category: 'AGE_DEPENDENT', label: 'תלוי גיל (מודל חכ"ם)', realReturnPct: 3.74, riskLevel: 4 },
  { category: 'GENERAL', label: 'כללי', realReturnPct: 3.74, riskLevel: 4 },
  { category: 'EQUITY', label: 'מנייתי', realReturnPct: 5.5, riskLevel: 6 },
  { category: 'SP500', label: 'עוקב מדד S&P 500', realReturnPct: 5.5, riskLevel: 6 },
  { category: 'BONDS', label: 'אג"ח', realReturnPct: 2.0, riskLevel: 2 },
  { category: 'MONEY_MARKET', label: 'שקלי / כספית', realReturnPct: 1.0, riskLevel: 1 },
  { category: 'HALACHA', label: 'הלכה', realReturnPct: 3.5, riskLevel: 4 },
] as const;

export interface TrackAllocation {
  category: string;
  /** % מהצבירה במסלול */
  pct: number;
}

/**
 * תשואה אפקטיבית משוקללת של מוצר לפי הקצאת המסלולים שלו.
 * אם ההקצאה אינה מכסה 100% — היתרה מחושבת לפי תשואת ברירת המחדל (fallback).
 */
export function weightedReturnPct(
  allocations: TrackAllocation[],
  fallbackPct: number,
): number {
  const valid = allocations.filter((a) => a.pct > 0);
  const totalPct = valid.reduce((s, a) => s + a.pct, 0);
  if (totalPct > 100.0001) {
    throw new Error(`סך אחוזי המסלולים עולה על 100% (${totalPct}%)`);
  }
  let weighted = 0;
  for (const a of valid) {
    const def = TRACK_DEFS.find((t) => t.category === a.category);
    if (!def) throw new Error(`מסלול השקעה לא מוכר: ${a.category}`);
    weighted += (def.realReturnPct * a.pct) / 100;
  }
  // היתרה שלא הוקצתה — לפי הנחת ברירת המחדל של התיק
  weighted += (fallbackPct * (100 - totalPct)) / 100;
  return Math.round(weighted * 100) / 100;
}
