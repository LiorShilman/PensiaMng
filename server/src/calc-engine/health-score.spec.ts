import { calcHealthScore } from './health-score';
import type { HealthScoreInput, HealthScoreProductInput } from './health-score';

const goodPension: HealthScoreProductInput = {
  type: 'PENSION_COMPREHENSIVE',
  currentBalance: 500_000,
  feeFromBalancePct: 0.22,
  feeFromDepositPct: 1,
  hasBeneficiaries: true,
  ageDependentTrack: true,
};

function base(overrides: Partial<HealthScoreInput> = {}): HealthScoreInput {
  return {
    age: 40,
    replacementRatePct: 75,
    deathCoverageRatio: 1.1,
    disabilityCoverageRatio: 1,
    products: [goodPension],
    ...overrides,
  };
}

describe('calcHealthScore', () => {
  it('תיק מצוין: ציון 100 ודירוג "מצוין"', () => {
    const r = calcHealthScore(base());
    expect(r.total).toBe(100);
    expect(r.grade).toBe('excellent');
    expect(r.topRecommendations).toHaveLength(0);
  });

  it('סכום הרכיבים = הציון הכולל, והמקסימום 35/20/15/15/10/5', () => {
    const r = calcHealthScore(base());
    expect(r.components.map((c) => c.max)).toEqual([35, 20, 15, 15, 10, 5]);
    const sum = Math.round(r.components.reduce((s, c) => s + c.score, 0));
    expect(r.total).toBe(sum);
  });

  it('שיעור תחלופה 60%: ניקוד חלקי + המלצה', () => {
    const r = calcHealthScore(base({ replacementRatePct: 60 }));
    const c = r.components.find((c) => c.key === 'replacement')!;
    expect(c.score).toBe(25); // 20 + 15×(60−55)/15
    expect(c.recommendation).toBeDefined();
  });

  it('ללא שכר: תחלופה 0 נקודות, כיסויים 7 (לא נבחנו)', () => {
    const r = calcHealthScore(
      base({
        replacementRatePct: null,
        deathCoverageRatio: null,
        disabilityCoverageRatio: null,
      }),
    );
    expect(r.components.find((c) => c.key === 'replacement')!.score).toBe(0);
    expect(r.components.find((c) => c.key === 'death_coverage')!.score).toBe(7);
  });

  it('דמי ניהול גבוהים מורידים את רכיב העלויות', () => {
    const r = calcHealthScore(
      base({
        products: [
          { ...goodPension, feeFromBalancePct: 1.0, feeFromDepositPct: 3 },
        ],
      }),
    );
    const c = r.components.find((c) => c.key === 'fees')!;
    expect(c.score).toBe(2); // 5 (עד 1.05) − 3 (מהפקדה מעל 2%)
    expect(c.recommendation).toBeDefined();
  });

  it('כיסוי נכות חלקי: ניקוד יחסי', () => {
    const r = calcHealthScore(base({ disabilityCoverageRatio: 0.5 }));
    expect(r.components.find((c) => c.key === 'disability_coverage')!.score).toBe(7.5);
  });

  it('גיל 60 עם 100% מניות: אזהרת סיכון סמוך לפרישה', () => {
    const r = calcHealthScore(
      base({
        age: 60,
        products: [
          { ...goodPension, ageDependentTrack: false, equityPct: 100 },
        ],
      }),
    );
    const c = r.components.find((c) => c.key === 'track_fit')!;
    expect(c.score).toBe(3);
    expect(c.recommendation).toContain('סמוך לפרישה');
  });

  it('גיל 35 עם מסלול שמרני: המלצה להעלות חשיפה', () => {
    const r = calcHealthScore(
      base({
        age: 35,
        products: [{ ...goodPension, ageDependentTrack: false, equityPct: 10 }],
      }),
    );
    const c = r.components.find((c) => c.key === 'track_fit')!;
    expect(c.score).toBe(6);
    expect(c.recommendation).toContain('מנייתי');
  });

  it('היגיינה: מוצר הוני ללא מוטבים + קופה קפואה מורידים נקודות', () => {
    const r = calcHealthScore(
      base({
        products: [
          goodPension,
          {
            type: 'PROVIDENT_FUND',
            currentBalance: 100_000,
            feeFromBalancePct: 0.5,
            feeFromDepositPct: 0,
            hasBeneficiaries: false,
            frozen: true,
          },
        ],
      }),
    );
    const c = r.components.find((c) => c.key === 'hygiene')!;
    expect(c.score).toBe(2); // 5 − 2 (מוטבים) − 1 (קפואה)
  });

  it('ההמלצות ממוינות לפי הפער בנקודות', () => {
    const r = calcHealthScore(
      base({
        replacementRatePct: 30, // פער ענק (35−~6)
        disabilityCoverageRatio: 0.9, // פער קטן
      }),
    );
    expect(r.topRecommendations.length).toBeGreaterThanOrEqual(2);
    expect(r.topRecommendations[0]).toContain('ייעוץ'); // ההמלצה של התחלופה הקריטית ראשונה
  });

  it('דירוגים: 60 → דורש שיפור, 45 → דורש טיפול', () => {
    const poor = calcHealthScore(
      base({
        replacementRatePct: 20,
        deathCoverageRatio: 0.3,
        disabilityCoverageRatio: 0.3,
        products: [{ ...goodPension, feeFromBalancePct: 1.2 }],
      }),
    );
    expect(poor.grade).toBe('poor');
  });
});
