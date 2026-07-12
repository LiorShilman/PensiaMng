import type { CalcTrace } from './types';

/**
 * עזיבת עבודה (מפרט 5.4) — ההחלטה על רכיב הפיצויים:
 * משיכה היום מול השארה ברצף קצבה.
 *
 * שלושת מחירי המשיכה:
 * 1. מס על החלק שמעל תקרת הפטור (לפי המס השולי; פריסה עד 6 שנים — הערה).
 * 2. אובדן הקצבה העתידית — הפיצויים הם עד ~35-40% מהקצבה.
 * 3. פגיעה עתידית בקיבוע הזכויות — המענק הפטור נכנס לנוסחת הקיזוז (×1.35).
 *
 * הערכים מנוהלים כפרמטרים; פישוטים מוצהרים: פריסת מס אינה מחושבת,
 * הצמדת מענקים למדד אינה ממודלת, רצף זכויות (חלופה שלישית) — הערה בלבד.
 */

// ---------- פרמטרים (2025 — לאימות) ----------

/** תקרת הפיצויים הפטורה לשנת ותק (₪) */
export const SEVERANCE_EXEMPT_CEILING_PER_YEAR = 13_750;

/** מכפיל הקיזוז בנוסחת קיבוע הזכויות */
const KIBUA_OFFSET_MULTIPLIER = 1.35;

export interface JobExitInput {
  /** יתרת רכיב הפיצויים (₪) */
  severanceBalance: number;
  /** שנות ותק אצל המעסיק */
  yearsOfService: number;
  /** שכר חודשי אחרון (ברוטו) — בסיס תקרת הפטור */
  lastMonthlySalary: number;
  /** שנים עד הפרישה */
  yearsToRetirement: number;
  /** תשואה ריאלית שנתית (%) */
  annualReturnPct: number;
  /** מקדם המרה בפרישה */
  conversionFactor: number;
  /** מס שולי על החלק החייב (%) */
  marginalTaxRatePct: number;
  paramsOverride?: { exemptCeilingPerYear?: number };
}

