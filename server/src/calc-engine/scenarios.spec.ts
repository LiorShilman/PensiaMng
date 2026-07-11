import { calcScenarios } from './scenarios';
import type { ScenarioProductInput, ScenariosInput } from './scenarios';

const ASOF = '2026-07-01';

const pension: ScenarioProductInput = {
  id: 'p1',
  name: 'קרן פנסיה',
  type: 'PENSION_COMPREHENSIVE',
  currentBalance: 500_000,
};

const managers: ScenarioProductInput = {
  id: 'p2',
  name: 'ביטוח מנהלים',
  type: 'MANAGERS_INSURANCE',
  currentBalance: 200_000,
  deathBenefitAmount: 1_000_000,
};

const study: ScenarioProductInput = {
  id: 'p3',
  name: 'השתלמות',
  type: 'STUDY_FUND',
  currentBalance: 150_000,
};

function base(overrides: Partial<ScenariosInput> = {}): ScenariosInput {
  return {
    family: { hasSpouse: true, childrenBirthDates: ['2015-06-01', '2018-03-01'] },
    insuredMonthlySalary: 20_000,
    products: [pension, managers, study],
    asOf: ASOF,
    ...overrides,
  };
}

describe('calcScenarios — death', () => {
  it('spouse + 2 minor children: 60% + 2×40% capped at 100% of covered salary', () => {
    const r = calcScenarios(base());
    const pensionOutcome = r.death.products.find((p) => p.id === 'p1')!;
    // 0.6 + 0.8 = 1.4 → מוגבל ל-1.0 → 20,000
    expect(pensionOutcome.survivorMonthly).toBe(20_000);
    expect(pensionOutcome.lumpSum).toBe(0);
    expect(r.death.eligibleChildren).toBe(2);
  });

  it('spouse only: 60% of covered salary', () => {
    const r = calcScenarios(base({ family: { hasSpouse: true, childrenBirthDates: [] } }));
    expect(r.death.products.find((p) => p.id === 'p1')!.survivorMonthly).toBe(12_000);
  });

  it('single parent with one minor child: 40%', () => {
    const r = calcScenarios(
      base({ family: { hasSpouse: false, childrenBirthDates: ['2010-01-01'] } }),
    );
    expect(r.death.products.find((p) => p.id === 'p1')!.survivorMonthly).toBe(8_000);
  });

  it('children over 21 are not eligible orphans', () => {
    const r = calcScenarios(
      base({
        family: {
          hasSpouse: false,
          childrenBirthDates: ['2000-01-01', '2010-01-01'], // 26 ו-16
        },
      }),
    );
    expect(r.death.eligibleChildren).toBe(1);
    expect(r.death.products.find((p) => p.id === 'p1')!.survivorMonthly).toBe(8_000);
  });

  it('no survivors: pension balance becomes a lump sum to beneficiaries', () => {
    const r = calcScenarios(
      base({ family: { hasSpouse: false, childrenBirthDates: [] } }),
    );
    const pensionOutcome = r.death.products.find((p) => p.id === 'p1')!;
    expect(pensionOutcome.survivorMonthly).toBe(0);
    expect(pensionOutcome.lumpSum).toBe(500_000);
  });

  it('survivors waiver: balance to beneficiaries even with a family', () => {
    const waived = { ...pension, survivorsWaiver: true };
    const r = calcScenarios(base({ products: [waived] }));
    const outcome = r.death.products[0];
    expect(outcome.survivorMonthly).toBe(0);
    expect(outcome.lumpSum).toBe(500_000);
  });

  it('survivors coverage percent scales the covered salary', () => {
    const partial = { ...pension, survivorsPct: 50 };
    const r = calcScenarios(
      base({ products: [partial], family: { hasSpouse: true, childrenBirthDates: [] } }),
    );
    // 20,000 × 50% × 60% = 6,000
    expect(r.death.products[0].survivorMonthly).toBe(6_000);
  });

  it('managers insurance: balance + death benefit as lump sum', () => {
    const r = calcScenarios(base());
    const m = r.death.products.find((p) => p.id === 'p2')!;
    expect(m.lumpSum).toBe(1_200_000);
    expect(m.survivorMonthly).toBe(0);
  });

  it('study fund balance goes to beneficiaries', () => {
    const r = calcScenarios(base());
    expect(r.death.products.find((p) => p.id === 'p3')!.lumpSum).toBe(150_000);
  });

  it('death gap vs 70% target: covered fully when survivor income >= target', () => {
    const r = calcScenarios(base());
    expect(r.death.targetMonthly).toBe(14_000); // 70% מ-20,000
    expect(r.death.totalSurvivorMonthly).toBe(20_000);
    expect(r.death.gapMonthly).toBe(0);
  });

  it('death gap appears when there is no pension coverage', () => {
    const r = calcScenarios(base({ products: [study] }));
    expect(r.death.totalSurvivorMonthly).toBe(0);
    expect(r.death.gapMonthly).toBe(14_000);
    expect(r.warnings.some((w) => w.includes('אין בתיק קרן פנסיה'))).toBe(true);
  });
});

