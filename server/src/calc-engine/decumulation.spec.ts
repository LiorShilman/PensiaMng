import { calcDecumulation } from './decumulation';

describe('calcDecumulation — משיכה הדרגתית בפרישה', () => {
  it('תשואה 0: משיכה בת-קיימא = הון ÷ חודשים', () => {
    const r = calcDecumulation({
      capitalAtRetirement: 276_000,
      retirementAge: 67,
      annualReturnPct: 0,
      targetAge: 90,
    });
    // 276,000 ÷ 276 חודשים = 1,000
    expect(r.sustainableMonthly).toBe(1_000);
  });

  it('משיכה מעל בת-הקיימא: אזילה לפני גיל היעד + אזהרה', () => {
    const r = calcDecumulation({
      capitalAtRetirement: 240_000,
      retirementAge: 67,
      annualReturnPct: 0,
      monthlyWithdrawal: 2_000,
      targetAge: 90,
    });
    // 240,000 ÷ 2,000 = 120 חודשים = 10 שנים → גיל 77
    expect(r.monthsUntilDepletion).toBe(120);
    expect(r.depletionAge).toBe(77);
    expect(r.warnings.some((w) => w.includes('אוזל בגיל 77'))).toBe(true);
  });

  it('משיכה נמוכה מהתשואה: ההון לא אוזל', () => {
    const r = calcDecumulation({
      capitalAtRetirement: 1_000_000,
      retirementAge: 67,
      annualReturnPct: 3,
      monthlyWithdrawal: 1_000, // התשואה ~2,470/חודש
    });
    expect(r.depletionAge).toBeNull();
    expect(r.warnings.some((w) => w.includes('אינו אוזל'))).toBe(true);
  });

  it('עם תשואה חיובית המשיכה בת-הקיימא גבוהה מחלוקה פשוטה', () => {
    const r = calcDecumulation({
      capitalAtRetirement: 500_000,
      retirementAge: 67,
      annualReturnPct: 2.5,
      targetAge: 90,
    });
    expect(r.sustainableMonthly!).toBeGreaterThan(500_000 / 276);
    expect(r.sustainableMonthly!).toBeLessThan(3_000);
  });

  it('ברירת מחדל: המשיכה הנבדקת היא בת-הקיימא — אזילה סמוך לגיל היעד', () => {
    const r = calcDecumulation({
      capitalAtRetirement: 500_000,
      retirementAge: 67,
      annualReturnPct: 2.5,
      targetAge: 90,
    });
    expect(r.depletionAge).toBeGreaterThanOrEqual(89.5);
    expect(r.depletionAge).toBeLessThanOrEqual(90.5);
  });

  it('הסדרה שנתית ומתאפסת באזילה', () => {
    const r = calcDecumulation({
      capitalAtRetirement: 120_000,
      retirementAge: 67,
      annualReturnPct: 0,
      monthlyWithdrawal: 10_000,
    });
    expect(r.monthsUntilDepletion).toBe(12);
    expect(r.series.at(-1)!.balance).toBe(0);
  });

  it('ולידציה: גיל יעד לפני פרישה נדחה', () => {
    expect(() =>
      calcDecumulation({
        capitalAtRetirement: 100_000,
        retirementAge: 67,
        annualReturnPct: 2,
        targetAge: 60,
      }),
    ).toThrow();
  });
});
