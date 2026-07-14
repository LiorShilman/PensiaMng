import type { CalcTrace } from './types';
import { annualToMonthlyRate } from './projection';

/**
 * הלוואה מקרן הפנסיה מול הלוואה חלופית (בנק/גורם אחר) — משווה את עלות
 * הריבית הכוללת, ובנוסף (אם רלוונטי) את עלות ההזדמנות של חסימת הסכום
 * המשועבד מלהמשיך לצבור תשואה בזמן ההלוואה — הבדל אמיתי בין הלוואת
 * קרן להלוואה רגילה, שקל מבוסס לפספס.
 */

export interface FundLoanInput {
  loanAmount: number;
  months: number;
  fundLoanAnnualRatePct: number;
  alternativeAnnualRatePct: number;
  /** האם הסכום המשועבד להלוואה מפסיק לצבור תשואה בזמן ההלוואה */
  collateralFrozen: boolean;
  /** תשואה ריאלית שנתית מונחת — לחישוב עלות ההזדמנות אם collateralFrozen */
  annualReturnPct: number;
}

interface LoanBreakdown {
  monthlyPayment: number;
  totalRepaid: number;
  totalInterest: number;
}

export interface FundLoanResult {
  fundLoan: LoanBreakdown & { opportunityCost: number; totalCost: number };
  alternativeLoan: LoanBreakdown;
  totalCostGap: number;
  warnings: string[];
  trace: CalcTrace;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function amortize(principal: number, annualRatePct: number, months: number): LoanBreakdown {
  const r = annualRatePct / 100 / 12;
  const monthlyPayment =
    r === 0 ? principal / months : (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  const totalRepaid = monthlyPayment * months;
  return {
    monthlyPayment: round2(monthlyPayment),
    totalRepaid: round2(totalRepaid),
    totalInterest: round2(totalRepaid - principal),
  };
}

export function calcFundLoan(input: FundLoanInput): FundLoanResult {
  if (!(input.loanAmount > 0)) throw new Error('סכום ההלוואה חייב להיות חיובי');
  if (!(input.months > 0) || !Number.isInteger(input.months)) {
    throw new Error('מספר החודשים חייב להיות מספר שלם חיובי');
  }
  if (input.fundLoanAnnualRatePct < 0 || input.alternativeAnnualRatePct < 0) {
    throw new Error('שיעורי הריבית לא יכולים להיות שליליים');
  }

  const fundBreakdown = amortize(input.loanAmount, input.fundLoanAnnualRatePct, input.months);
  const alternativeBreakdown = amortize(input.loanAmount, input.alternativeAnnualRatePct, input.months);

  let opportunityCost = 0;
  if (input.collateralFrozen) {
    const monthlyInvestRate = annualToMonthlyRate(input.annualReturnPct);
    opportunityCost = round2(
      input.loanAmount * (Math.pow(1 + monthlyInvestRate, input.months) - 1),
    );
  }

  const fundTotalCost = round2(fundBreakdown.totalInterest + opportunityCost);
  const alternativeTotalCost = alternativeBreakdown.totalInterest;

  const warnings: string[] = [];
  if (input.collateralFrozen && opportunityCost > 0) {
    warnings.push(
      `הסכום המשועבד להלוואה חסום מלהמשיך לצבור תשואה — זו עלות נוספת של ${opportunityCost.toLocaleString('he-IL')} ₪ מעבר לריבית עצמה, שלא קיימת בהלוואה חיצונית רגילה`,
    );
  }
  if (fundTotalCost > alternativeTotalCost) {
    warnings.push('לפי הנתונים שהוזנו, ההלוואה החלופית זולה בסך הכול מהלוואת הקרן (כולל עלות ההזדמנות אם רלוונטי)');
  }

  return {
    fundLoan: { ...fundBreakdown, opportunityCost, totalCost: fundTotalCost },
    alternativeLoan: alternativeBreakdown,
    totalCostGap: round2(fundTotalCost - alternativeTotalCost),
    warnings,
    trace: {
      formula:
        'monthlyPayment = P×r×(1+r)^n / ((1+r)^n − 1) ; opportunityCost = loanAmount × ((1+r_invest)^n − 1) אם collateralFrozen',
      inputs: {
        loanAmount: input.loanAmount,
        months: input.months,
        fundLoanAnnualRatePct: input.fundLoanAnnualRatePct,
        alternativeAnnualRatePct: input.alternativeAnnualRatePct,
        collateralFrozen: String(input.collateralFrozen),
      },
      notes: [
        'לא כל מוצר פנסיוני מאפשר הלוואה — בדוק מול הגוף המנהל',
        'עלות ההזדמנות היא הערכה בלבד, תלויה בהנחת התשואה שהוזנה',
      ],
    },
  };
}
