import { calcFamilyScenarios } from './family-scenarios';
import type { FamilyScenariosInput } from './family-scenarios';
import type { ScenarioProductInput, ScenariosInput } from './scenarios';

const ASOF = '2026-07-01';

const primaryPension: ScenarioProductInput = {
  id: 'p1',
  name: 'קרן פנסיה עיקרי',
  type: 'PENSION_COMPREHENSIVE',
  currentBalance: 500_000,
};

const spousePension: ScenarioProductInput = {
  id: 's1',
  name: 'קרן פנסיה זוג',
  type: 'PENSION_COMPREHENSIVE',
  currentBalance: 300_000,
};

function scenariosOf(
  salary: number,
  products: ScenarioProductInput[],
  overrides: Partial<ScenariosInput> = {},
): ScenariosInput {
  return {
    family: { hasSpouse: true, childrenBirthDates: ['2015-06-01'] },
    insuredMonthlySalary: salary,
    products,
    asOf: ASOF,
    ...overrides,
  };
}

function base(overrides: Partial<FamilyScenariosInput> = {}): FamilyScenariosInput {
  return {
    primary: {
      label: 'רועי',
      insuredMonthlySalary: 20_000,
      scenarios: scenariosOf(20_000, [primaryPension]),
    },
    spouse: {
      label: 'דנה',
      insuredMonthlySalary: 15_000,
      scenarios: scenariosOf(15_000, [spousePension]),
    },
    ...overrides,
  };
}

describe('calcFamilyScenarios', () => {
  it('baseline household income = sum of both salaries', () => {
    const r = calcFamilyScenarios(base());
    expect(r.baselineHouseholdMonthly).toBe(35_000);
    expect(r.targetMonthly).toBe(24_500); // 70% × 35,000
  });

  it('if primary dies: spouse keeps own salary + primary product survivor benefit', () => {
    const r = calcFamilyScenarios(base());
    // primary pension: spouse 60% + 1 child 40% = 100% of 20,000 covered salary = 20,000
    expect(r.ifPrimaryDies.survivorLabel).toBe('דנה');
    expect(r.ifPrimaryDies.ownContinuingIncome).toBe(15_000);
    expect(r.ifPrimaryDies.productsSurvivorMonthly).toBe(20_000);
    expect(r.ifPrimaryDies.totalHouseholdMonthly).toBe(35_000);
    expect(r.ifPrimaryDies.gapMonthly).toBe(0);
  });

  it('if spouse dies: primary keeps own salary + spouse product survivor benefit', () => {
    const r = calcFamilyScenarios(base());
    // spouse pension: 60%+40%=100% of 15,000 covered salary = 15,000
    expect(r.ifSpouseDies.survivorLabel).toBe('רועי');
    expect(r.ifSpouseDies.ownContinuingIncome).toBe(20_000);
    expect(r.ifSpouseDies.productsSurvivorMonthly).toBe(15_000);
    expect(r.ifSpouseDies.totalHouseholdMonthly).toBe(35_000);
  });

  it('gap appears when the surviving household income falls short of target', () => {
    const r = calcFamilyScenarios(
      base({
        spouse: {
          label: 'דנה',
          insuredMonthlySalary: 15_000,
          scenarios: scenariosOf(15_000, [
            { ...spousePension, survivorsWaiver: true },
          ]),
        },
      }),
    );
    // spouse pension waived survivor coverage → lump sum only, no monthly benefit
    expect(r.ifSpouseDies.productsSurvivorMonthly).toBe(0);
    expect(r.ifSpouseDies.lumpSum).toBe(300_000);
    expect(r.ifSpouseDies.totalHouseholdMonthly).toBe(20_000);
    expect(r.ifSpouseDies.gapMonthly).toBe(4_500); // 24,500 target - 20,000
  });

  it('collects warnings from both underlying scenarios, labeled', () => {
    const r = calcFamilyScenarios(
      base({
        primary: {
          label: 'רועי',
          insuredMonthlySalary: 0,
          scenarios: scenariosOf(0, [primaryPension]),
        },
        spouse: {
          label: 'דנה',
          insuredMonthlySalary: 0,
          scenarios: scenariosOf(0, [{ ...spousePension, type: 'STUDY_FUND' }]),
        },
      }),
    );
    // primary: no salary entered → warning; spouse: no active pension fund → warning
    expect(r.warnings.some((w) => w.startsWith('רועי:'))).toBe(true);
    expect(r.warnings.some((w) => w.startsWith('דנה:'))).toBe(true);
  });
});