describe('calcScenarios — per-fund insured salary', () => {
  it('a fund with its own insured salary uses it; another falls back to the global salary', () => {
    const oldFund: ScenarioProductInput = {
      ...pension,
      id: 'old',
      name: 'קרן ישנה',
      insuredMonthlySalary: 8_000, // שכר קובע נמוך בקרן מוקפאת
    };
    const activeFund: ScenarioProductInput = { ...pension, id: 'active', name: 'קרן פעילה' };
    const r = calcScenarios(
      base({
        products: [oldFund, activeFund],
        family: { hasSpouse: true, childrenBirthDates: [] },
      }),
    );
    // ישנה: 8,000 × 60% = 4,800 · פעילה: 20,000 × 60% = 12,000
    expect(r.death.products.find((p) => p.id === 'old')!.survivorMonthly).toBe(4_800);
    expect(r.death.products.find((p) => p.id === 'active')!.survivorMonthly).toBe(12_000);
    expect(r.death.totalSurvivorMonthly).toBe(16_800);
  });

  it('per-fund salary also drives disability pension', () => {
    const fund = { ...pension, insuredMonthlySalary: 10_000 };
    const r = calcScenarios(base({ products: [fund] }));
    expect(r.disability.products[0].disabilityMonthly).toBe(7_500); // 75% מ-10,000
  });
});

describe('calcScenarios — frozen (inactive) pension fund', () => {
  it('a frozen pension provides no survivor pension — balance becomes a lump sum', () => {
    const frozen: ScenarioProductInput = {
      ...pension,
      id: 'frz',
      name: 'קרן מגירושין',
      frozen: true,
      currentBalance: 320_000,
    };
    const r = calcScenarios(base({ products: [frozen] }));
    const outcome = r.death.products[0];
    expect(outcome.survivorMonthly).toBe(0);
    expect(outcome.lumpSum).toBe(320_000);
    expect(outcome.detail).toContain('לא פעילה');
  });

  it('a frozen pension provides no disability coverage', () => {
    const frozen = { ...pension, frozen: true };
    const r = calcScenarios(base({ products: [frozen] }));
    expect(r.disability.products[0].disabilityMonthly).toBe(0);
    expect(r.disability.products[0].detail).toContain('לא פעילה');
  });

  it('frozen funds do not trigger the double-coverage warning, but do trigger consolidation advice', () => {
    const frozen = { ...pension, id: 'frz', frozen: true };
    const r = calcScenarios(base({ products: [pension, frozen] }));
    expect(r.warnings.some((w) => w.includes('כפל'))).toBe(false);
    expect(r.warnings.some((w) => w.includes('איחוד'))).toBe(true);
  });

  it('a portfolio with only frozen pensions warns about no active coverage', () => {
    const frozen = { ...pension, frozen: true };
    const r = calcScenarios(base({ products: [frozen] }));
    expect(r.warnings.some((w) => w.includes('אין בתיק קרן פנסיה פעילה'))).toBe(true);
  });
});

describe('calcScenarios — disability', () => {
  it('default disability coverage: 75% of insured salary + deposit release', () => {
    const r = calcScenarios(base({ products: [pension] }));
    const d = r.disability.products[0];
    expect(d.disabilityMonthly).toBe(15_000);
    expect(d.detail).toContain('שחרור מהפקדות');
  });

  it('custom disability percent', () => {
    const partial = { ...pension, disabilityPct: 37.5 };
    const r = calcScenarios(base({ products: [partial] }));
    expect(r.disability.products[0].disabilityMonthly).toBe(7_500);
  });

  it('capital products provide no disability coverage', () => {
    const r = calcScenarios(base({ products: [study] }));
    expect(r.disability.totalDisabilityMonthly).toBe(0);
    expect(r.disability.gapMonthly).toBe(14_000);
  });
});

