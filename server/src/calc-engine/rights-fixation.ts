import type { CalcTrace } from './types';

/**
 * קיבוע זכויות (סעיף 9א לפקודה, תיקון 190) — טופס 161ד.
 *
 * בגיל הזכאות (גיל פרישה + התחלת קצבה) בוחר הפורש איך לנצל את
 * "ההון הפטור" שלו: פטור על הקצבה החודשית, היוון פטור (משיכת הון),
 * או שילוב. הבחירה חד-פעמית וכמעט בלתי-הפיכה.
 *
 * המנוע מחשב במדויק; ה-AI מסביר וממליץ בלבד (עקרון המערכת).
 * הערכים הרגולטוריים נטענים מטבלת RegulatoryParameter כשקיימים —
 * הערכים כאן הם ברירות מחדל מתועדות.
 */

// ---------- פרמטרים רגולטוריים (ברירות מחדל בקוד; עדכון שוטף ב-DB) ----------

/** תקרת הקצבה המזכה (₪ לחודש) לפי שנה — מתעדכנת בינואר לפי מדד */
export const ANNUITY_CEILING_BY_YEAR: Record<number, number> = {
  2020: 8_510,
  2021: 8_460,
  2022: 8_660,
  2023: 9_120,
  2024: 9_430,
  2025: 9_430,
  // שנים מאוחרות: הערך האחרון הידוע (יש לעדכן דרך RegulatoryParameter)
};

/**
 * אחוז הפטור על הקצבה המזכה — מדרגות תיקון 190, כפי שעודכנו בחקיקה
 * מאוחרת שפרסה את העלייה ל-67%: 57% ב-2026, 62.5% ב-2027, 67% מ-2028.
 */
export const EXEMPTION_PCT_PERIODS: { from: number; to: number; pct: number }[] = [
  { from: 2012, to: 2015, pct: 43.5 },
  { from: 2016, to: 2019, pct: 49 },
  { from: 2020, to: 2025, pct: 52 },
  { from: 2026, to: 2026, pct: 57 },
  { from: 2027, to: 2027, pct: 62.5 },
  { from: 2028, to: 9999, pct: 67 },
];

/** מקדם ההיוון הקבוע בחוק: הון פטור ⇄ פטור חודשי */
export const FIXATION_FACTOR = 180;

/** מכפיל הקיזוז על מענקים פטורים שנמשכו בעבר */
export const GRANT_OFFSET_MULTIPLIER = 1.35;

/** חלון השנים שבו מענקי עבר פוגעים בהון הפטור */
export const GRANT_WINDOW_YEARS = 32;

export interface RightsFixationParams {
  /** תקרת קצבה מזכה חודשית (₪) בשנת הזכאות */
  annuityCeilingMonthly: number;
  /** אחוז הפטור בשנת הזכאות */
  exemptionPct: number;
  factor: number;
  offsetMultiplier: number;
  grantWindowYears: number;
}

/** הפרמטרים לשנת זכאות נתונה — מברירות המחדל בקוד */
export function defaultParamsFor(eligibilityYear: number): RightsFixationParams {
  const knownYears = Object.keys(ANNUITY_CEILING_BY_YEAR).map(Number);
  const latestKnown = Math.max(...knownYears);
  const ceiling =
    ANNUITY_CEILING_BY_YEAR[eligibilityYear] ??
    ANNUITY_CEILING_BY_YEAR[Math.min(eligibilityYear, latestKnown)] ??
    ANNUITY_CEILING_BY_YEAR[latestKnown];
  const period = EXEMPTION_PCT_PERIODS.find(
    (p) => eligibilityYear >= p.from && eligibilityYear <= p.to,
  );
  if (!period) {
    throw new Error(`קיבוע זכויות אינו רלוונטי לשנת ${eligibilityYear} (לפני תיקון 190)`);
  }
  return {
    annuityCeilingMonthly: ceiling,
    exemptionPct: period.pct,
    factor: FIXATION_FACTOR,
    offsetMultiplier: GRANT_OFFSET_MULTIPLIER,
    grantWindowYears: GRANT_WINDOW_YEARS,
  };
}

// ---------- קלט/פלט ----------

export interface PastGrant {
  /** שנת קבלת המענק הפטור */
  year: number;
  /** סכום המענק הפטור, צמוד למדד ליום הזכאות (הזנה ידנית בשלב זה) */
  amount: number;
  /** שם מעסיק — לתיעוד */
  employer?: string;
}

