import { calcTaxBenefits } from './tax-benefits';

describe('calcTaxBenefits — שכיר (זיכוי 35%)', () => {
  it('שכר מתחת לתקרה: זיכוי מלא על ההפקדות', () => {
    const r = calcTaxBenefits({
      employmentStatus: 'EMPLOYEE',
      monthlyIncome: 8_000,
      annualOwnDeposits: 6_000,
    });
    expect(r.qualifyingIncomeAnnual).toBe(96_000);
    expect(r.maxBenefitedDeposits).toBe(6_720); // 7%
    expect(r.taxCredit).toBe(2_100); // 35% × 6,000
    expect(r.totalAnnualSaving).toBe(2_100);
    expect(r.remainingDepositAllowance).toBe(720);
    expect(r.potentialExtraSaving).toBe(252);
  });

  it('שכר מעל ההכנסה המזכה: ההטבה נעצרת בתקרה + אזהרה', () => {
    const r = calcTaxBenefits({
      employmentStatus: 'EMPLOYEE',
      monthlyIncome: 12_000,
      annualOwnDeposits: 10_000,
    });
    expect(r.qualifyingIncomeAnnual).toBe(112_800); // 9,400 × 12
    expect(r.benefitedDeposits).toBe(7_896);
    expect(r.taxCredit).toBe(2763.6);
    expect(r.remainingDepositAllowance).toBe(0);
    expect(r.warnings.some((w) => w.includes('גבוה מההכנסה המזכה'))).toBe(true);
  });

  it('ללא הפקדות: חיסכון 0 והמלצה על התקרה המלאה', () => {
    const r = calcTaxBenefits({
      employmentStatus: 'EMPLOYEE',
      monthlyIncome: 9_000,
      annualOwnDeposits: 0,
    });
    expect(r.totalAnnualSaving).toBe(0);
    expect(r.remainingDepositAllowance).toBe(7_560);
    expect(r.warnings.some((w) => w.includes('תקרה לא מנוצלת'))).toBe(true);
  });
});

describe('calcTaxBenefits — עצמאי (זיכוי + ניכוי)', () => {
  it('הכנסה מעל התקרה: זיכוי קודם ואז ניכוי לפי המס השולי', () => {
    const r = calcTaxBenefits({
      employmentStatus: 'SELF_EMPLOYED',
      monthlyIncome: 20_000, // 240,000 שנתי → נחתך ל-225,600
      annualOwnDeposits: 20_000,
      marginalTaxRatePct: 35,
    });
    expect(r.qualifyingIncomeAnnual).toBe(225_600);
    expect(r.maxBenefitedDeposits).toBe(37_224); // 5.5% + 11%
    expect(r.taxCredit).toBe(4342.8); // 35% × 12,408
    expect(r.deductionValue).toBe(2657.2); // 7,592 × 35%
    expect(r.totalAnnualSaving).toBe(7_000);
  });

  it('הפקדה קטנה: כולה בזיכוי; יתרת התקרה משלבת זיכוי וניכוי', () => {
    const r = calcTaxBenefits({
      employmentStatus: 'SELF_EMPLOYED',
      monthlyIncome: 10_000,
      annualOwnDeposits: 5_000,
      marginalTaxRatePct: 35,
    });
    expect(r.taxCredit).toBe(1_750);
    expect(r.deductionValue).toBe(0);
    expect(r.remainingDepositAllowance).toBe(14_800);
    // 1,600 נותרו בזיכוי (560) + 13,200 בניכוי (4,620)
    expect(r.potentialExtraSaving).toBe(5_180);
  });

  it('מס שולי נמוך מקטין את שווי הניכוי', () => {
    const high = calcTaxBenefits({
      employmentStatus: 'SELF_EMPLOYED',
      monthlyIncome: 20_000,
      annualOwnDeposits: 30_000,
      marginalTaxRatePct: 47,
    });
    const low = calcTaxBenefits({
      employmentStatus: 'SELF_EMPLOYED',
      monthlyIncome: 20_000,
      annualOwnDeposits: 30_000,
      marginalTaxRatePct: 20,
    });
    expect(high.deductionValue).toBeGreaterThan(low.deductionValue);
    expect(high.taxCredit).toBe(low.taxCredit); // הזיכוי לא תלוי במס השולי
  });
});

describe('calcTaxBenefits — ולידציה ופרמטרים', () => {
  it('קלט שלילי נדחה', () => {
    expect(() =>
      calcTaxBenefits({
        employmentStatus: 'EMPLOYEE',
        monthlyIncome: -1,
        annualOwnDeposits: 0,
      }),
    ).toThrow();
  });

  it('עקיפת פרמטרים (מ-RegulatoryParameter) גוברת', () => {
    const r = calcTaxBenefits({
      employmentStatus: 'EMPLOYEE',
      monthlyIncome: 12_000,
      annualOwnDeposits: 0,
      paramsOverride: { qualifyingIncomeEmployeeMonthly: 10_000 },
    });
    expect(r.qualifyingIncomeAnnual).toBe(120_000);
  });
});
