import {
  ProjectionInput,
  ProjectionResult,
  ProjectionScenario,
} from './types';

/**
 * הקרנת צבירה חודשית — הנוסחה מהמפרט (4.2):
 *
 *   יתרה(t+1) = יתרה(t) × (1 + r_חודשי)
 *             + הפקדה(t) × (1 − דמי_ניהול_מהפקדה)
 *             − עלות_כיסויים(t)
 *             − יתרה(t) × (דמי_ניהול_מצבירה / 12)
 *
 * ההפקדה צמודה לתוואי השכר (עליית שכר ריאלית שנתית).
 * ערכים ריאליים — האינפלציה כבר מגולמת בהנחת התשואה הריאלית.
 */
export function runScenario(
  input: ProjectionInput,
  annualReturnPct: number,
): ProjectionScenario {
  const rMonthly = annualToMonthlyRate(annualReturnPct);
  const salaryGrowthMonthly = annualToMonthlyRate(input.annualSalaryGrowthPct);
  const depositFeeFraction = input.feeFromDepositPct / 100;
  const balanceFeeMonthlyFraction = input.feeFromBalancePct / 100 / 12;

  let balance = input.currentBalance;
  let deposit = input.monthlyDeposit;
  let totalNetDeposits = 0;
  let totalFeesPaid = 0;
  let totalCoverageCost = 0;
  const series: { month: number; balance: number }[] = [
    { month: 0, balance: round2(balance) },
  ];

  for (let m = 0; m < input.months; m++) {
    const growth = balance * rMonthly;
    const depositFee = deposit * depositFeeFraction;
    const netDeposit = deposit - depositFee;
    const balanceFee = balance * balanceFeeMonthlyFraction;

    balance = balance + growth + netDeposit - input.monthlyCoverageCost - balanceFee;

    totalNetDeposits += netDeposit;
    totalFeesPaid += depositFee + balanceFee;
    totalCoverageCost += input.monthlyCoverageCost;

    // הפקדה צמודה לשכר — עדכון חודשי
    deposit *= 1 + salaryGrowthMonthly;

    // נקודת סדרה בסוף כל שנה ובחודש האחרון
    if ((m + 1) % 12 === 0 || m === input.months - 1) {
      series.push({ month: m + 1, balance: round2(balance) });
    }
  }

  return {
    annualReturnPct,
    finalBalance: round2(balance),
    series,
    totalNetDeposits: round2(totalNetDeposits),
    totalFeesPaid: round2(totalFeesPaid),
    totalCoverageCost: round2(totalCoverageCost),
  };
}

/**
 * הקרנה מלאה — שלושה תרחישים (מפרט 4.1):
 * מרכזי = הנחת התשואה שנמסרה; פסימי/אופטימי = ±1.5 נקודות אחוז.
 */
export function projectBalance(input: ProjectionInput): ProjectionResult {
  validateInput(input);
  const SPREAD = 1.5;

  return {
    pessimistic: runScenario(input, input.annualReturnPct - SPREAD),
    central: runScenario(input, input.annualReturnPct),
    optimistic: runScenario(input, input.annualReturnPct + SPREAD),
    trace: {
      formula:
        'balance(t+1) = balance(t)*(1+r_m) + deposit(t)*(1-feeDeposit) - coverageCost - balance(t)*(feeBalance/12)',
      inputs: {
        currentBalance: input.currentBalance,
        monthlyDeposit: input.monthlyDeposit,
        feeFromDepositPct: input.feeFromDepositPct,
        feeFromBalancePct: input.feeFromBalancePct,
        monthlyCoverageCost: input.monthlyCoverageCost,
        annualReturnPct: input.annualReturnPct,
        annualSalaryGrowthPct: input.annualSalaryGrowthPct,
        months: input.months,
        scenarioSpreadPct: SPREAD,
      },
      notes: [
        'ערכים ריאליים (מנוכי אינפלציה)',
        'התשואה החודשית נגזרת גיאומטרית: (1+r_שנתי)^(1/12) − 1',
        'ההפקדה צמודה לעליית השכר, בעדכון חודשי',
      ],
    },
  };
}

/** המרה גיאומטרית של שיעור שנתי (%) לשיעור חודשי (fraction) */
export function annualToMonthlyRate(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

function validateInput(input: ProjectionInput): void {
  if (input.months <= 0 || !Number.isInteger(input.months)) {
    throw new Error('months חייב להיות מספר שלם חיובי');
  }
  if (input.currentBalance < 0) throw new Error('currentBalance לא יכול להיות שלילי');
  if (input.monthlyDeposit < 0) throw new Error('monthlyDeposit לא יכול להיות שלילי');
  if (input.feeFromDepositPct < 0 || input.feeFromDepositPct > 6) {
    throw new Error('feeFromDepositPct מחוץ לטווח החוקי (0–6%)');
  }
  // 2% היא התקרה הרחבה ביותר (קרן השתלמות); תקרות פר-סוג נאכפות בחישוב תיק
  if (input.feeFromBalancePct < 0 || input.feeFromBalancePct > 2) {
    throw new Error('feeFromBalancePct מחוץ לטווח החוקי (0–2%)');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