export interface RightsFixationInput {
  /** שנת גיל הזכאות (פרישה + התחלת קצבה) */
  eligibilityYear: number;
  /** הקצבה החודשית הצפויה (ברוטו, ₪) */
  expectedMonthlyPension: number;
  /** מענקים פטורים שנמשכו בעבר (פיצויים בפטור) */
  pastGrants?: PastGrant[];
  /** תרחיש מותאם: כמה הון למשוך בהיוון פטור (₪) */
  desiredLumpSum?: number;
  /** שיעור מס שולי צפוי על הקצבה (%) — להערכת החיסכון בלבד */
  marginalTaxRatePct?: number;
  /** עקיפת פרמטרים (נטען מ-RegulatoryParameter כשקיים) */
  paramsOverride?: Partial<RightsFixationParams>;
}

export interface FixationScenario {
  key: 'full_pension' | 'max_lump_sum' | 'custom';
  label: string;
  /** היוון פטור — סכום ההון שנמשך (₪) */
  lumpSum: number;
  /** הפטור החודשי על הקצבה (₪) */
  monthlyExemption: number;
  /** הקצבה החייבת במס אחרי הפטור (₪) */
  taxableMonthlyPension: number;
  /** הערכת חיסכון מס חודשי לפי השיעור השולי שנמסר (₪) */
  estMonthlyTaxSaved: number | null;
  detail: string;
}