export interface JobExitResult {
  /** החלק הפטור ממס במשיכה היום */
  exemptAmount: number;
  /** החלק החייב במס */
  taxableAmount: number;
  /** המס המוערך על החלק החייב */
  taxOnTaxable: number;
  /** נטו במשיכה היום */
  netToday: number;
  /** הצבירה בפרישה אם משאירים (רצף קצבה) */
  balanceAtRetirement: number;
  /** תוספת הקצבה החודשית שאובדת במשיכה */
  monthlyAnnuityLoss: number;
  /** הפגיעה בהון הפטור העתידי (קיבוע זכויות): פטור שנוצל × 1.35 */
  kibuaExemptCapitalLoss: number;
  /** שקילות: הפטור החודשי העתידי שאובד (הפגיעה ÷ 180) */
  kibuaMonthlyExemptionLoss: number;
  warnings: string[];
  trace: CalcTrace;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcJobExit(input: JobExitInput): JobExitResult {
  if (!(input.severanceBalance >= 0)) throw new Error('יתרת פיצויים לא תקינה');
  if (!(input.yearsOfService > 0)) throw new Error('שנות ותק חייבות להיות חיוביות');
  if (!(input.conversionFactor > 0)) throw new Error('מקדם המרה חייב להיות חיובי');
  if (input.yearsToRetirement < 0) throw new Error('שנים עד פרישה לא תקינות');

  const ceiling =
    input.paramsOverride?.exemptCeilingPerYear ?? SEVERANCE_EXEMPT_CEILING_PER_YEAR;

  // הפטור: שכר אחרון (עד התקרה) × שנות ותק
  const exemptPerYear = Math.min(input.lastMonthlySalary, ceiling);
  const exemptCap = round2(exemptPerYear * input.yearsOfService);
  const exemptAmount = round2(Math.min(input.severanceBalance, exemptCap));
  const taxableAmount = round2(input.severanceBalance - exemptAmount);
  const taxOnTaxable = round2(taxableAmount * (input.marginalTaxRatePct / 100));
  const netToday = round2(input.severanceBalance - taxOnTaxable);

  // רצף קצבה: הכסף ממשיך לצבור תשואה עד הפרישה
  const balanceAtRetirement = round2(
    input.severanceBalance *
      Math.pow(1 + input.annualReturnPct / 100, input.yearsToRetirement),
  );
  const monthlyAnnuityLoss = round2(balanceAtRetirement / input.conversionFactor);

  // הפגיעה בקיבוע: המענק הפטור שנמשך מקזז פי 1.35 מההון הפטור בפרישה
  const kibuaExemptCapitalLoss = round2(exemptAmount * KIBUA_OFFSET_MULTIPLIER);
  const kibuaMonthlyExemptionLoss = round2(kibuaExemptCapitalLoss / 180);

  const warnings: string[] = [
    `משיכת הפיצויים מוחקת קצבה של ${monthlyAnnuityLoss.toLocaleString('he-IL')} ₪ לחודש לכל החיים — רכיב הפיצויים הוא עד כ-40% מהקצבה הצפויה`,
    `הפטור שינוצל היום (${exemptAmount.toLocaleString('he-IL')} ₪) יקטין את ההון הפטור בקיבוע הזכויות ב-${kibuaExemptCapitalLoss.toLocaleString('he-IL')} ₪ (נוסחת הקיזוז ×1.35) — שווה ערך לאובדן פטור של ${kibuaMonthlyExemptionLoss.toLocaleString('he-IL')} ₪/חודש על הקצבה`,
    'רצף קצבה הוא ברירת המחדל כיום — לא נדרשת פעולה; משיכה דורשת טופס 161 והחלטה אקטיבית',
    'קיימת גם חלופת "רצף זכויות" (דחיית ההתחשבנות למעסיק הבא) — מורכבת יותר ואינה מחושבת כאן',
  ];
  if (taxableAmount > 0) {
    warnings.push(
      `החלק שמעל התקרה (${taxableAmount.toLocaleString('he-IL')} ₪) חייב במס — ניתן לבקש פריסה עד 6 שנים להקטנת המס (לא מחושב)`,
    );
  }
  warnings.push(
    'בעזיבה ללא עבודה חדשה: הכיסוי הביטוחי נשמר אוטומטית 5 חודשים; ניתן להאריך בהסדר ריסק זמני עד 24 חודשים — אל תישאר בלי כיסוי',
    'החלטה מהותית ובלתי הפיכה ברובה — מומלץ ייעוץ לפני חתימה על טופס 161',
  );

  return {
    exemptAmount,
    taxableAmount,
    taxOnTaxable,
    netToday,
    balanceAtRetirement,
    monthlyAnnuityLoss,
    kibuaExemptCapitalLoss,
    kibuaMonthlyExemptionLoss,
    warnings,
    trace: {
      formula:
        'exempt = min(balance, min(salary, ceiling) × years) ; netToday = balance − taxable × marginal ; annuityLoss = balance × (1+r)^n ÷ factor ; kibuaLoss = exempt × 1.35',
      inputs: {
        severanceBalance: input.severanceBalance,
        yearsOfService: input.yearsOfService,
        lastMonthlySalary: input.lastMonthlySalary,
        exemptCeilingPerYear: ceiling,
        yearsToRetirement: input.yearsToRetirement,
        annualReturnPct: input.annualReturnPct,
        conversionFactor: input.conversionFactor,
        marginalTaxRatePct: input.marginalTaxRatePct,
      },
      notes: [
        'תקרת הפטור 13,750 ₪ לשנת ותק (2025) — לאימות מול רשות המסים',
        'פריסת מס והצמדות אינן מחושבות בשלב זה',
        'ההשוואה בערכים ריאליים',
      ],
    },
  };
}
