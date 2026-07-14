import { calcSection190 } from './section190';
import type { Section190Input } from './section190';

function base(overrides: Partial<Section190Input> = {}): Section190Input {
  return {
    balance: 1_000_000,
    realGainPct: 40,
    conversionFactor: 200,
    currentAge: 65,
    lifeExpectancyAge: 85,
    annualReturnPct: 3,
    ...overrides,
  };
}

describe('calcSection190', () => {
  it('taxes only the real-gain portion at 15%, not the full balance', () => {
    const r = calcSection190(base());
    expect(r.lumpSum.taxableGain).toBe(400_000); // 40% of 1,000,000
    expect(r.lumpSum.tax).toBe(60_000); // 15% of 400,000
    expect(r.lumpSum.netAmount).toBe(940_000);
  });

  it('grows the net lump sum to life expectancy at the given return', () => {
    const r = calcSection190(base());
    expect(r.lumpSum.projectedValueAtLifeExpectancy).toBeGreaterThan(r.lumpSum.netAmount);
  });

  it('a 0% return leaves the projected lump sum value unchanged', () => {
    const r = calcSection190(base({ annualReturnPct: 0 }));
    expect(r.lumpSum.projectedValueAtLifeExpectancy).toBe(r.lumpSum.netAmount);
  });

  it('computes a tax-free monthly recognized pension from balance / conversionFactor', () => {
    const r = calcSection190(base());
    expect(r.recognizedPension.monthlyAmount).toBe(5_000); // 1,000,000 / 200
    expect(r.recognizedPension.totalMonths).toBe(240); // 20 years
    expect(r.recognizedPension.totalIncomeToLifeExpectancy).toBe(1_200_000);
  });

  it('warns about eligibility when the current age is under 60', () => {
    const r = calcSection190(base({ currentAge: 55, lifeExpectancyAge: 85 }));
    expect(r.warnings.some((w) => w.includes('גיל 60'))).toBe(true);
  });

  it('does not warn about eligibility for someone already 60+', () => {
    const r = calcSection190(base({ currentAge: 62 }));
    expect(r.warnings.some((w) => w.includes('גיל 60'))).toBe(false);
  });

  it('rejects a non-positive balance', () => {
    expect(() => calcSection190(base({ balance: 0 }))).toThrow();
  });

  it('rejects a real-gain percent out of range', () => {
    expect(() => calcSection190(base({ realGainPct: 150 }))).toThrow();
  });

  it('rejects a non-positive conversion factor', () => {
    expect(() => calcSection190(base({ conversionFactor: 0 }))).toThrow();
  });

  it('rejects life expectancy at or below current age', () => {
    expect(() => calcSection190(base({ lifeExpectancyAge: 65 }))).toThrow();
  });

  it('includes a calculation trace', () => {
    const r = calcSection190(base());
    expect(r.trace.notes.join(' ')).toContain('קצבה מוכרת');
  });
});
