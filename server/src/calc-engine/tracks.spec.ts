import { TRACK_DEFS, weightedReturnPct } from './tracks';

describe('weightedReturnPct', () => {
  it('100% equity → the equity assumption (5.5%)', () => {
    expect(weightedReturnPct([{ category: 'EQUITY', pct: 100 }], 3.74)).toBe(5.5);
  });

  it('60/40 equity/bonds → weighted average', () => {
    expect(
      weightedReturnPct(
        [
          { category: 'EQUITY', pct: 60 },
          { category: 'BONDS', pct: 40 },
        ],
        3.74,
      ),
    ).toBeCloseTo(0.6 * 5.5 + 0.4 * 2.0, 2);
  });

  it('partial allocation: the remainder uses the fallback assumption', () => {
    // 50% מנייתי + 50% לפי ברירת מחדל 3.74
    expect(weightedReturnPct([{ category: 'EQUITY', pct: 50 }], 3.74)).toBeCloseTo(
      0.5 * 5.5 + 0.5 * 3.74,
      2,
    );
  });

  it('empty allocation → pure fallback', () => {
    expect(weightedReturnPct([], 3.74)).toBe(3.74);
  });

  it('rejects allocations above 100% and unknown tracks', () => {
    expect(() =>
      weightedReturnPct(
        [
          { category: 'EQUITY', pct: 70 },
          { category: 'BONDS', pct: 50 },
        ],
        3.74,
      ),
    ).toThrow(/100%/);
    expect(() => weightedReturnPct([{ category: 'CRYPTO', pct: 10 }], 3.74)).toThrow(
      /לא מוכר/,
    );
  });

  it('all standard tracks are defined with sane values', () => {
    expect(TRACK_DEFS.length).toBeGreaterThanOrEqual(7);
    for (const t of TRACK_DEFS) {
      expect(t.realReturnPct).toBeGreaterThanOrEqual(0);
      expect(t.realReturnPct).toBeLessThanOrEqual(8);
      expect(t.riskLevel).toBeGreaterThanOrEqual(1);
      expect(t.riskLevel).toBeLessThanOrEqual(7);
    }
  });
});
