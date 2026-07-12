import type { CalcTrace } from './types';

/**
 * הטבות מס בהפקדה (מפרט 6.1) — "כמה מס חסכת השנה וכמה נשאר לנצל".
 *
 * שכיר (סעיף 45א): זיכוי 35% על הפקדות העובד לפנסיה, עד 7% מההכנסה
 * המזכה (שכר עד התקרה).
 * עצמאי: מסלול משולב — זיכוי 35% על עד 5.5% מההכנסה המזכה + ניכוי
 * (הקטנת הכנסה חייבת) על עד 11% נוספים, ששוויו לפי המס השולי.
 *
 * הערכים מנוהלים כפרמטרים (RegulatoryParameter + ברירות מחדל כאן) —
 * לאימות מול רשות המסים לפני עלייה לאוויר.
 *
 * פישוטים מוצהרים (MVP): ניכוי סעיף 47 לשכיר, זקיפת שווי על הפקדות
 * מעסיק מעל התקרה, וקרן השתלמות — בשלב הבא.
 */

// ---------- פרמטרים (2026 — אומת מול פרסומי רשות המסים) ----------

export const TAX_PARAMS_2025 = {
  /** הכנסה מזכה חודשית לשכיר (סעיף 45א) */
  qualifyingIncomeEmployeeMonthly: 9_700,
  /** תקרת ההפקדה המזכה: % מההכנסה המזכה */
  employeeCreditDepositPct: 7,
  /** שיעור הזיכוי */
  creditRatePct: 35,
  /** הכנסה מזכה שנתית לעצמאי (כפל השכיר) */
  qualifyingIncomeSelfAnnual: 232_800,
  /** עצמאי: % לזיכוי */
  selfCreditPct: 5.5,
  /** עצמאי: % לניכוי */
  selfDeductionPct: 11,
} as const;