describe('calcScenarios — standalone disability insurance (אכ"ע פרטי)', () => {
  const policy: ScenarioProductInput = {
    id: 'pol',
    name: 'אכ"ע פרטי מנורה',
    type: 'DISABILITY_INSURANCE',
    currentBalance: 0,
    insuredMonthlySalary: 15_523, // חצי השכר שלא מבוטח בקרן
    umbrella: true,
  };

  it("the user's exact case: pension on half salary + private policy on the other half = exactly the 75% cap, no gap", () => {
    const halfPension = { ...pension, insuredMonthlySalary: 15_522 };
    const r = calcScenarios(
      base({
        insuredMonthlySalary: 31_045,
        products: [halfPension, policy],
      }),
    );
    // 75%×15,522 + 75%×15,523 = 23,283.75 = בדיוק 75% מ-31,045
    expect(r.disability.uncappedTotalMonthly).toBeCloseTo(23_283.75, 1);
    expect(r.disability.totalDisabilityMonthly).toBeCloseTo(23_283.75, 1);
    expect(r.disability.excessMonthly).toBe(0);
    // היעד 70% מ-31,045 = 21,731.5 — מכוסה
    expect(r.disability.gapMonthly).toBe(0);
  });

  it('policy pays nothing on death (pure insurance, no savings)', () => {
    const r = calcScenarios(base({ products: [policy] }));
    const d = r.death.products[0];
    expect(d.survivorMonthly).toBe(0);
    expect(d.lumpSum).toBe(0);
    expect(d.detail).toContain('ביטוח טהורה');
  });

  it('umbrella flag is reflected in the disability detail', () => {
    const r = calcScenarios(base({ products: [policy] }));
    expect(r.disability.products[0].detail).toContain('מטריה');
  });
});

describe('calcScenarios — aggregate disability cap (75%)', () => {
  it('two active pensions are capped at 75% of the global salary, with excess reported', () => {
    const second = { ...pension, id: 'p9', name: 'קרן שנייה' };
    const r = calcScenarios(base({ products: [pension, second] }));
    // כל קרן 75% מ-20,000 = 15,000; סכום גולמי 30,000; תקרה 15,000
    expect(r.disability.uncappedTotalMonthly).toBe(30_000);
    expect(r.disability.totalDisabilityMonthly).toBe(15_000);
    expect(r.disability.excessMonthly).toBe(15_000);
    expect(r.warnings.some((w) => w.includes('כיסוי עודף'))).toBe(true);
  });

  it('a single pension within the cap is not capped and reports no excess', () => {
    const r = calcScenarios(base({ products: [pension] }));
    expect(r.disability.totalDisabilityMonthly).toBe(15_000);
    expect(r.disability.excessMonthly).toBe(0);
  });
});

describe('calcScenarios — money-flow splits', () => {
  it('splits survivor pension between spouse and children, scaled at the cap', () => {
    const r = calcScenarios(base({ products: [pension] }));
    const d = r.death.products[0];
    // 0.6+0.8=1.4 → scale 1/1.4: spouse 20000*0.6/1.4=8571.43, children 11428.57
    expect(d.spouseMonthly).toBeCloseTo(8_571.43, 1);
    expect(d.childrenMonthly).toBeCloseTo(11_428.57, 1);
    expect(d.survivorMonthly).toBeCloseTo(20_000, 1);
  });

  it('lump sum with named beneficiaries splits by percent, remainder to legal heirs', () => {
    const withBens: ScenarioProductInput = {
      ...study,
      beneficiaries: [
        { name: 'דנה', pct: 50 },
        { name: 'יובל', pct: 30 },
      ],
    };
    const r = calcScenarios(base({ products: [withBens] }));
    const split = r.death.products[0].lumpSumSplit;
    expect(split).toEqual([
      { name: 'דנה', amount: 75_000 },
      { name: 'יובל', amount: 45_000 },
      { name: 'יורשים על פי דין', amount: 30_000 },
    ]);
  });

  it('no beneficiaries defined → everything to legal heirs', () => {
    const r = calcScenarios(base({ products: [study] }));
    expect(r.death.products[0].lumpSumSplit).toEqual([
      { name: 'יורשים על פי דין', amount: 150_000 },
    ]);
  });

  it('beneficiary percents above 100 are rejected', () => {
    const bad: ScenarioProductInput = {
      ...study,
      beneficiaries: [
        { name: 'א', pct: 70 },
        { name: 'ב', pct: 50 },
      ],
    };
    expect(() => calcScenarios(base({ products: [bad] }))).toThrow(/100%/);
  });
});

