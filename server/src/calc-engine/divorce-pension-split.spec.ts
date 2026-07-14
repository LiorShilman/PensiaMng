import { calcDivorcePensionSplit } from './divorce-pension-split';
import type { DivorcePensionSplitInput } from './divorce-pension-split';

function base(overrides: Partial<DivorcePensionSplitInput> = {}): DivorcePensionSplitInput {
  return {
    marriageDate: '2005-01-01',
    breakDate: '2015-01-01',
    retirementDate: '2020-01-01',
    awardedPct: 50,
    products: [
      { id: 'p1', name: 'קרן פנסיה מקיפה', joinDate: '2000-01-01', balanceAtBreakDate: 400_000 },
    ],
    ...overrides,
  };
}

describe('calcDivorcePensionSplit', () => {
  it('computes a clean marital fraction when the overlap is exactly half the total accrual period', () => {
    // join 2000-01, marriage 2005-01, break 2015-01, retire 2020-01
    // overlap = marriage→break = 120mo; total = join→retire = 240mo → 50%
    const r = calcDivorcePensionSplit(base());
    expect(r.products[0].maritalFractionPct).toBe(50);
    expect(r.products[0].spouseShare).toBe(400_000 * 0.5 * 0.5);
    expect(r.products[0].remainingForMember).toBe(400_000 - r.products[0].spouseShare);
  });

  it('counts overlap from the marriage date, not an earlier join date', () => {
    // join before marriage — accrual before the wedding is not marital property
    const r = calcDivorcePensionSplit(
      base({ products: [{ id: 'p1', name: 'x', joinDate: '1990-01-01', balanceAtBreakDate: 100 }] }),
    );
    // overlap = marriage(2005-01)→break(2015-01) = 120mo; total = join(1990-01)→retire(2020-01) = 360mo
    expect(r.products[0].maritalFractionPct).toBeCloseTo((120 / 360) * 100, 1);
  });

  it('counts overlap from the join date when the fund was joined after marrying', () => {
    const r = calcDivorcePensionSplit(
      base({ products: [{ id: 'p1', name: 'x', joinDate: '2010-01-01', balanceAtBreakDate: 100 }] }),
    );
    // overlap = join(2010-01)→break(2015-01) = 60mo; total = join(2010-01)→retire(2020-01) = 120mo
    expect(r.products[0].maritalFractionPct).toBe(50);
  });

  it('clamps the marital fraction to 0 when the product was joined after the break date', () => {
    const r = calcDivorcePensionSplit(
      base({ products: [{ id: 'p1', name: 'x', joinDate: '2016-01-01', balanceAtBreakDate: 500_000 }] }),
    );
    expect(r.products[0].maritalFractionPct).toBe(0);
    expect(r.products[0].spouseShare).toBe(0);
  });

  it('sums totalBalanceAtBreakDate and totalSpouseShare across multiple products', () => {
    const r = calcDivorcePensionSplit(
      base({
        products: [
          { id: 'p1', name: 'א', joinDate: '2000-01-01', balanceAtBreakDate: 400_000 },
          { id: 'p2', name: 'ב', joinDate: '2000-01-01', balanceAtBreakDate: 100_000 },
        ],
      }),
    );
    expect(r.totalBalanceAtBreakDate).toBe(500_000);
    expect(r.totalSpouseShare).toBe(r.products[0].spouseShare + r.products[1].spouseShare);
  });

  it('warns when the break date precedes the marriage date', () => {
    const r = calcDivorcePensionSplit(base({ breakDate: '2000-01-01' }));
    expect(r.warnings.some((w) => w.includes('מועד הקרע מוזן לפני'))).toBe(true);
  });

  it('warns when the retirement date precedes the break date', () => {
    const r = calcDivorcePensionSplit(base({ retirementDate: '2010-01-01' }));
    expect(r.warnings.some((w) => w.includes('תאריך הפרישה מוזן לפני'))).toBe(true);
  });

  it('warns when the awarded percentage exceeds 50%', () => {
    const r = calcDivorcePensionSplit(base({ awardedPct: 60 }));
    expect(r.warnings.some((w) => w.includes('מעל 50%'))).toBe(true);
  });

  it('does not warn about the 50% ceiling at exactly 50%', () => {
    const r = calcDivorcePensionSplit(base({ awardedPct: 50 }));
    expect(r.warnings.some((w) => w.includes('מעל 50%'))).toBe(false);
  });

  it('always includes the legal-advice and budgetary-pension-exclusion disclaimers', () => {
    const r = calcDivorcePensionSplit(base());
    expect(r.warnings.some((w) => w.includes('ייעוץ משפטי'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('פנסיה תקציבית'))).toBe(true);
  });

  it('rejects an empty products list', () => {
    expect(() => calcDivorcePensionSplit(base({ products: [] }))).toThrow();
  });

  it('rejects a negative awarded percentage', () => {
    expect(() => calcDivorcePensionSplit(base({ awardedPct: -1 }))).toThrow();
  });

  it('includes a calculation trace', () => {
    const r = calcDivorcePensionSplit(base());
    expect(r.trace.formula).toContain('יחס_זמנים');
  });
});
