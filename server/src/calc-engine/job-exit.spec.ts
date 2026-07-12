import { calcJobExit } from './job-exit';

describe('calcJobExit — עזיבת עבודה: משיכת פיצויים מול רצף', () => {
  const base = {
    severanceBalance: 200_000,
    yearsOfService: 10,
    lastMonthlySalary: 12_000,
    yearsToRetirement: 20,
    annualReturnPct: 0,
    conversionFactor: 200,
    marginalTaxRatePct: 35,
  };

  it('שכר מתחת לתקרה: הפטור לפי השכר × ותק', () => {
    const r = calcJobExit(base);
    // פטור: 12,000 × 10 = 120,000 ; חייב: 80,000 ; מס: 28,000
    expect(r.exemptAmount).toBe(120_000);
    expect(r.taxableAmount).toBe(80_000);
    expect(r.taxOnTaxable).toBe(28_000);
    expect(r.netToday).toBe(172_000);
  });

  it('שכר מעל התקרה: הפטור נעצר ב-13,750 לשנה', () => {
    const r = calcJobExit({ ...base, lastMonthlySalary: 20_000 });
    expect(r.exemptAmount).toBe(137_500); // 13,750 × 10
    expect(r.taxableAmount).toBe(62_500);
  });

  it('פיצויים קטנים מהתקרה: הכל פטור ואין מס', () => {
    const r = calcJobExit({ ...base, severanceBalance: 100_000 });
    expect(r.exemptAmount).toBe(100_000);
    expect(r.taxableAmount).toBe(0);
    expect(r.netToday).toBe(100_000);
  });

  it('אובדן הקצבה: ללא תשואה — היתרה ÷ המקדם', () => {
    const r = calcJobExit(base);
    expect(r.balanceAtRetirement).toBe(200_000);
    expect(r.monthlyAnnuityLoss).toBe(1_000);
  });

  it('עם תשואה 4% ל-20 שנה: הצבירה מוכפלת ומעלה', () => {
    const r = calcJobExit({ ...base, annualReturnPct: 4 });
    // 200,000 × 1.04^20 ≈ 438,225
    expect(r.balanceAtRetirement).toBeGreaterThan(430_000);
    expect(r.monthlyAnnuityLoss).toBeGreaterThan(2_150);
  });

  it('הפגיעה בקיבוע: הפטור שנוצל × 1.35', () => {
    const r = calcJobExit(base);
    expect(r.kibuaExemptCapitalLoss).toBe(162_000); // 120,000 × 1.35
    expect(r.kibuaMonthlyExemptionLoss).toBe(900); // ÷ 180
  });

  it('אזהרות: ריסק זמני, פריסה, רצף זכויות', () => {
    const r = calcJobExit(base);
    expect(r.warnings.some((w) => w.includes('ריסק זמני'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('פריסה'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('רצף זכויות'))).toBe(true);
  });

  it('ללא חלק חייב — אין אזהרת פריסה', () => {
    const r = calcJobExit({ ...base, severanceBalance: 50_000 });
    expect(r.warnings.some((w) => w.includes('פריסה'))).toBe(false);
  });

  it('עקיפת תקרה (RegulatoryParameter) גוברת', () => {
    const r = calcJobExit({
      ...base,
      lastMonthlySalary: 20_000,
      paramsOverride: { exemptCeilingPerYear: 15_000 },
    });
    expect(r.exemptAmount).toBe(150_000);
  });

  it('ולידציה: ותק אפס נדחה', () => {
    expect(() => calcJobExit({ ...base, yearsOfService: 0 })).toThrow();
  });
});
