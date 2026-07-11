import {
  annualToMonthlyRate,
  projectBalance,
  runScenario,
} from './projection';
import { annuityFromBalance } from './annuity';
import { ProjectionInput } from './types';

const baseInput: ProjectionInput = {
  currentBalance: 100_000,
  monthlyDeposit: 2_000,
  feeFromDepositPct: 0,
  feeFromBalancePct: 0,
  monthlyCoverageCost: 0,
  annualReturnPct: 0,
  annualSalaryGrowthPct: 0,
  months: 12,
};

describe('annualToMonthlyRate', () => {
  it('converts geometrically: compounding 12 months returns the annual rate', () => {
    const rm = annualToMonthlyRate(3.74);
    expect(Math.pow(1 + rm, 12)).toBeCloseTo(1.0374, 10);
  });

  it('returns 0 for 0% annual', () => {
    expect(annualToMonthlyRate(0)).toBe(0);
  });
});

describe('runScenario — projection formula', () => {
  it('with zero return and zero fees: final = balance + deposits', () => {
    const s = runScenario(baseInput, 0);
    expect(s.finalBalance).toBe(100_000 + 2_000 * 12);
    expect(s.totalNetDeposits).toBe(24_000);
    expect(s.totalFeesPaid).toBe(0);
  });

  it('deposit fee reduces net deposits exactly', () => {
    const s = runScenario({ ...baseInput, feeFromDepositPct: 2 }, 0);
    // 2% מכל הפקדה: 2000*0.98*12
    expect(s.totalNetDeposits).toBeCloseTo(2_000 * 0.98 * 12, 2);
    expect(s.finalBalance).toBeCloseTo(100_000 + 2_000 * 0.98 * 12, 2);
  });

  it('balance fee lowers final balance versus no fee', () => {
    const noFee = runScenario(baseInput, 4);
    const withFee = runScenario({ ...baseInput, feeFromBalancePct: 0.5 }, 4);
    expect(withFee.finalBalance).toBeLessThan(noFee.finalBalance);
    expect(withFee.totalFeesPaid).toBeGreaterThan(0);
  });

  it('coverage cost is subtracted every month', () => {
    const s = runScenario({ ...baseInput, monthlyCoverageCost: 100 }, 0);
    expect(s.totalCoverageCost).toBe(1_200);
    expect(s.finalBalance).toBe(100_000 + 24_000 - 1_200);
  });

  it('salary growth increases deposits over time', () => {
    const flat = runScenario(baseInput, 0);
    const growing = runScenario(
      { ...baseInput, annualSalaryGrowthPct: 3 },
      0,
    );
    expect(growing.totalNetDeposits).toBeGreaterThan(flat.totalNetDeposits);
  });

  it('positive return compounds: 30 years at 3.74% roughly matches closed-form FV', () => {
    const months = 360;
    const rm = annualToMonthlyRate(3.74);
    const s = runScenario({ ...baseInput, months }, 3.74);
    // FV של קרן: 100,000*(1+rm)^360 + FV של אנונה בסוף כל חודש
    const fvPrincipal = 100_000 * Math.pow(1 + rm, months);
    const fvDeposits = 2_000 * ((Math.pow(1 + rm, months) - 1) / rm);
    expect(s.finalBalance).toBeCloseTo(fvPrincipal + fvDeposits, 0);
  });
});

describe('runScenario — yearly series', () => {
  it('series starts at the current balance and ends at the final balance', () => {
    const s = runScenario({ ...baseInput, months: 36 }, 4);
    expect(s.series[0]).toEqual({ month: 0, balance: 100_000 });
    expect(s.series[s.series.length - 1].month).toBe(36);
    expect(s.series[s.series.length - 1].balance).toBe(s.finalBalance);
    // 0 + סוף כל שנה: 12, 24, 36
    expect(s.series.map((p) => p.month)).toEqual([0, 12, 24, 36]);
  });

  it('a partial final year still gets an end point', () => {
    const s = runScenario({ ...baseInput, months: 30 }, 4);
    expect(s.series.map((p) => p.month)).toEqual([0, 12, 24, 30]);
  });

  it('series is monotonically increasing with positive returns and deposits', () => {
    const s = runScenario({ ...baseInput, months: 120 }, 3.74);
    for (let i = 1; i < s.series.length; i++) {
      expect(s.series[i].balance).toBeGreaterThan(s.series[i - 1].balance);
    }
  });
});

describe('projectBalance — three scenarios', () => {
  it('optimistic > central > pessimistic', () => {
    const r = projectBalance({ ...baseInput, annualReturnPct: 3.74, months: 240 });
    expect(r.optimistic.finalBalance).toBeGreaterThan(r.central.finalBalance);
    expect(r.central.finalBalance).toBeGreaterThan(r.pessimistic.finalBalance);
  });

  it('includes a full calculation trace', () => {
    const r = projectBalance(baseInput);
    expect(r.trace.formula).toContain('balance(t+1)');
    expect(r.trace.inputs.months).toBe(12);
    expect(r.trace.notes.length).toBeGreaterThan(0);
  });

  it('rejects invalid inputs', () => {
    expect(() => projectBalance({ ...baseInput, months: 0 })).toThrow();
    expect(() => projectBalance({ ...baseInput, months: 1.5 })).toThrow();
    expect(() =>
      projectBalance({ ...baseInput, feeFromDepositPct: 7 }),
    ).toThrow(); // מעל התקרה החוקית 6%
    expect(() =>
      projectBalance({ ...baseInput, feeFromBalancePct: 2.5 }),
    ).toThrow(); // מעל התקרה הרחבה ביותר (2% — קרן השתלמות)
    expect(() =>
      projectBalance({ ...baseInput, currentBalance: -1 }),
    ).toThrow();
  });
});

describe('annuityFromBalance', () => {
  it('divides balance by conversion factor', () => {
    const r = annuityFromBalance({
      balanceAtRetirement: 1_500_000,
      conversionFactor: 200,
    });
    expect(r.monthlyAnnuity).toBe(7_500);
    expect(r.trace.formula).toContain('conversionFactor');
  });

  it('rejects non-positive factor', () => {
    expect(() =>
      annuityFromBalance({ balanceAtRetirement: 1, conversionFactor: 0 }),
    ).toThrow();
  });
});
