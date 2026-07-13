import { calcAnnuityTrackComparison } from './annuity-track';
import type { AnnuityTrackInput, AnnuityTrackOption } from './annuity-track';

const noSurvivor: AnnuityTrackOption = {
  id: 'a',
  label: 'ללא שאירים',
  conversionFactor: 180,
  survivorPct: 0,
  guaranteedMonths: 60,
};

const fullSurvivor: AnnuityTrackOption = {
  id: 'b',
  label: '100% שאירים',
  conversionFactor: 220,
  survivorPct: 100,
  guaranteedMonths: 60,
};

function base(overrides: Partial<AnnuityTrackInput> = {}): AnnuityTrackInput {
  return {
    balanceAtRetirement: 1_800_000,
    options: [noSurvivor, fullSurvivor],
    hasSpouse: true,
    retirementAge: 67,
    retireeLifeExpectancyAge: 85,
    spouseAgeAtRetirement: 65,
    spouseLifeExpectancyAge: 90,
    ...overrides,
  };
}

describe('calcAnnuityTrackComparison', () => {
  it('computes monthly annuity per option as balance / conversionFactor', () => {
    const r = calcAnnuityTrackComparison(base());
    expect(r.options[0].monthlyAnnuity).toBe(10_000); // 1.8M / 180
    expect(r.options[1].monthlyAnnuity).toBeCloseTo(8181.82, 1); // 1.8M / 220
  });

  it('survivor monthly is 0 when survivorPct is 0, and the % of monthly otherwise', () => {
    const r = calcAnnuityTrackComparison(base());
    expect(r.options[0].survivorMonthly).toBe(0);
    expect(r.options[1].survivorMonthly).toBeCloseTo(8181.82, 1); // 100% of its own monthly
  });

  it('the baseline option (first in list) has no break-even age', () => {
    const r = calcAnnuityTrackComparison(base());
    expect(r.options[0].breakEvenAge).toBeUndefined();
  });

  it('a lower-monthly, full-survivor track eventually breaks even against a higher-monthly, no-survivor baseline when the spouse outlives the retiree', () => {
    const r = calcAnnuityTrackComparison(base());
    // spouse survives the retiree by 15 years post-guarantee — the 100%-survivor
    // track's cumulative household payout should overtake the no-survivor one
    expect(r.options[1].breakEvenAge).not.toBeNull();
    expect(typeof r.options[1].breakEvenAge).toBe('number');
  });

  it('returns null break-even when there is no spouse to ever collect a survivor pension', () => {
    const r = calcAnnuityTrackComparison(base({ hasSpouse: false }));
    // without a spouse, the full-survivor track never pays out its extra value —
    // its lower monthly annuity alone can never catch up to the baseline
    expect(r.options[1].breakEvenAge).toBeNull();
  });

  it('within the guaranteed period, dying immediately still pays the full guaranteed amount regardless of survivor %', () => {
    const r = calcAnnuityTrackComparison(
      base({ retireeLifeExpectancyAge: 67 + 60 / 12 }), // dies exactly at the end of the 60-month guarantee
    );
    // total payout should be at least monthlyAnnuity × guaranteedMonths for both options
    expect(r.options[0].totalExpectedPayout).toBeGreaterThanOrEqual(10_000 * 60 - 1);
  });

  it('warns when survivor % is set but there is no spouse in the portfolio', () => {
    const r = calcAnnuityTrackComparison(base({ hasSpouse: false }));
    expect(r.warnings.some((w) => w.includes('אין בן/בת זוג'))).toBe(true);
  });

  it('warns on a large monthly gap between the cheapest and richest track', () => {
    const r = calcAnnuityTrackComparison(
      base({ options: [noSurvivor, { ...fullSurvivor, conversionFactor: 300 }] }),
    );
    expect(r.warnings.some((w) => w.includes('פער'))).toBe(true);
  });

  it('rejects a non-positive balance', () => {
    expect(() => calcAnnuityTrackComparison(base({ balanceAtRetirement: 0 }))).toThrow();
  });

  it('rejects an empty options list', () => {
    expect(() => calcAnnuityTrackComparison(base({ options: [] }))).toThrow();
  });

  it('rejects a non-positive conversion factor', () => {
    expect(() =>
      calcAnnuityTrackComparison(
        base({ options: [{ ...noSurvivor, conversionFactor: 0 }] }),
      ),
    ).toThrow();
  });

  it('rejects survivor percent out of the 0-100 range', () => {
    expect(() =>
      calcAnnuityTrackComparison(base({ options: [{ ...noSurvivor, survivorPct: 150 }] })),
    ).toThrow();
  });

  it('rejects life expectancy at or below retirement age', () => {
    expect(() => calcAnnuityTrackComparison(base({ retireeLifeExpectancyAge: 67 }))).toThrow();
  });

  it('requires spouse age fields when hasSpouse is true', () => {
    expect(() =>
      calcAnnuityTrackComparison(
        base({ spouseAgeAtRetirement: undefined, spouseLifeExpectancyAge: undefined }),
      ),
    ).toThrow();
  });

  it('rejects spouse life expectancy at or below spouse age at retirement', () => {
    expect(() =>
      calcAnnuityTrackComparison(base({ spouseLifeExpectancyAge: 65, spouseAgeAtRetirement: 65 })),
    ).toThrow();
  });

  it('includes a calculation trace noting Section 190 recognized-pension is not modeled', () => {
    const r = calcAnnuityTrackComparison(base());
    expect(r.trace.notes.join(' ')).toContain('תיקון 190');
  });
});