export interface RightsFixationResult {
  params: RightsFixationParams;
  /** ההון הפטור המלא לשנת הזכאות (₪) */
  exemptCapitalCeiling: number;
  /** מענקים שנספרו בחלון 32 השנים (₪, לפני מכפיל) */
  countedGrantsTotal: number;
  /** הקיזוז: מענקים × 1.35 (₪) */
  grantOffset: number;
  /** יתרת ההון הפטורה לניצול (₪) */
  remainingExemptCapital: number;
  scenarios: FixationScenario[];
  warnings: string[];
  trace: CalcTrace;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- חישוב ----------

export function calcRightsFixation(input: RightsFixationInput): RightsFixationResult {
  if (!Number.isFinite(input.eligibilityYear) || input.eligibilityYear < 2012) {
    throw new Error('שנת זכאות לא תקינה — קיבוע זכויות חל מ-2012 (תיקון 190)');
  }
  if (!(input.expectedMonthlyPension >= 0)) {
    throw new Error('קצבה חודשית צפויה לא תקינה');
  }

  const params: RightsFixationParams = {
    ...defaultParamsFor(input.eligibilityYear),
    ...input.paramsOverride,
  };

  const warnings: string[] = [];

  // ההון הפטור המלא: תקרה × אחוז פטור × 180
  const exemptCapitalCeiling = round2(
    params.annuityCeilingMonthly * (params.exemptionPct / 100) * params.factor,
  );

  // נוסחת הקיזוז: מענקים פטורים בחלון 32 השנים × 1.35
  const windowStart = input.eligibilityYear - params.grantWindowYears;
  const counted = (input.pastGrants ?? []).filter((g) => g.year >= windowStart);
  const ignored = (input.pastGrants ?? []).filter((g) => g.year < windowStart);
  const countedGrantsTotal = round2(counted.reduce((s, g) => s + g.amount, 0));
  const grantOffset = round2(countedGrantsTotal * params.offsetMultiplier);
  if (ignored.length > 0) {
    warnings.push(
      `${ignored.length} מענקים מלפני ${windowStart} אינם פוגעים בהון הפטור (מחוץ לחלון ${params.grantWindowYears} השנים)`,
    );
  }
  if (counted.length > 0) {
    warnings.push(
      'סכומי המענקים חייבים להיות צמודים למדד ליום הזכאות — ודא מול טופסי 161 שברשותך',
    );
  }

  const remainingExemptCapital = round2(Math.max(0, exemptCapitalCeiling - grantOffset));
  if (grantOffset > exemptCapitalCeiling) {
    warnings.push('המענקים הפטורים שנמשכו מוחקים את מלוא ההון הפטור — הפטור על הקצבה אפסי');
  }

  const rate =
    input.marginalTaxRatePct !== undefined && input.marginalTaxRatePct > 0
      ? input.marginalTaxRatePct / 100
      : null;

  /** בניית תרחיש: כמה הון מהיתרה מופנה להיוון, והשאר לפטור חודשי */
  const buildScenario = (
    key: FixationScenario['key'],
    label: string,
    lumpSum: number,
    detail: string,
  ): FixationScenario => {
    const capitalForPension = Math.max(0, remainingExemptCapital - lumpSum);
    // הפטור החודשי מוגבל גם בקצבה עצמה
    const monthlyExemption = round2(
      Math.min(capitalForPension / params.factor, input.expectedMonthlyPension),
    );
    const taxableMonthlyPension = round2(
      Math.max(0, input.expectedMonthlyPension - monthlyExemption),
    );
    return {
      key,
      label,
      lumpSum: round2(lumpSum),
      monthlyExemption,
      taxableMonthlyPension,
      estMonthlyTaxSaved: rate !== null ? round2(monthlyExemption * rate) : null,
      detail,
    };
  };

  const scenarios: FixationScenario[] = [
    buildScenario(
      'full_pension',
      'כל הפטור על הקצבה',
      0,
      `כל היתרה הפטורה מופנית לפטור חודשי: ${round2(remainingExemptCapital / params.factor).toLocaleString('he-IL')} ₪ לחודש פטורים ממס, לכל החיים`,
    ),
    buildScenario(
      'max_lump_sum',
      'היוון פטור מקסימלי',
      remainingExemptCapital,
      'משיכת מלוא היתרה הפטורה כהון פטור ממס — הקצבה כולה תחויב במס. בכפוף לצבירה זמינה להיוון בפועל',
    ),
  ];

  if (input.desiredLumpSum !== undefined && input.desiredLumpSum > 0) {
    const lump = Math.min(input.desiredLumpSum, remainingExemptCapital);
    if (input.desiredLumpSum > remainingExemptCapital) {
      warnings.push(
        `ההיוון המבוקש גדול מהיתרה הפטורה — הוגבל ל-${remainingExemptCapital.toLocaleString('he-IL')} ₪`,
      );
    }
    scenarios.push(
      buildScenario(
        'custom',
        'שילוב מותאם',
        lump,
        `היוון פטור של ${round2(lump).toLocaleString('he-IL')} ₪ והיתרה לפטור חודשי`,
      ),
    );
  }

  // הקצבה נמוכה מתקרת הפטור — הפטור החודשי "מתבזבז" חלקית
  const fullPensionScenario = scenarios[0];
  if (
    fullPensionScenario.monthlyExemption === input.expectedMonthlyPension &&
    remainingExemptCapital / params.factor > input.expectedMonthlyPension
  ) {
    warnings.push(
      'הקצבה הצפויה נמוכה מתקרת הפטור החודשי — חלק מההון הפטור לא ינוצל בפטור על הקצבה; שקול היוון של העודף',
    );
  }

  warnings.push(
    'קיבוע זכויות (טופס 161ד) הוא בחירה חד-פעמית וכמעט בלתי-הפיכה — חובה להתייעץ עם יועץ מס/מתכנן פרישה מוסמך לפני הגשה',
  );

  const trace: CalcTrace = {
    formula:
      'exemptCapital = ceiling × pct × 180 ; offset = Σgrants(32y) × 1.35 ; remaining = exemptCapital − offset ; monthlyExemption = (remaining − lumpSum) ÷ 180',
    inputs: {
      eligibilityYear: input.eligibilityYear,
      annuityCeilingMonthly: params.annuityCeilingMonthly,
      exemptionPct: params.exemptionPct,
      factor: params.factor,
      offsetMultiplier: params.offsetMultiplier,
      expectedMonthlyPension: input.expectedMonthlyPension,
      countedGrantsTotal,
    },
    notes: [
      `הון פטור מלא: ${exemptCapitalCeiling.toLocaleString('he-IL')} ₪`,
      `קיזוז מענקי עבר: ${grantOffset.toLocaleString('he-IL')} ₪`,
      `יתרה פטורה לניצול: ${remainingExemptCapital.toLocaleString('he-IL')} ₪`,
      'קצבה מוכרת (כספי תיקון 190 שלא נוצל בגינם פטור) אינה ממודלת בשלב זה',
      'הצמדת מענקי עבר למדד — באחריות המשתמש בשלב זה',
    ],
  };

  return {
    params,
    exemptCapitalCeiling,
    countedGrantsTotal,
    grantOffset,
    remainingExemptCapital,
    scenarios,
    warnings,
    trace,
  };
}
