import { buildInsights } from './insights';
import type { ScenariosResult } from './scenarios';
import type { HealthScoreResult } from './health-score';
import type { FeeComparisonResult } from './fee-comparison';
import type { TaxBenefitsResult } from './tax-benefits';

const emptyTrace = { formula: '', inputs: {}, notes: [] };

function healthScoreWith(components: HealthScoreResult['components']): HealthScoreResult {
  return {
    total: 70,
    grade: 'fair',
    gradeLabel: 'סביר',
    components,
    topRecommendations: [],
    trace: emptyTrace,
  };
}

describe('buildInsights', () => {
  it('returns an empty list when no sub-results are provided', () => {
    const r = buildInsights({});
    expect(r.insights).toEqual([]);
  });

  it('turns health-score components with a recommendation into insights, skips those without', () => {
    const health = healthScoreWith([
      { key: 'fees', label: 'עלויות', score: 5, max: 20, detail: '', recommendation: 'תעביר קרן' },
      { key: 'track_fit', label: 'מסלול', score: 10, max: 10, detail: '', recommendation: undefined },
    ]);
    const r = buildInsights({ healthScore: health });
    expect(r.insights).toHaveLength(1);
    expect(r.insights[0].category).toBe('fees');
    expect(r.insights[0].severity).toBe('critical'); // gap 15/20 = 0.75 > 0.5
  });

  it('flags a large scenario coverage gap as critical when it mentions כפל ביטוחי', () => {
    const scenarios = {
      warnings: ['כפל ביטוחי בנכות: משלם על כיסוי עודף'],
    } as unknown as ScenariosResult;
    const r = buildInsights({ scenarios });
    expect(r.insights[0].severity).toBe('critical');
    expect(r.insights[0].category).toBe('coverage');
  });

  it('surfaces expensive fee-comparison products with their annual excess cost as impact', () => {
    const feeComparison = {
      products: [
        {
          id: 'p1',
          name: 'קרן יקרה',
          type: 'PENSION_COMPREHENSIVE',
          actual: { deposit: 2, balance: 1 },
          marketAvg: { deposit: 1, balance: 0.2 },
          annualExcessCost: 1500,
          gapAtRetirement: 20000,
          verdict: 'expensive',
          detail: 'יקר מהממוצע',
        },
        {
          id: 'p2',
          name: 'קרן זולה',
          type: 'STUDY_FUND',
          actual: { deposit: 0, balance: 0.5 },
          marketAvg: { deposit: 0, balance: 0.6 },
          annualExcessCost: -200,
          gapAtRetirement: -3000,
          verdict: 'cheaper',
          detail: 'זול מהממוצע',
        },
      ],
      totalAnnualExcessCost: 1500,
      totalGapAtRetirement: 20000,
      warnings: [],
      trace: emptyTrace,
    } as FeeComparisonResult;
    const r = buildInsights({ feeComparison });
    expect(r.insights).toHaveLength(1);
    expect(r.insights[0].title).toContain('קרן יקרה');
    expect(r.insights[0].estimatedAnnualImpact).toBe(1500);
    expect(r.insights[0].severity).toBe('critical'); // > 1000
  });

  it('surfaces an unused tax benefit as an info-level opportunity', () => {
    const taxBenefits = {
      params: {} as TaxBenefitsResult['params'],
      qualifyingIncomeAnnual: 0,
      maxBenefitedDeposits: 0,
      benefitedDeposits: 0,
      taxCredit: 0,
      deductionValue: 0,
      totalAnnualSaving: 0,
      remainingDepositAllowance: 5000,
      potentialExtraSaving: 1750,
      warnings: [],
      trace: emptyTrace,
    } as TaxBenefitsResult;
    const r = buildInsights({ taxBenefits });
    expect(r.insights).toHaveLength(1);
    expect(r.insights[0].severity).toBe('info');
    expect(r.insights[0].category).toBe('tax');
    expect(r.insights[0].estimatedAnnualImpact).toBe(1750);
  });

  it('sorts by severity first, then by estimated annual impact descending', () => {
    const feeComparison = {
      products: [
        {
          id: 'p1',
          name: 'א',
          type: 'PENSION_COMPREHENSIVE',
          actual: { deposit: 0, balance: 0 },
          marketAvg: { deposit: 0, balance: 0 },
          annualExcessCost: 500,
          gapAtRetirement: 0,
          verdict: 'expensive',
          detail: '',
        },
        {
          id: 'p2',
          name: 'ב',
          type: 'PENSION_GENERAL',
          actual: { deposit: 0, balance: 0 },
          marketAvg: { deposit: 0, balance: 0 },
          annualExcessCost: 200,
          gapAtRetirement: 0,
          verdict: 'expensive',
          detail: '',
        },
      ],
      totalAnnualExcessCost: 700,
      totalGapAtRetirement: 0,
      warnings: [],
      trace: emptyTrace,
    } as FeeComparisonResult;
    const taxBenefits = {
      params: {} as TaxBenefitsResult['params'],
      qualifyingIncomeAnnual: 0,
      maxBenefitedDeposits: 0,
      benefitedDeposits: 0,
      taxCredit: 0,
      deductionValue: 0,
      totalAnnualSaving: 0,
      remainingDepositAllowance: 0,
      potentialExtraSaving: 100,
      warnings: [],
      trace: emptyTrace,
    } as TaxBenefitsResult;
    const r = buildInsights({ feeComparison, taxBenefits });
    // שני "warning" (500, 200 — לא מעל 1000 אז לא critical) לפני ה-"info" (100) של המס
    expect(r.insights.map((i) => i.severity)).toEqual(['warning', 'warning', 'info']);
    expect(r.insights[0].estimatedAnnualImpact).toBe(500);
    expect(r.insights[1].estimatedAnnualImpact).toBe(200);
  });
});
