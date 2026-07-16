import { projectBalance } from './projection';
import type { CalcTrace, ProductType } from './types';

/**
 * השוואת דמי ניהול לממוצעי השוק (מפרט 4.4 + 7.2) — "מחיר הפער".
 *
 * לכל מוצר: העלות השנתית העודפת מול הממוצע, והפער בצבירה בפרישה
 * (הקרנה עם דמי הניהול בפועל מול הקרנה עם ממוצע השוק).
 *
 * הממוצעים לפי פרסומי רשות שוק ההון (2024, מעוגלים) — לאימות ולעדכון
 * שנתי; מנוהלים גם ב-RegulatoryParameter.
 */

export interface MarketFeeBenchmark {
  deposit: number;
  balance: number;
}

/** ממוצעי שוק (2024 — לאימות): % מהפקדה / % שנתי מצבירה */
export const MARKET_AVG_FEES: Record<ProductType, MarketFeeBenchmark> = {
  PENSION_COMPREHENSIVE: { deposit: 1.4, balance: 0.19 },
  PENSION_GENERAL: { deposit: 1.4, balance: 0.25 },
  MANAGERS_INSURANCE: { deposit: 2.0, balance: 0.9 },
  PROVIDENT_FUND: { deposit: 0, balance: 0.54 },
  PROVIDENT_INVESTMENT: { deposit: 0, balance: 0.6 },
  IRA: { deposit: 0, balance: 0.25 },
  STUDY_FUND: { deposit: 0, balance: 0.55 },
  MONEY_MARKET_FUND: { deposit: 0, balance: 0.2 },
  // ביטוח טהור — אין דמי ניהול
  DISABILITY_INSURANCE: { deposit: 0, balance: 0 },
  LIFE_INSURANCE: { deposit: 0, balance: 0 },
};

export interface FeeComparisonProductInput {
  id: string;
  name: string;
  type: ProductType;
  currentBalance: number;
  monthlyDeposit: number;
  feeFromDepositPct: number;
  feeFromBalancePct: number;
}

export interface FeeComparisonInput {
  /** חודשים עד פרישה — לחישוב "מחיר הפער" */
  months: number;
  annualReturnPct: number;
  annualSalaryGrowthPct: number;
  products: FeeComparisonProductInput[];
  benchmarksOverride?: Partial<Record<ProductType, MarketFeeBenchmark>>;
}

export interface FeeComparisonProductResult {
  id: string;
  name: string;
  type: ProductType;
  actual: MarketFeeBenchmark;
  marketAvg: MarketFeeBenchmark;
  /** עלות שנתית עודפת מול הממוצע (₪, שלילי = זול מהממוצע) */
  annualExcessCost: number;
  /** הפער בצבירה בפרישה: ממוצע שוק פחות בפועל (₪, חיובי = הפסד) */
  gapAtRetirement: number;
  verdict: 'cheaper' | 'similar' | 'expensive';
  detail: string;
}

export interface FeeComparisonResult {
  products: FeeComparisonProductResult[];
  /** סך העלות השנתית העודפת בתיק */
  totalAnnualExcessCost: number;
  /** סך "מחיר הפער" בפרישה */
  totalGapAtRetirement: number;
  warnings: string[];
  trace: CalcTrace;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcFeeComparison(input: FeeComparisonInput): FeeComparisonResult {
  if (input.months <= 0) throw new Error('נדרשים חודשים עד פרישה חיוביים');

  const products = input.products
    .filter((p) => p.type !== 'DISABILITY_INSURANCE' && p.type !== 'LIFE_INSURANCE')
    .map((p): FeeComparisonProductResult => {
      const marketAvg =
        input.benchmarksOverride?.[p.type] ?? MARKET_AVG_FEES[p.type];
      if (!marketAvg) throw new Error(`אין נתוני שוק לסוג המוצר: ${p.type}`);

      // עלות שנתית עודפת: הפרש דמי הניהול על היתרה וההפקדות של היום
      const annualExcessCost = round2(
        (p.currentBalance * (p.feeFromBalancePct - marketAvg.balance)) / 100 +
          (p.monthlyDeposit * 12 * (p.feeFromDepositPct - marketAvg.deposit)) / 100,
      );

      // מחיר הפער: הקרנה עם הדמים בפועל מול הקרנה עם ממוצע השוק
      const common = {
        currentBalance: p.currentBalance,
        monthlyDeposit: p.monthlyDeposit,
        monthlyCoverageCost: 0,
        annualReturnPct: input.annualReturnPct,
        annualSalaryGrowthPct: input.annualSalaryGrowthPct,
        months: input.months,
      };
      const withActual = projectBalance({
        ...common,
        feeFromDepositPct: p.feeFromDepositPct,
        feeFromBalancePct: p.feeFromBalancePct,
      }).central.finalBalance;
      const withMarket = projectBalance({
        ...common,
        feeFromDepositPct: marketAvg.deposit,
        feeFromBalancePct: marketAvg.balance,
      }).central.finalBalance;
      const gapAtRetirement = round2(withMarket - withActual);

      const verdict: FeeComparisonProductResult['verdict'] =
        annualExcessCost > 100 ? 'expensive' : annualExcessCost < -100 ? 'cheaper' : 'similar';

      const detail =
        verdict === 'expensive'
          ? `יקר מממוצע השוק — עודף של ${annualExcessCost.toLocaleString('he-IL')} ₪ בשנה; עד הפרישה: פער של ${gapAtRetirement.toLocaleString('he-IL')} ₪`
          : verdict === 'cheaper'
            ? 'זול מממוצע השוק — שמור על התנאים האלה'
            : 'קרוב לממוצע השוק';

      return {
        id: p.id,
        name: p.name,
        type: p.type,
        actual: { deposit: p.feeFromDepositPct, balance: p.feeFromBalancePct },
        marketAvg,
        annualExcessCost,
        gapAtRetirement,
        verdict,
        detail,
      };
    });

  const totalAnnualExcessCost = round2(
    products.reduce((s, p) => s + p.annualExcessCost, 0),
  );
  const totalGapAtRetirement = round2(
    products.reduce((s, p) => s + p.gapAtRetirement, 0),
  );

  const warnings: string[] = [
    'ממוצעי השוק לפי פרסומי רשות שוק ההון (2024, מעוגלים) — לאימות מול גמל-נט/פנסיה-נט',
    'דמי ניהול נמוכים אינם חזות הכל — יש לשקול גם תשואות, שירות ואיכות הכיסויים',
  ];
  const expensive = products.filter((p) => p.verdict === 'expensive');
  if (expensive.length > 0) {
    warnings.push(
      `${expensive.length} מוצרים יקרים מהממוצע — מיקוח מול הגוף המנהל או השוואת הצעות עשויים לחסוך משמעותית (זכור: ניוד עלול לבטל הנחות קיימות)`,
    );
  }

  return {
    products,
    totalAnnualExcessCost,
    totalGapAtRetirement,
    warnings,
    trace: {
      formula:
        'annualExcess = balance × Δbalance% + deposits × Δdeposit% ; gapAtRetirement = FV(marketFees) − FV(actualFees)',
      inputs: {
        months: input.months,
        annualReturnPct: input.annualReturnPct,
        productCount: products.length,
      },
      notes: [
        'הפער בפרישה מחושב בתרחיש המרכזי',
        'מוצרי ביטוח טהורים אינם נכללים (אין דמי ניהול)',
      ],
    },
  };
}
