import { projectBalance } from './projection';
import { annuityFromBalance } from './annuity';
import { weightedReturnPct } from './tracks';
import { calcNiOldAge } from './national-insurance';
import type {
  PortfolioInput,
  PortfolioProductInput,
  PortfolioProductResult,
  PortfolioResult,
  PortfolioScenarioTotals,
  ProductType,
  ScenarioTriple,
} from './types';

/** מוצרים קצבתיים — בפרישה משולמים כקצבה חודשית לפי מקדם המרה */
const ANNUITY_TYPES: ReadonlySet<ProductType> = new Set([
  'PENSION_COMPREHENSIVE',
  'PENSION_GENERAL',
  'MANAGERS_INSURANCE',
  'PROVIDENT_FUND',
]);

/**
 * תקרות דמי ניהול חוקיות לפי סוג מוצר (מפרט 4.4 — פרמטרים).
 * פנסיה: 6% / 0.5% · גמל וביטוח: 4% / 1.05% · השתלמות: 2% מצבירה בלבד.
 */
const FEE_CAPS: Record<ProductType, { deposit: number; balance: number }> = {
  PENSION_COMPREHENSIVE: { deposit: 6, balance: 0.5 },
  PENSION_GENERAL: { deposit: 6, balance: 0.5 },
  MANAGERS_INSURANCE: { deposit: 4, balance: 1.05 },
  PROVIDENT_FUND: { deposit: 4, balance: 1.05 },
  PROVIDENT_INVESTMENT: { deposit: 4, balance: 1.05 },
  IRA: { deposit: 4, balance: 1.05 },
  STUDY_FUND: { deposit: 0, balance: 2 },
  // ביטוח טהור — אין צבירה ואין דמי ניהול; נכלל רק בתרחישי ביטוח
  DISABILITY_INSURANCE: { deposit: 0, balance: 0 },
};

/**
 * חישוב תיק פנסיוני שלם: הקרנה לכל מוצר, קצבה למוצרים קצבתיים,
 * וסיכום מצרפי לשלושת התרחישים.
 */
export function calcPortfolio(input: PortfolioInput): PortfolioResult {
  if (!input.products?.length) {
    throw new Error('התיק ריק — יש להוסיף לפחות מוצר אחד');
  }

  const products = input.products.map((p) => calcProduct(p, input));

  // שכר צפוי בעת הפרישה — הבסיס לשיעור התחלופה (השכר צמוד לעליית השכר הריאלית)
  const salaryAtRetirement =
    input.insuredMonthlySalary && input.insuredMonthlySalary > 0
      ? input.insuredMonthlySalary *
        Math.pow(1 + input.annualSalaryGrowthPct / 100, input.months / 12)
      : null;

  // קצבת אזרח ותיק — זהה בכל שלושת התרחישים (אינה תלוית שוק)
  const niOldAgeMonthly = input.nationalInsurance?.include
    ? calcNiOldAge({
        insuranceYears: input.nationalInsurance.insuranceYears,
        spouseSupplementEligible:
          input.nationalInsurance.spouseSupplementEligible ?? false,
      }).monthly
    : 0;

  const totals = {
    pessimistic: aggregate(products, 'pessimistic', salaryAtRetirement, niOldAgeMonthly),
    central: aggregate(products, 'central', salaryAtRetirement, niOldAgeMonthly),
    optimistic: aggregate(products, 'optimistic', salaryAtRetirement, niOldAgeMonthly),
  };

  return {
    products,
    totals,
    trace: {
      formula:
        'totalBalance = Σ projection(product); totalMonthlyAnnuity = Σ balance/factor (annuity products); totalLumpSum = Σ balance (capital products)',
      inputs: {
        months: input.months,
        annualReturnPct: input.annualReturnPct,
        annualSalaryGrowthPct: input.annualSalaryGrowthPct,
        productCount: input.products.length,
      },
      notes: [
        'כל מוצר מוקרן בנפרד לפי דמי הניהול והכיסויים שלו',
        'מוצרים קצבתיים (פנסיה, ביטוח מנהלים, גמל) מומרים לקצבה לפי מקדם ההמרה',
        'מוצרים הוניים (השתלמות, גמל להשקעה, IRA) נספרים כהון חד-פעמי נזיל',
        'תקרות דמי ניהול נאכפות לפי סוג המוצר',
      ],
    },
  };
}