describe('calcScenarios — retirement phase (death after retirement)', () => {
  const annuityProduct: ScenarioProductInput = {
    id: 'a',
    name: 'קרן פנסיה',
    type: 'PENSION_COMPREHENSIVE',
    currentBalance: 0,
    monthlyAnnuity: 10_000,
    balanceAtRetirement: 2_000_000,
  };
  const capitalProduct: ScenarioProductInput = {
    id: 'c',
    name: 'השתלמות',
    type: 'STUDY_FUND',
    currentBalance: 0,
    balanceAtRetirement: 400_000,
  };

  it('with a spouse: survivor gets 60% of the annuity for life', () => {
    const r = calcScenarios(
      base({
        products: [annuityProduct],
        family: { hasSpouse: true, childrenBirthDates: [] },
        retirementPhase: { monthsSinceRetirement: 36 },
      }),
    );
    const d = r.death.products[0];
    expect(d.spouseMonthly).toBe(6_000);
    expect(d.lumpSum).toBe(0);
  });

  it('without a spouse: remaining guaranteed payments go to heirs', () => {
    const r = calcScenarios(
      base({
        products: [annuityProduct],
        family: { hasSpouse: false, childrenBirthDates: [] },
        retirementPhase: { monthsSinceRetirement: 100 },
      }),
    );
    const d = r.death.products[0];
    // 240 − 100 = 140 חודשים × 10,000
    expect(d.lumpSum).toBe(1_400_000);
    expect(d.survivorMonthly).toBe(0);
  });

  it('after the guarantee period ends the annuity lapses with nothing to heirs', () => {
    const r = calcScenarios(
      base({
        products: [annuityProduct],
        family: { hasSpouse: false, childrenBirthDates: [] },
        retirementPhase: { monthsSinceRetirement: 300 },
      }),
    );
    expect(r.death.products[0].lumpSum).toBe(0);
    expect(r.death.products[0].detail).toContain('פוקעת');
  });

  it('capital products pass their retirement balance to beneficiaries; disability is zero', () => {
    const r = calcScenarios(
      base({
        products: [capitalProduct],
        family: { hasSpouse: true, childrenBirthDates: [] },
        retirementPhase: { monthsSinceRetirement: 12 },
      }),
    );
    expect(r.death.products[0].lumpSum).toBe(400_000);
    expect(r.disability.totalDisabilityMonthly).toBe(0);
    expect(r.disability.products[0].detail).toContain('לאחר הפרישה');
  });

  it('custom survivor percent and guarantee period are honored', () => {
    const custom = { ...annuityProduct, retirementSurvivorPct: 100, guaranteedMonths: 120 };
    const withSpouse = calcScenarios(
      base({
        products: [custom],
        family: { hasSpouse: true, childrenBirthDates: [] },
        retirementPhase: { monthsSinceRetirement: 0 },
      }),
    );
    expect(withSpouse.death.products[0].spouseMonthly).toBe(10_000);

    const noSpouse = calcScenarios(
      base({
        products: [custom],
        family: { hasSpouse: false, childrenBirthDates: [] },
        retirementPhase: { monthsSinceRetirement: 60 },
      }),
    );
    expect(noSpouse.death.products[0].lumpSum).toBe(600_000); // (120−60)×10,000
  });
});

describe('calcScenarios — warnings & validation', () => {
  it('warns when insured salary is 0', () => {
    const r = calcScenarios(base({ insuredMonthlySalary: 0 }));
    expect(r.warnings.some((w) => w.includes('שכר מבוטח'))).toBe(true);
  });

  it('suggests survivors waiver for singles without children', () => {
    const r = calcScenarios(
      base({ family: { hasSpouse: false, childrenBirthDates: [] } }),
    );
    expect(r.warnings.some((w) => w.includes('ויתור'))).toBe(true);
  });

  it('warns on possible double coverage with two pension funds', () => {
    const second = { ...pension, id: 'p9', name: 'קרן שנייה' };
    const r = calcScenarios(base({ products: [pension, second] }));
    expect(r.warnings.some((w) => w.includes('כפל'))).toBe(true);
  });

  it('rejects negative salary and bad child birth date', () => {
    expect(() => calcScenarios(base({ insuredMonthlySalary: -1 }))).toThrow();
    expect(() =>
      calcScenarios(
        base({ family: { hasSpouse: true, childrenBirthDates: ['oops'] } }),
      ),
    ).toThrow(/לא תקין/);
  });

  it('includes a calculation trace', () => {
    const r = calcScenarios(base());
    expect(r.trace.formula).toContain('survivorMonthly');
    expect(r.trace.inputs.eligibleChildren).toBe(2);
  });
});

