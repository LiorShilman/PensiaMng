import type { CalcTrace } from './types';
import { runScenario } from './projection';
import { annuityFromBalance } from './annuity';

/**
 * "כדאי לעבור קרן?" — משווה המשך במוצר הנוכחי מול מעבר למוצר מועמד:
 * הפרש צבירה בפרישה (בהנחות תשואה/שכר זהות, רק דמי הניהול שונים) +
 * הפרש קצבה חודשית (אם נמסרו מקדמי המרה) + אזהרות על מה שעלול ללכת
 * לאיבוד במעבר (מקדם מובטח, תקופת אכשרה מחדש) שאינן חלק מהחישוב עצמו.
 */

interface ProductTerms {
  feeFromDepositPct: number;
  feeFromBalancePct: number;
  conversionFactor?: number;
}

export interface FundSwitchInput {
  currentBalance: number;
  monthlyDeposit: number;
  monthlyCoverageCost: number;
  annualReturnPct: number;
  annualSalaryGrowthPct: number;
  months: number;
  current: ProductTerms;
  /** שם המוצר המועמד — לצורך תיאור בלבד */
  candidateName: string;
  candidate: ProductTerms;
  /** למוצר הנוכחי יש מקדם המרה מובטח (ביטוח מנהלים ישן) — הולך לאיבוד במעבר */
  currentHasGuaranteedFactor?: boolean;
  /** המעבר כרוך במעבר בין גופים מנהלים (לא רק מסלול) — עלול לאפס תקופת אכשרה */
  resetsQualifyingPeriod?: boolean;
}

export interface FundSwitchResult {
  currentBalanceAtRetirement: number;
  candidateBalanceAtRetirement: number;
  balanceGap: number;
  currentTotalFeesPaid: number;
  candidateTotalFeesPaid: number;
  currentMonthlyAnnuity: number | null;
  candidateMonthlyAnnuity: number | null;
  annuityGap: number | null;
  warnings: string[];
  trace: CalcTrace;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcFundSwitch(input: FundSwitchInput): FundSwitchResult {
  if (input.months <= 0) throw new Error('months חייב להיות חיובי');
  if (input.currentBalance < 0) throw new Error('currentBalance לא יכול להיות שלילי');

  const base = {
    currentBalance: input.currentBalance,
    monthlyDeposit: input.monthlyDeposit,
    monthlyCoverageCost: input.monthlyCoverageCost,
    annualReturnPct: input.annualReturnPct,
    annualSalaryGrowthPct: input.annualSalaryGrowthPct,
    months: input.months,
  };

  const currentScenario = runScenario(
    { ...base, feeFromDepositPct: input.current.feeFromDepositPct, feeFromBalancePct: input.current.feeFromBalancePct },
    input.annualReturnPct,
  );
  const candidateScenario = runScenario(
    { ...base, feeFromDepositPct: input.candidate.feeFromDepositPct, feeFromBalancePct: input.candidate.feeFromBalancePct },
    input.annualReturnPct,
  );

  const currentMonthlyAnnuity =
    input.current.conversionFactor && input.current.conversionFactor > 0
      ? annuityFromBalance({
          balanceAtRetirement: currentScenario.finalBalance,
          conversionFactor: input.current.conversionFactor,
        }).monthlyAnnuity
      : null;
  const candidateMonthlyAnnuity =
    input.candidate.conversionFactor && input.candidate.conversionFactor > 0
      ? annuityFromBalance({
          balanceAtRetirement: candidateScenario.finalBalance,
          conversionFactor: input.candidate.conversionFactor,
        }).monthlyAnnuity
      : null;

  const warnings: string[] = [];
  if (input.currentHasGuaranteedFactor) {
    warnings.push(
      'למוצר הנוכחי מקדם המרה מובטח — מעבר לגוף אחר מוותר על ההבטחה הזו לצמיתות, גם אם המקדם המועמד נראה דומה או טוב יותר היום',
    );
  }
  if (input.resetsQualifyingPeriod) {
    warnings.push(
      'מעבר בין גופים מנהלים עלול לאפס את תקופת האכשרה (60 חודשים) לכיסוי מצב רפואי קודם — בדוק מול הגוף המועמד לפני שמעבירים',
    );
  }
  if (candidateScenario.finalBalance < currentScenario.finalBalance) {
    warnings.push('לפי דמי הניהול שהוזנו, המעבר דווקא צפוי להקטין את הצבירה בפרישה — כדאי לבדוק את המספרים שוב');
  }

  return {
    currentBalanceAtRetirement: currentScenario.finalBalance,
    candidateBalanceAtRetirement: candidateScenario.finalBalance,
    balanceGap: round2(candidateScenario.finalBalance - currentScenario.finalBalance),
    currentTotalFeesPaid: currentScenario.totalFeesPaid,
    candidateTotalFeesPaid: candidateScenario.totalFeesPaid,
    currentMonthlyAnnuity,
    candidateMonthlyAnnuity,
    annuityGap:
      currentMonthlyAnnuity != null && candidateMonthlyAnnuity != null
        ? round2(candidateMonthlyAnnuity - currentMonthlyAnnuity)
        : null,
    warnings,
    trace: {
      formula:
        'שתי הקרנות מוקרנות באותה נוסחת צבירה (projection.ts) עם אותה תשואה/שכר/הפקדה — רק דמי הניהול שונים בין current ל-candidate',
      inputs: {
        currentBalance: input.currentBalance,
        monthlyDeposit: input.monthlyDeposit,
        months: input.months,
        currentFeeFromDeposit: input.current.feeFromDepositPct,
        currentFeeFromBalance: input.current.feeFromBalancePct,
        candidateFeeFromDeposit: input.candidate.feeFromDepositPct,
        candidateFeeFromBalance: input.candidate.feeFromBalancePct,
        candidateName: input.candidateName,
      },
      notes: [
        'אינו כולל עלות/הפסד חד-פעמי אפשרי של ניוד עצמו (למשל דמי פדיון על נכסים לא-סחירים)',
        'קצבה חודשית מחושבת רק אם נמסר מקדם המרה לשני הצדדים',
      ],
    },
  };
}
