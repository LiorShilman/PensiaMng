import { calcLifePath } from './life-path';
import type { LifePathEvent, LifePathInput } from './life-path';

function base(overrides: Partial<LifePathInput> = {}): LifePathInput {
  return {
    currentBalance: 500_000,
    monthlyDeposit: 3_000,
    feeFromDepositPct: 1,
    feeFromBalancePct: 0.2,
    annualReturnPct: 4,
    annualSalaryGrowthPct: 2,
    months: 120,
    conversionFactor: 200,
    events: [],
    ...overrides,
  };
}

describe('calcLifePath', () => {
  it('with no events, the path equals the baseline exactly', () => {
    const r = calcLifePath(base());
    expect(r.finalBalance).toBe(r.baselineFinalBalance);
    expect(r.totalImpact).toBe(0);
    expect(r.warnings).toContain('לא נוספו אירועים — ההקרנה זהה לתחזית הרגילה של התיק');
  });

  it('an unemployment gap with 0% deposit reduces the final balance vs baseline', () => {
    const event: LifePathEvent = {
      id: 'e1',
      type: 'UNEMPLOYMENT_GAP',
      atMonth: 12,
      durationMonths: 6,
      depositDuringPct: 0,
    };
    const r = calcLifePath(base({ events: [event] }));
    expect(r.finalBalance).toBeLessThan(r.baselineFinalBalance);
    expect(r.totalImpact).toBeLessThan(0);
  });

  it('a job-exit withdrawal removes the severance amount from the balance trajectory', () => {
    const event: LifePathEvent = {
      id: 'e2',
      type: 'JOB_EXIT_WITHDRAW',
      atMonth: 24,
      severanceWithdrawn: 100_000,
    };
    const r = calcLifePath(base({ events: [event] }));
    expect(r.finalBalance).toBeLessThan(r.baselineFinalBalance);
    // ההפרש הסופי גדול או שווה לסכום שנמשך (כי גם התשואה העתידית עליו אבדה)
    expect(r.baselineFinalBalance - r.finalBalance).toBeGreaterThanOrEqual(100_000);
  });

  it('a job-exit withdrawal with full context computes a job-exit-consistent breakdown', () => {
    const event: LifePathEvent = {
      id: 'e2',
      type: 'JOB_EXIT_WITHDRAW',
      atMonth: 24,
      severanceWithdrawn: 100_000,
      yearsOfServiceAtExit: 8,
      lastMonthlySalaryAtExit: 15_000,
      marginalTaxRatePct: 30,
    };
    const r = calcLifePath(base({ events: [event] }));
    expect(r.events).toHaveLength(1);
    expect(r.events[0].detail).toContain('נטו ביד');
    expect(r.events[0].balanceImpact).toBeLessThan(0);
  });

  it('a salary change increases future deposits and improves the final balance', () => {
    const event: LifePathEvent = {
      id: 'e3',
      type: 'SALARY_CHANGE',
      atMonth: 12,
      newMonthlyDeposit: 6_000,
    };
    const r = calcLifePath(base({ events: [event] }));
    expect(r.finalBalance).toBeGreaterThan(r.baselineFinalBalance);
  });

  it('a parental leave with partial continued deposits impacts less than a full stop', () => {
    const fullStop = calcLifePath(
      base({
        events: [
          { id: 'a', type: 'PARENTAL_LEAVE', atMonth: 12, durationMonths: 4, depositDuringPct: 0 },
        ],
      }),
    );
    const partial = calcLifePath(
      base({
        events: [
          { id: 'b', type: 'PARENTAL_LEAVE', atMonth: 12, durationMonths: 4, depositDuringPct: 50 },
        ],
      }),
    );
    expect(partial.finalBalance).toBeGreaterThan(fullStop.finalBalance);
  });

  it('rejects an event outside the projection horizon', () => {
    expect(() =>
      calcLifePath(base({ events: [{ id: 'x', type: 'SALARY_CHANGE', atMonth: 999 }] })),
    ).toThrow();
  });

  it('rejects a non-positive months value', () => {
    expect(() => calcLifePath(base({ months: 0 }))).toThrow();
  });
});