describe('calcScenarios — ביטוח לאומי בתרחישים', () => {
  it('כבוי כברירת מחדל: שדות ה-NI אפס והסכומים ללא שינוי', () => {
    const r = calcScenarios(base());
    expect(r.death.niSurvivorsMonthly).toBe(0);
    expect(r.disability.niDisabilityMonthly).toBe(0);
    expect(r.disability.niOffsetReduction).toBe(0);
  });

  it('מוות עם NI: אלמנה + 2 ילדים מתחת ל-18 → 1,795 + 2×902', () => {
    const r = calcScenarios(
      base({ nationalInsurance: { include: true, spouseAge: 45 } }),
    );
    // ילדים ילידי 2015/2018 → מתחת ל-18 ב-2026; אלמנה צעירה עם ילדים → קצבה מלאה
    expect(r.death.niSurvivorsMonthly).toBe(3599);
    // הפער קטן בהתאם
    const rOff = calcScenarios(base());
    expect(r.death.gapMonthly).toBeLessThanOrEqual(rOff.death.gapMonthly);
  });

  it('נכות עם NI ללא חריגה מהשכר: אין קיזוז', () => {
    // קרן 75% × 20,000 = 15,000 ; NI 4,291 ; סה"כ 19,291 < 20,000
    const r = calcScenarios(
      base({ nationalInsurance: { include: true } }),
    );
    expect(r.disability.niDisabilityMonthly).toBe(4291);
    expect(r.disability.niOffsetReduction).toBe(0);
    expect(r.disability.totalDisabilityMonthly).toBe(15_000);
  });

  it('נכות עם NI וחריגה מהשכר: הקרן מקזזת את העודף', () => {
    // שכר 10,000: קרן 7,500 + NI 4,291 = 11,791 → קיזוז 1,791
    const r = calcScenarios(
      base({
        insuredMonthlySalary: 10_000,
        nationalInsurance: { include: true },
      }),
    );
    expect(r.disability.niOffsetReduction).toBe(1791);
    expect(r.disability.totalDisabilityMonthly).toBe(5709);
    expect(r.warnings.some((w) => w.includes('קיזוז ביטוח לאומי'))).toBe(true);
  });

  it('מטריה ביטוחית מגינה מפני הקיזוז', () => {
    // פוליסת אכ"ע פרטית עם מטריה על מחצית השכר + קרן על המחצית השנייה
    const fund: ScenarioProductInput = {
      ...pension,
      insuredMonthlySalary: 5_000,
    };
    const policy: ScenarioProductInput = {
      id: 'p8',
      name: 'אכ"ע פרטי',
      type: 'DISABILITY_INSURANCE',
      currentBalance: 0,
      insuredMonthlySalary: 5_000,
      umbrella: true,
    };
    const r = calcScenarios(
      base({
        insuredMonthlySalary: 10_000,
        products: [fund, policy],
        nationalInsurance: { include: true },
      }),
    );
    // קרן 3,750 + פוליסה 3,750 = 7,500 ; NI 4,291 → עודף 1,791
    // מוגן במטריה: 3,750 → ניתן לקזז רק מהקרן (3,750)
    expect(r.disability.niOffsetReduction).toBe(1791);
    expect(r.disability.totalDisabilityMonthly).toBe(5709);
  });

  it('יתום מעל 18 אינו נספר ב-NI אך נספר בקרן (עד 21)', () => {
    const r = calcScenarios(
      base({
        family: { hasSpouse: false, childrenBirthDates: ['2007-06-15'] }, // גיל 19 ב-2026
        nationalInsurance: { include: true },
      }),
    );
    expect(r.death.eligibleChildren).toBe(1); // קרן: עד 21
    expect(r.death.niSurvivorsMonthly).toBe(0); // NI: עד 18
  });
});
