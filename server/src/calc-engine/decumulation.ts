import type { CalcTrace, SeriesPoint } from './types';

/**
 * משיכה הדרגתית בפרישה (Decumulation) — ניהול ההון הנזיל לצד הקצבה.
 *
 * שני חישובים משלימים:
 * 1. "כמה זמן יחזיק" — בהינתן משיכה חודשית, מתי ההון מתרוקן.
 * 2. "כמה אפשר למשוך" — המשיכה החודשית שמחזיקה בדיוק עד גיל היעד.
 *
 * בערכים ריאליים; הנחת התשואה בפרישה שמרנית יותר מתקופת הצבירה.
 * מס רווח הון על הרווחים במשיכה (למשל בגמל להשקעה) אינו ממודל — הערה.
 */

export interface DecumulationInput {
  /** ההון הנזיל בפרישה (₪) */
  capitalAtRetirement: number;
  /** גיל הפרישה (תחילת המשיכה) */
  retirementAge: number;
  /** תשואה ריאלית שנתית בתקופת הפרישה (%) — מומלץ שמרני */
  annualReturnPct: number;
  /** משיכה חודשית מבוקשת (₪) — לחישוב "כמה זמן יחזיק" */
  monthlyWithdrawal?: number;
  /** גיל היעד שההון צריך להחזיק עדיו — לחישוב המשיכה בת-קיימא */
  targetAge?: number;
}

export interface DecumulationResult {
  /** המשיכה בת-הקיימא: מחזיקה בדיוק עד גיל היעד (₪ לחודש) */
  sustainableMonthly: number | null;
  targetAge: number;
  /** בהינתן המשיכה המבוקשת: גיל אזילת ההון (null = לא נגמר לעולם) */
  depletionAge: number | null;
  monthsUntilDepletion: number | null;
  /** סך שיימשך עד האזילה/גיל היעד */
  totalWithdrawn: number;
  /** מסלול היתרה — נקודה בתחילת כל שנה (עד 40 שנה) */
  series: SeriesPoint[];
  warnings: string[];
  trace: CalcTrace;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcDecumulation(input: DecumulationInput): DecumulationResult {
  if (!(input.capitalAtRetirement >= 0)) throw new Error('הון לא תקין');
  if (input.retirementAge < 50 || input.retirementAge > 80) {
    throw new Error('גיל פרישה לא סביר');
  }
  const targetAge = input.targetAge ?? 90;
  if (targetAge <= input.retirementAge) {
    throw new Error('גיל היעד חייב להיות אחרי גיל הפרישה');
  }

  const r = Math.pow(1 + input.annualReturnPct / 100, 1 / 12) - 1;
  const B = input.capitalAtRetirement;
  const targetMonths = Math.round((targetAge - input.retirementAge) * 12);

  // משיכה בת-קיימא: PMT שמאפס את ההון בדיוק בגיל היעד
  let sustainableMonthly: number | null = null;
  if (B > 0) {
    sustainableMonthly =
      r === 0
        ? round2(B / targetMonths)
        : round2((B * r * Math.pow(1 + r, targetMonths)) / (Math.pow(1 + r, targetMonths) - 1));
  }

  // בהינתן משיכה מבוקשת: סימולציה חודשית עד אזילה (או תקרה של 40 שנה)
  const w = input.monthlyWithdrawal ?? sustainableMonthly ?? 0;
  const series: SeriesPoint[] = [{ month: 0, balance: round2(B) }];
  let balance = B;
  let months: number | null = null;
  let totalWithdrawn = 0;
  const MAX_MONTHS = 40 * 12;
  if (w > 0 && B > 0) {
    for (let m = 1; m <= MAX_MONTHS; m++) {
      balance = balance * (1 + r) - w;
      if (m % 12 === 0) series.push({ month: m, balance: round2(Math.max(0, balance)) });
      if (balance <= 0) {
        totalWithdrawn += w + balance; // המשיכה האחרונה חלקית
        months = m;
        break;
      }
      totalWithdrawn += w;
    }
    if (months === null && series[series.length - 1].month < MAX_MONTHS) {
      series.push({ month: MAX_MONTHS, balance: round2(Math.max(0, balance)) });
    }
  }

  const depletionAge =
    months !== null ? Math.round((input.retirementAge + months / 12) * 10) / 10 : null;

  const warnings: string[] = [
    'בערכים ריאליים; מס רווח הון על הרווחים במשיכה (רלוונטי לגמל להשקעה/השקעות) אינו ממודל',
    'בקרן השתלמות ובגמל להשקעה שהומרו לקצבה מגיל 60 — הרווח פטור ממס; משיכה הונית חייבת',
  ];
  if (months !== null && depletionAge !== null && depletionAge < targetAge) {
    warnings.push(
      `בקצב המשיכה המבוקש ההון אוזל בגיל ${depletionAge} — לפני גיל היעד (${targetAge}); שקול משיכה של עד ${sustainableMonthly?.toLocaleString('he-IL')} ₪ לחודש`,
    );
  }
  if (w > 0 && months === null) {
    warnings.push('בקצב המשיכה הזה ההון אינו אוזל גם אחרי 40 שנה — המשיכה נמוכה מהתשואה');
  }

  return {
    sustainableMonthly,
    targetAge,
    depletionAge,
    monthsUntilDepletion: months,
    totalWithdrawn: round2(totalWithdrawn),
    series,
    warnings,
    trace: {
      formula:
        'sustainable = B·r·(1+r)^N ÷ ((1+r)^N − 1) ; depletion: balance(m+1) = balance(m)·(1+r) − w',
      inputs: {
        capitalAtRetirement: B,
        retirementAge: input.retirementAge,
        annualReturnPct: input.annualReturnPct,
        monthlyWithdrawal: w,
        targetAge,
      },
      notes: ['תשואת פרישה שמרנית מומלצת: 1.5%–3% ריאלי', 'המסלול נבנה בסימולציה חודשית'],
    },
  };
}
