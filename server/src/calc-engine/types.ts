/**
 * PensiaMng calc engine — types.
 * מנוע החישוב הוא דטרמיניסטי וטהור (pure): אין תלות ב-DB או ב-IO.
 * כל תוצאה כוללת "עקבות חישוב" (trace) — הנוסחה, הקלטים והפרמטרים ששימשו.
 */

/** קלט להקרנת צבירה של מוצר יחיד */
export interface ProjectionInput {
  /** יתרה נוכחית בש"ח */
  currentBalance: number;
  /** הפקדה חודשית כוללת בש"ח (עובד+מעסיק+פיצויים / עצמאי) */
  monthlyDeposit: number;
  /** דמי ניהול מהפקדה, באחוזים (למשל 1.5 = 1.5%) */
  feeFromDepositPct: number;
  /** דמי ניהול מצבירה, אחוז שנתי (למשל 0.145) */
  feeFromBalancePct: number;
  /** עלות כיסויים ביטוחיים חודשית בש"ח (0 אם אין) */
  monthlyCoverageCost: number;
  /** תשואה שנתית ריאלית מונחת, באחוזים (למשל 3.74) */
  annualReturnPct: number;
  /** עליית שכר ריאלית שנתית באחוזים — ההפקדה צמודה לשכר */
  annualSalaryGrowthPct: number;
  /** מספר חודשים עד הפרישה */
  months: number;
}

/** נקודה בסדרת הצבירה לאורך זמן */
export interface SeriesPoint {
  /** חודשים מהיום (0 = היום) */
  month: number;
  balance: number;
}

/** תרחיש בודד בתוצאה */
export interface ProjectionScenario {
  /** התשואה השנתית ששימשה בתרחיש */
  annualReturnPct: number;
  /** צבירה צפויה בפרישה */
  finalBalance: number;
  /** סדרת הצבירה — נקודה בתחילת הדרך ובסוף כל שנה */
  series: SeriesPoint[];
  /** סך הפקדות (נטו, אחרי דמי ניהול מהפקדה) לאורך התקופה */
  totalNetDeposits: number;
  /** סך דמי ניהול ששולמו (מהפקדה + מצבירה) */
  totalFeesPaid: number;
  /** סך עלויות כיסויים */
  totalCoverageCost: number;
}

/** תוצאת הקרנה — שלושה תרחישים לפי המפרט (4.1): פסימי/מרכזי/אופטימי */
export interface ProjectionResult {
  pessimistic: ProjectionScenario;
  central: ProjectionScenario;
  optimistic: ProjectionScenario;
  trace: CalcTrace;
}

/** עקבות חישוב — שקיפות מלאה לכל תוצאה (מפרט סעיף 12) */
export interface CalcTrace {
  formula: string;
  inputs: Record<string, number | string>;
  notes: string[];
}

// ---------- תיק פנסיוני (מספר מוצרים) ----------

/** סוגי מוצרים הנתמכים במנוע — תואם ל-enum בסכמת Prisma */
export type ProductType =
  | 'PENSION_COMPREHENSIVE'
  | 'PENSION_GENERAL'
  | 'MANAGERS_INSURANCE'
  | 'PROVIDENT_FUND'
  | 'PROVIDENT_INVESTMENT'
  | 'IRA'
  | 'STUDY_FUND'
  | 'DISABILITY_INSURANCE'; // ביטוח אכ"ע פרטי / מטריה — ביטוח טהור

/** מוצר בודד בתוך תיק */
export interface PortfolioProductInput {
  id: string;
  name: string;
  type: ProductType;
  currentBalance: number;
  monthlyDeposit: number;
  feeFromDepositPct: number;
  feeFromBalancePct: number;
  monthlyCoverageCost: number;
  /** אופציונלי — עוקף את הנחת התשואה הגלובלית של התיק */
  annualReturnPct?: number;
  /**
   * הקצאת מסלולי השקעה — התשואה האפקטיבית נגזרת מהמסלולים (משוקללת).
   * annualReturnPct מפורש גובר על זה.
   */
  trackAllocations?: { category: string; pct: number }[];
  /** נדרש רק למוצרים קצבתיים */
  conversionFactor?: number;
}

/** קלט לחישוב תיק שלם */
export interface PortfolioInput {
  /** חודשים עד פרישה — משותף לכל התיק (אותו אדם) */
  months: number;
  annualSalaryGrowthPct: number;
  /** הנחת תשואה גלובלית; מוצר יכול לעקוף */
  annualReturnPct: number;
  /** שכר חודשי נוכחי — לחישוב שיעור תחלופה (אופציונלי) */
  insuredMonthlySalary?: number;
  products: PortfolioProductInput[];
}

/** ערכי קצבה לשלושת התרחישים */
export interface ScenarioTriple {
  pessimistic: number;
  central: number;
  optimistic: number;
}

/** תוצאת מוצר בודד בתוך התיק */
export interface PortfolioProductResult {
  id: string;
  name: string;
  type: ProductType;
  /** האם המוצר משלם קצבה (או נמשך כהון חד-פעמי) */
  isAnnuity: boolean;
  projection: ProjectionResult;
  /** קצבה חודשית לכל תרחיש — רק למוצרים קצבתיים */
  monthlyAnnuity?: ScenarioTriple;
}

/** סיכום מצרפי לתרחיש בודד */
export interface PortfolioScenarioTotals {
  /** סך צבירה בפרישה — כל המוצרים */
  totalBalance: number;
  /** סדרת הצבירה המצרפית של כל התיק */
  series: SeriesPoint[];
  /** סך קצבה חודשית — מוצרים קצבתיים בלבד */
  totalMonthlyAnnuity: number;
  /** הון נזיל חד-פעמי — מוצרים הוניים (השתלמות, גמל להשקעה, IRA) */
  totalLumpSum: number;
  /** סך דמי ניהול ששולמו לאורך התקופה */
  totalFeesPaid: number;
  /**
   * שיעור תחלופה: הקצבה החודשית הצפויה כאחוז מהשכר בעת הפרישה
   * (השכר הנוכחי צמוד לעליית השכר). המדד המרכזי בתכנון פנסיוני; יעד: 70%+.
   * null אם לא נמסר שכר.
   */
  replacementRatePct: number | null;
}

export interface PortfolioResult {
  products: PortfolioProductResult[];
  totals: {
    pessimistic: PortfolioScenarioTotals;
    central: PortfolioScenarioTotals;
    optimistic: PortfolioScenarioTotals;
  };
  trace: CalcTrace;
}

/** קלט לחישוב קצבה */
export interface AnnuityInput {
  /** צבירה בפרישה בש"ח */
  balanceAtRetirement: number;
  /** מקדם המרה (למשל 200.5) */
  conversionFactor: number;
}

export interface AnnuityResult {
  /** קצבה חודשית בש"ח */
  monthlyAnnuity: number;
  trace: CalcTrace;
}