export type TaxParams = { -readonly [K in keyof typeof TAX_PARAMS_2025]: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- קלט/פלט ----------

export interface TaxBenefitsInput {
  employmentStatus: 'EMPLOYEE' | 'SELF_EMPLOYED';
  /** שכיר: שכר ברוטו חודשי; עצמאי: הכנסה חייבת שנתית ÷ 12 */
  monthlyIncome: number;
  /** סך ההפקדות השנתיות שלך לפנסיה (תגמולי עובד / הפקדות עצמאי) */
  annualOwnDeposits: number;
  /** שיעור המס השולי (%) — לשווי הניכוי לעצמאי; ברירת מחדל 35% */
  marginalTaxRatePct?: number;
  paramsOverride?: Partial<TaxParams>;
}

export interface TaxBenefitsResult {
  /** הפרמטרים ששימשו בחישוב — להצגת ההסבר בממשק */
  params: TaxParams;
  /** ההכנסה המזכה בפועל (אחרי התקרה), שנתי */
  qualifyingIncomeAnnual: number;
  /** תקרת ההפקדה שמזכה בהטבה, שנתי */
  maxBenefitedDeposits: number;
  /** כמה מההפקדות שלך זוכות להטבה */
  benefitedDeposits: number;
  /** זיכוי המס (₪ לשנה) */
  taxCredit: number;
  /** שווי הניכוי (₪ לשנה) — עצמאי בלבד */
  deductionValue: number;
  /** סך החיסכון השנתי במס */
  totalAnnualSaving: number;
  /** כמה עוד אפשר להפקיד השנה וליהנות מהטבה */
  remainingDepositAllowance: number;
  /** ההטבה הנוספת אם תנצל את מלוא התקרה */
  potentialExtraSaving: number;
  warnings: string[];
  trace: CalcTrace;
}

// ---------- חישוב ----------

export function calcTaxBenefits(input: TaxBenefitsInput): TaxBenefitsResult {
  if (!(input.monthlyIncome >= 0) || !(input.annualOwnDeposits >= 0)) {
    throw new Error('הכנסה והפקדות חייבות להיות אי-שליליות');
  }
  const p: TaxParams = { ...TAX_PARAMS_2025, ...input.paramsOverride };
  const marginalRate = (input.marginalTaxRatePct ?? 35) / 100;
  const warnings: string[] = [
    'ערכי 2026 בהנחות מפושטות (ללא סעיף 47 וזקיפת שווי) — לאימות מול רשות המסים / יועץ מס',
  ];

  let qualifyingIncomeAnnual: number;
  let maxBenefitedDeposits: number;
  let taxCredit = 0;
  let deductionValue = 0;
  let benefitedDeposits = 0;

  if (input.employmentStatus === 'EMPLOYEE') {
    qualifyingIncomeAnnual = round2(
      Math.min(input.monthlyIncome, p.qualifyingIncomeEmployeeMonthly) * 12,
    );
    maxBenefitedDeposits = round2(
      (qualifyingIncomeAnnual * p.employeeCreditDepositPct) / 100,
    );
    benefitedDeposits = Math.min(input.annualOwnDeposits, maxBenefitedDeposits);
    taxCredit = round2((benefitedDeposits * p.creditRatePct) / 100);
    if (input.monthlyIncome > p.qualifyingIncomeEmployeeMonthly) {
      warnings.push(
        `השכר גבוה מההכנסה המזכה (${p.qualifyingIncomeEmployeeMonthly.toLocaleString('he-IL')} ₪/חודש) — ההטבה מחושבת עד התקרה בלבד; לחלק שמעל שווה לבחון קופת גמל להשקעה / תיקון 190`,
      );
    }
  } else {
    qualifyingIncomeAnnual = round2(
      Math.min(input.monthlyIncome * 12, p.qualifyingIncomeSelfAnnual),
    );
    const creditCeiling = round2((qualifyingIncomeAnnual * p.selfCreditPct) / 100);
    const deductionCeiling = round2(
      (qualifyingIncomeAnnual * p.selfDeductionPct) / 100,
    );
    maxBenefitedDeposits = round2(creditCeiling + deductionCeiling);
    benefitedDeposits = Math.min(input.annualOwnDeposits, maxBenefitedDeposits);
    // סדר הניצול: קודם הזיכוי (35% — חזק יותר לרוב), אחר כך הניכוי
    const toCredit = Math.min(benefitedDeposits, creditCeiling);
    const toDeduction = Math.max(0, benefitedDeposits - toCredit);
    taxCredit = round2((toCredit * p.creditRatePct) / 100);
    deductionValue = round2(toDeduction * marginalRate);
    warnings.push(
      'שווי הניכוי חושב לפי המס השולי שהוזן — הערך המדויק תלוי בכלל ההכנסות בשנת המס',
    );
  }

  const totalAnnualSaving = round2(taxCredit + deductionValue);
  const remainingDepositAllowance = round2(
    Math.max(0, maxBenefitedDeposits - input.annualOwnDeposits),
  );
  // ההטבה השולית על יתרת התקרה: שכיר — 35%; עצמאי — לפי מה שנשאר (זיכוי ואז ניכוי)
  let potentialExtraSaving: number;
  if (input.employmentStatus === 'EMPLOYEE') {
    potentialExtraSaving = round2((remainingDepositAllowance * p.creditRatePct) / 100);
  } else {
    const creditCeiling = round2((qualifyingIncomeAnnual * p.selfCreditPct) / 100);
    const remainingCredit = Math.max(0, creditCeiling - input.annualOwnDeposits);
    const remainingDeduction = Math.max(0, remainingDepositAllowance - remainingCredit);
    potentialExtraSaving = round2(
      (remainingCredit * p.creditRatePct) / 100 + remainingDeduction * marginalRate,
    );
  }
  if (remainingDepositAllowance > 0) {
    warnings.push(
      `נותרה תקרה לא מנוצלת: הפקדה נוספת של ${remainingDepositAllowance.toLocaleString('he-IL')} ₪ עד סוף השנה תחסוך עוד כ-${potentialExtraSaving.toLocaleString('he-IL')} ₪ מס`,
    );
  }

  return {
    params: p,
    qualifyingIncomeAnnual,
    maxBenefitedDeposits,
    benefitedDeposits: round2(benefitedDeposits),
    taxCredit,
    deductionValue,
    totalAnnualSaving,
    remainingDepositAllowance,
    potentialExtraSaving,
    warnings,
    trace: {
      formula:
        input.employmentStatus === 'EMPLOYEE'
          ? 'credit = 35% × min(deposits, 7% × min(salary, ceiling) × 12)'
          : 'saving = 35% × min(dep, 5.5%×Q) + marginal × min(max(0, dep − 5.5%×Q), 11%×Q)',
      inputs: {
        employmentStatus: input.employmentStatus,
        monthlyIncome: input.monthlyIncome,
        annualOwnDeposits: input.annualOwnDeposits,
        qualifyingIncomeAnnual,
        marginalTaxRatePct: input.marginalTaxRatePct ?? 35,
      },
      notes: [
        'שכיר: זיכוי 35% על הפקדות עובד עד 7% מההכנסה המזכה (סעיף 45א)',
        'עצמאי: זיכוי על 5.5% + ניכוי על 11% מההכנסה המזכה',
        'סעיף 47, זקיפת שווי מעסיק וקרן השתלמות — בשלב הבא',
      ],
    },
  };
}