function calcProduct(
  p: PortfolioProductInput,
  portfolio: PortfolioInput,
): PortfolioProductResult {
  validateProduct(p);
  const isAnnuity = ANNUITY_TYPES.has(p.type);

  // סדר עדיפות לתשואה: עקיפה מפורשת > הקצאת מסלולים משוקללת > הנחת התיק
  const effectiveReturnPct =
    p.annualReturnPct ??
    (p.trackAllocations && p.trackAllocations.length > 0
      ? weightedReturnPct(p.trackAllocations, portfolio.annualReturnPct)
      : portfolio.annualReturnPct);

  const projection = projectBalance({
    currentBalance: p.currentBalance,
    monthlyDeposit: p.monthlyDeposit,
    feeFromDepositPct: p.feeFromDepositPct,
    feeFromBalancePct: p.feeFromBalancePct,
    monthlyCoverageCost: p.monthlyCoverageCost,
    annualReturnPct: effectiveReturnPct,
    annualSalaryGrowthPct: portfolio.annualSalaryGrowthPct,
    months: portfolio.months,
  });

  let monthlyAnnuity: ScenarioTriple | undefined;
  if (isAnnuity) {
    if (!p.conversionFactor || p.conversionFactor <= 0) {
      throw new Error(`"${p.name}": מוצר קצבתי דורש מקדם המרה חיובי`);
    }
    const factor = p.conversionFactor;
    monthlyAnnuity = {
      pessimistic: annuityFromBalance({
        balanceAtRetirement: projection.pessimistic.finalBalance,
        conversionFactor: factor,
      }).monthlyAnnuity,
      central: annuityFromBalance({
        balanceAtRetirement: projection.central.finalBalance,
        conversionFactor: factor,
      }).monthlyAnnuity,
      optimistic: annuityFromBalance({
        balanceAtRetirement: projection.optimistic.finalBalance,
        conversionFactor: factor,
      }).monthlyAnnuity,
    };
  }

  return { id: p.id, name: p.name, type: p.type, isAnnuity, projection, monthlyAnnuity };
}

function aggregate(
  products: PortfolioProductResult[],
  scenario: 'pessimistic' | 'central' | 'optimistic',
  salaryAtRetirement: number | null,
  niOldAgeMonthly: number,
): PortfolioScenarioTotals {
  let totalBalance = 0;
  let totalMonthlyAnnuity = 0;
  let totalLumpSum = 0;
  let totalFeesPaid = 0;

  // סדרה מצרפית: סכימת הצבירה של כל המוצרים בכל נקודת זמן
  // (לכל המוצרים אותם חודשים — אותו מספר נקודות)
  const seriesMap = new Map<number, number>();

  for (const p of products) {
    const s = p.projection[scenario];
    totalBalance += s.finalBalance;
    totalFeesPaid += s.totalFeesPaid;
    if (p.isAnnuity && p.monthlyAnnuity) {
      totalMonthlyAnnuity += p.monthlyAnnuity[scenario];
    } else {
      totalLumpSum += s.finalBalance;
    }
    for (const pt of s.series) {
      seriesMap.set(pt.month, (seriesMap.get(pt.month) ?? 0) + pt.balance);
    }
  }

  const series = [...seriesMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([month, balance]) => ({ month, balance: round2(balance) }));

  return {
    totalBalance: round2(totalBalance),
    series,
    totalMonthlyAnnuity: round2(totalMonthlyAnnuity),
    niOldAgeMonthly: round2(niOldAgeMonthly),
    totalLumpSum: round2(totalLumpSum),
    totalFeesPaid: round2(totalFeesPaid),
    // שיעור התחלופה כולל את קצבת אזרח ותיק — התמונה האמיתית של ההכנסה בפרישה
    replacementRatePct: salaryAtRetirement
      ? Math.round(((totalMonthlyAnnuity + niOldAgeMonthly) / salaryAtRetirement) * 1000) /
        10
      : null,
  };
}

function validateProduct(p: PortfolioProductInput): void {
  const caps = FEE_CAPS[p.type];
  if (!caps) {
    throw new Error(`"${p.name}": סוג מוצר לא נתמך: ${p.type}`);
  }
  if (p.feeFromDepositPct < 0 || p.feeFromDepositPct > caps.deposit) {
    throw new Error(
      `"${p.name}": דמי ניהול מהפקדה ${p.feeFromDepositPct}% מעל התקרה החוקית (${caps.deposit}%) לסוג מוצר זה`,
    );
  }
  if (p.feeFromBalancePct < 0 || p.feeFromBalancePct > caps.balance) {
    throw new Error(
      `"${p.name}": דמי ניהול מצבירה ${p.feeFromBalancePct}% מעל התקרה החוקית (${caps.balance}%) לסוג מוצר זה`,
    );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
