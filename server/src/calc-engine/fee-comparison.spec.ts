import { calcFeeComparison } from './fee-comparison';
import type { FeeComparisonInput, FeeComparisonProductInput } from './fee-comparison';

const cheapPension: FeeComparisonProductInput = {
  id: 'p1',
  name: 'פנסיה זולה',
  type: 'PENSION_COMPREHENSIVE',
  currentBalance: 500_000,
  monthlyDeposit: 3_000,
  feeFromDepositPct: 1.0,
  feeFromBalancePct: 0.06,
};

const expensiveGemel: FeeComparisonProductInput = {
  id: 'p2',
  name: 'גמל יקרה',
  type: 'PROVIDENT_FUND',
  currentBalance: 300_000,
  monthlyDeposit: 0,
  feeFromDepositPct: 0,
  feeFromBalancePct: 1.0,
};

function base(overrides: Partial<FeeComparisonInput> = {}): FeeComparisonInput {
  return {
    months: 240,
    annualReturnPct: 4,
    annualSalaryGrowthPct: 0,
    products: [cheapPension, expensiveGemel],
    ...overrides,
  };
}

describe('calcFeeComparison — השוואת דמי ניהול לשוק', () => {
  it('מוצר זול מהממוצע מזוהה ככזה עם עלות עודפת שלילית', () => {
    const r = calcFeeComparison(base());
    const p = r.products.find((x) => x.id === 'p1')!;
    // צבירה: 500,000 × (0.06% − 0.19%) = −650 ; הפקדות: 36,000 × (1% − 1.4%) = −144
    expect(p.annualExcessCost).toBe(-794);
    expect(p.verdict).toBe('cheaper');
  });

  it('מוצר יקר מהממוצע: עלות עודפת חיובית ופער בפרישה', () => {
    const r = calcFeeComparison(base());
    const p = r.products.find((x) => x.id === 'p2')!;
    // 300,000 × (1.0% − 0.54%) = 1,380 לשנה
    expect(p.annualExcessCost).toBe(1_380);
    expect(p.verdict).toBe('expensive');
    expect(p.gapAtRetirement).toBeGreaterThan(20_000); // 0.46% לשנה על 20 שנה
  });

  it('הפער בפרישה חיובי כשהדמים מעל הממוצע ושלילי כשמתחת', () => {
    const r = calcFeeComparison(base());
    expect(r.products.find((x) => x.id === 'p2')!.gapAtRetirement).toBeGreaterThan(0);
    expect(r.products.find((x) => x.id === 'p1')!.gapAtRetirement).toBeLessThan(0);
  });

  it('סיכומי התיק = סכום המוצרים', () => {
    const r = calcFeeComparison(base());
    expect(r.totalAnnualExcessCost).toBe(
      Math.round(
        (r.products[0].annualExcessCost + r.products[1].annualExcessCost) * 100,
      ) / 100,
    );
  });

  it('מוצרי ביטוח טהורים אינם נכללים', () => {
    const r = calcFeeComparison(
      base({
        products: [
          cheapPension,
          {
            id: 'p9',
            name: 'אכ"ע',
            type: 'DISABILITY_INSURANCE',
            currentBalance: 0,
            monthlyDeposit: 0,
            feeFromDepositPct: 0,
            feeFromBalancePct: 0,
          },
        ],
      }),
    );
    expect(r.products).toHaveLength(1);
  });

  it('מוצר יקר מוסיף אזהרת מיקוח', () => {
    const r = calcFeeComparison(base());
    expect(r.warnings.some((w) => w.includes('מיקוח'))).toBe(true);
  });

  it('עקיפת ממוצעים (RegulatoryParameter) גוברת', () => {
    const r = calcFeeComparison(
      base({
        benchmarksOverride: { PROVIDENT_FUND: { deposit: 0, balance: 1.0 } },
      }),
    );
    const p = r.products.find((x) => x.id === 'p2')!;
    expect(p.annualExcessCost).toBe(0);
    expect(p.verdict).toBe('similar');
  });

  it('חודשים לא חיוביים נדחים', () => {
    expect(() => calcFeeComparison(base({ months: 0 }))).toThrow();
  });
});
