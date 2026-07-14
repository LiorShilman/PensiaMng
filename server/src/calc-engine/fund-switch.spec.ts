import { calcFundSwitch } from './fund-switch';
import type { FundSwitchInput } from './fund-switch';

function base(overrides: Partial<FundSwitchInput> = {}): FundSwitchInput {
  return {
    currentBalance: 500_000,
    monthlyDeposit: 3_000,
    monthlyCoverageCost: 0,
    annualReturnPct: 4,
    annualSalaryGrowthPct: 1.5,
    months: 240,
    current: { feeFromDepositPct: 3, feeFromBalancePct: 1, conversionFactor: 200 },
    candidateName: 'קרן ברירת מחדל',
    candidate: { feeFromDepositPct: 1, feeFromBalancePct: 0.22, conversionFactor: 200 },
    ...overrides,
  };
}

describe('calcFundSwitch', () => {
  it('a candidate with lower fees produces a higher balance at retirement', () => {
    const r = calcFundSwitch(base());
    expect(r.candidateBalanceAtRetirement).toBeGreaterThan(r.currentBalanceAtRetirement);
    expect(r.balanceGap).toBeGreaterThan(0);
  });

  it('computes a monthly annuity gap when both sides have a conversion factor', () => {
    const r = calcFundSwitch(base());
    expect(r.currentMonthlyAnnuity).not.toBeNull();
    expect(r.candidateMonthlyAnnuity).not.toBeNull();
    expect(r.annuityGap).toBeCloseTo(
      (r.candidateMonthlyAnnuity as number) - (r.currentMonthlyAnnuity as number),
      2,
    );
  });

  it('returns null annuity figures when conversion factors are not provided', () => {
    const r = calcFundSwitch(
      base({
        current: { feeFromDepositPct: 3, feeFromBalancePct: 1 },
        candidate: { feeFromDepositPct: 1, feeFromBalancePct: 0.22 },
      }),
    );
    expect(r.currentMonthlyAnnuity).toBeNull();
    expect(r.candidateMonthlyAnnuity).toBeNull();
    expect(r.annuityGap).toBeNull();
  });

  it('warns about losing a guaranteed conversion factor', () => {
    const r = calcFundSwitch(base({ currentHasGuaranteedFactor: true }));
    expect(r.warnings.some((w) => w.includes('מקדם המרה מובטח'))).toBe(true);
  });

  it('warns about a possible qualifying-period reset', () => {
    const r = calcFundSwitch(base({ resetsQualifyingPeriod: true }));
    expect(r.warnings.some((w) => w.includes('תקופת האכשרה'))).toBe(true);
  });

  it('warns when the candidate actually ends up worse despite the intent to switch', () => {
    const r = calcFundSwitch(
      base({
        current: { feeFromDepositPct: 1, feeFromBalancePct: 0.22 },
        candidate: { feeFromDepositPct: 3, feeFromBalancePct: 1 },
      }),
    );
    expect(r.warnings.some((w) => w.includes('להקטין את הצבירה'))).toBe(true);
  });

  it('rejects non-positive months', () => {
    expect(() => calcFundSwitch(base({ months: 0 }))).toThrow();
  });

  it('rejects a negative current balance', () => {
    expect(() => calcFundSwitch(base({ currentBalance: -1 }))).toThrow();
  });

  it('includes a calculation trace', () => {
    const r = calcFundSwitch(base());
    expect(r.trace.inputs.candidateName).toBe('קרן ברירת מחדל');
  });
});
