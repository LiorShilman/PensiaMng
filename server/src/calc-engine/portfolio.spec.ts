import { calcPortfolio } from './portfolio';
import type { PortfolioInput, PortfolioProductInput } from './types';

const pension: PortfolioProductInput = {
  id: 'p1',
  name: 'קרן פנסיה מקיפה',
  type: 'PENSION_COMPREHENSIVE',
  currentBalance: 300_000,
  monthlyDeposit: 2_000,
  feeFromDepositPct: 1.5,
  feeFromBalancePct: 0.2,
  monthlyCoverageCost: 100,
  conversionFactor: 200,
};

const studyFund: PortfolioProductInput = {
  id: 'p2',
  name: 'קרן השתלמות',
  type: 'STUDY_FUND',
  currentBalance: 120_000,
  monthlyDeposit: 1_500,
  feeFromDepositPct: 0,
  feeFromBalancePct: 0.6,
  monthlyCoverageCost: 0,
};

const basePortfolio: PortfolioInput = {
  months: 240,
  annualReturnPct: 3.74,
  annualSalaryGrowthPct: 1.5,
  products: [pension, studyFund],
};

describe('calcPortfolio', () => {
  it('rejects an empty portfolio', () => {
    expect(() => calcPortfolio({ ...basePortfolio, products: [] })).toThrow();
  });

  it('returns a result per product plus aggregated totals', () => {
    const r = calcPortfolio(basePortfolio);
    expect(r.products).toHaveLength(2);
    expect(r.totals.central.totalBalance).toBeCloseTo(
      r.products[0].projection.central.finalBalance +
        r.products[1].projection.central.finalBalance,
      2,
    );
  });

  it('annuity products produce a monthly annuity; capital products count as lump sum', () => {
    const r = calcPortfolio(basePortfolio);
    const pensionRes = r.products.find((p) => p.id === 'p1')!;
    const studyRes = r.products.find((p) => p.id === 'p2')!;

    expect(pensionRes.isAnnuity).toBe(true);
    expect(pensionRes.monthlyAnnuity!.central).toBeCloseTo(
      pensionRes.projection.central.finalBalance / 200,
      2,
    );

    expect(studyRes.isAnnuity).toBe(false);
    expect(studyRes.monthlyAnnuity).toBeUndefined();
    expect(r.totals.central.totalLumpSum).toBeCloseTo(
      studyRes.projection.central.finalBalance,
      2,
    );
  });

  it('total annuity sums only annuity products', () => {
    const secondPension: PortfolioProductInput = {
      ...pension,
      id: 'p3',
      name: 'ביטוח מנהלים',
      type: 'MANAGERS_INSURANCE',
      feeFromBalancePct: 1.0,
      conversionFactor: 190,
    };
    const r = calcPortfolio({
      ...basePortfolio,
      products: [pension, secondPension, studyFund],
    });
    const expected =
      r.products[0].monthlyAnnuity!.central + r.products[1].monthlyAnnuity!.central;
    expect(r.totals.central.totalMonthlyAnnuity).toBeCloseTo(expected, 2);
  });

  it('an annuity product without a conversion factor is rejected', () => {
    const broken = { ...pension, conversionFactor: undefined };
    expect(() =>
      calcPortfolio({ ...basePortfolio, products: [broken] }),
    ).toThrow(/מקדם המרה/);
  });

  it('enforces per-type fee caps: 0.6% balance fee is illegal for pension but legal for study fund', () => {
    const overCapPension = { ...pension, feeFromBalancePct: 0.6 };
    expect(() =>
      calcPortfolio({ ...basePortfolio, products: [overCapPension] }),
    ).toThrow(/תקרה החוקית/);

    // אותם 0.6% בקרן השתלמות — חוקי
    expect(() =>
      calcPortfolio({ ...basePortfolio, products: [studyFund] }),
    ).not.toThrow();
  });

  it('study fund allows up to 2% balance fee, managers insurance up to 1.05%', () => {
    const highFeeStudy = { ...studyFund, feeFromBalancePct: 1.9 };
    expect(() =>
      calcPortfolio({ ...basePortfolio, products: [highFeeStudy] }),
    ).not.toThrow();

    const overCapManagers: PortfolioProductInput = {
      ...pension,
      type: 'MANAGERS_INSURANCE',
      feeFromBalancePct: 1.2,
    };
    expect(() =>
      calcPortfolio({ ...basePortfolio, products: [overCapManagers] }),
    ).toThrow(/תקרה החוקית/);
  });

  it('a product can override the global return assumption', () => {
    const withOverride = { ...studyFund, annualReturnPct: 6 };
    const r = calcPortfolio({ ...basePortfolio, products: [studyFund] });
    const rOverride = calcPortfolio({
      ...basePortfolio,
      products: [withOverride],
    });
    expect(
      rOverride.products[0].projection.central.finalBalance,
    ).toBeGreaterThan(r.products[0].projection.central.finalBalance);
  });

  it('aggregated series sums product series pointwise', () => {
    const r = calcPortfolio(basePortfolio);
    const s = r.totals.central.series;
    expect(s[0].month).toBe(0);
    expect(s[0].balance).toBeCloseTo(300_000 + 120_000, 2);
    const last = s[s.length - 1];
    expect(last.month).toBe(240);
    expect(last.balance).toBeCloseTo(r.totals.central.totalBalance, 2);
    expect(s).toHaveLength(21); // נקודת פתיחה + 20 שנים
  });

  it('replacement rate = annuity / salary-at-retirement; null without salary', () => {
    const withSalary = calcPortfolio({ ...basePortfolio, insuredMonthlySalary: 20_000 });
    const c = withSalary.totals.central;
    const salaryAtRet = 20_000 * Math.pow(1.015, 240 / 12);
    expect(c.replacementRatePct).toBeCloseTo(
      (c.totalMonthlyAnnuity / salaryAtRet) * 100,
      0,
    );

    const noSalary = calcPortfolio(basePortfolio);
    expect(noSalary.totals.central.replacementRatePct).toBeNull();
  });

  it('scenario ordering holds at the portfolio level', () => {
    const r = calcPortfolio(basePortfolio);
    expect(r.totals.optimistic.totalBalance).toBeGreaterThan(
      r.totals.central.totalBalance,
    );
    expect(r.totals.central.totalBalance).toBeGreaterThan(
      r.totals.pessimistic.totalBalance,
    );
  });
});
