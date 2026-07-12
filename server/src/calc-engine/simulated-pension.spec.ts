import { calcSimulatedPension } from './simulated-pension';

describe('calcSimulatedPension — פרישה מדומה', () => {
  const base = {
    currentAge: 60,
    startAge: 60,
    legalRetirementAge: 67,
    balanceNow: 1_000_000,
    monthlyDeposit: 0,
    annualReturnPct: 0,
    conversionFactorAtStart: 200,
    conversionFactorAtLegal: 185,
    marginalTaxRatePct: 35,
  };

  it('ללא צמיחה: קצבה מוקדמת 5,000 ברוטו / 3,250 נטו, חלון 84 חודשים', () => {
    const r = calcSimulatedPension(base);
    expect(r.balanceAtStart).toBe(1_000_000);
    expect(r.earlyMonthlyGross).toBe(5_000);
    expect(r.earlyMonthlyNetWhileWorking).toBe(3_250);
    expect(r.windowMonths).toBe(84);
    expect(r.totalNetDuringWindow).toBe(273_000);
  });

  it('ללא צמיחה ההמתנה משפרת רק את המקדם — נקודת האיזון רחוקה מאוד', () => {
    const r = calcSimulatedPension(base);
    expect(r.waitMonthlyGross).toBe(5_405.41);
    expect(r.monthlyLossAfterLegal).toBe(405.41);
    // 273,000 ÷ 405.41 ≈ 673 חודשים ≈ 56 שנים אחרי 67
    expect(r.breakEvenAge).toBeGreaterThan(120);
  });

  it('עם תשואה 4%: ההמתנה מגדילה את הקצבה ונקודת האיזון סביב גיל 78', () => {
    const r = calcSimulatedPension({ ...base, annualReturnPct: 4 });
    expect(r.balanceAtLegal).toBeGreaterThan(1_310_000);
    expect(r.waitMonthlyGross).toBeGreaterThan(7_000);
    expect(r.breakEvenAge).toBeGreaterThan(76);
    expect(r.breakEvenAge).toBeLessThan(80);
  });

  it('בתרחיש ההמתנה ההפקדות נמשכות עד הגיל החוקי', () => {
    const r = calcSimulatedPension({
      ...base,
      currentAge: 60,
      startAge: 61,
      balanceNow: 0,
      monthlyDeposit: 1_000,
    });
    expect(r.balanceAtStart).toBe(12_000);
    expect(r.balanceAtLegal).toBe(84_000); // 12,000 + 72 חודשי הפקדה נוספים
  });

  it('מס שולי גבוה מקטין את הנטו בחלון', () => {
    const low = calcSimulatedPension({ ...base, marginalTaxRatePct: 20 });
    const high = calcSimulatedPension({ ...base, marginalTaxRatePct: 47 });
    expect(low.earlyMonthlyNetWhileWorking).toBeGreaterThan(
      high.earlyMonthlyNetWhileWorking,
    );
    expect(low.earlyMonthlyGross).toBe(high.earlyMonthlyGross);
  });

  it('אזהרות: ביטול כיסויים, מס שולי, נקודת איזון', () => {
    const r = calcSimulatedPension({ ...base, annualReturnPct: 4 });
    expect(r.warnings.some((w) => w.includes('בלתי הפיכה'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('ביטוח לאומי'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('נקודת האיזון'))).toBe(true);
  });

  it('ולידציה: גיל הפעלה מתחת ל-60 נדחה', () => {
    expect(() => calcSimulatedPension({ ...base, startAge: 58 })).toThrow(/גיל 60/);
  });

  it('ולידציה: גיל הפעלה אחרי הגיל החוקי נדחה', () => {
    expect(() =>
      calcSimulatedPension({ ...base, startAge: 68, legalRetirementAge: 67 }),
    ).toThrow();
  });

  it('ולידציה: גיל נוכחי גדול מגיל ההפעלה נדחה', () => {
    expect(() => calcSimulatedPension({ ...base, currentAge: 62, startAge: 60 })).toThrow();
  });
});
