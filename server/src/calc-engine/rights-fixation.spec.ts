import { calcRightsFixation, defaultParamsFor } from './rights-fixation';

describe('defaultParamsFor — פרמטרים לפי שנת זכאות', () => {
  it('2028 ואילך: 67% פטור', () => {
    const p = defaultParamsFor(2028);
    expect(p.exemptionPct).toBe(67);
    expect(p.annuityCeilingMonthly).toBe(9430);
  });

  it('2020–2025: 52% פטור', () => {
    expect(defaultParamsFor(2023).exemptionPct).toBe(52);
    expect(defaultParamsFor(2023).annuityCeilingMonthly).toBe(9120);
  });

  it('2016–2019: 49% פטור', () => {
    expect(defaultParamsFor(2016).exemptionPct).toBe(49);
  });

  it('שנה עתידית לא מוכרת — התקרה האחרונה הידועה', () => {
    const p = defaultParamsFor(2030);
    expect(p.annuityCeilingMonthly).toBe(9430);
    expect(p.exemptionPct).toBe(67);
  });
});

describe('calcRightsFixation — הון פטור ונוסחת קיזוז', () => {
  it('2028 ללא מענקים: הון פטור 1,137,258 ₪ ופטור חודשי 6,318.1 ₪', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2028,
      expectedMonthlyPension: 12_000,
    });
    expect(r.exemptCapitalCeiling).toBe(1_137_258);
    expect(r.grantOffset).toBe(0);
    expect(r.remainingExemptCapital).toBe(1_137_258);
    const full = r.scenarios.find((s) => s.key === 'full_pension')!;
    expect(full.monthlyExemption).toBe(6318.1);
    expect(full.taxableMonthlyPension).toBe(5681.9);
  });

  it('2023 (52%): הון פטור 853,632 ₪', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2023,
      expectedMonthlyPension: 10_000,
    });
    expect(r.exemptCapitalCeiling).toBe(853_632);
  });

  it('מענק 100,000 ₪ בחלון: קיזוז 135,000 והפטור החודשי יורד ל-5,568.1', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2028,
      expectedMonthlyPension: 12_000,
      pastGrants: [{ year: 2015, amount: 100_000 }],
    });
    expect(r.countedGrantsTotal).toBe(100_000);
    expect(r.grantOffset).toBe(135_000);
    expect(r.remainingExemptCapital).toBe(1_002_258);
    const full = r.scenarios.find((s) => s.key === 'full_pension')!;
    expect(full.monthlyExemption).toBe(5568.1);
  });

  it('מענק מחוץ לחלון 32 השנים אינו נספר', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2028,
      expectedMonthlyPension: 12_000,
      pastGrants: [
        { year: 1990, amount: 500_000 }, // מחוץ לחלון (לפני 1993)
        { year: 2000, amount: 50_000 }, // בתוך החלון
      ],
    });
    expect(r.countedGrantsTotal).toBe(50_000);
    expect(r.warnings.some((w) => w.includes('אינם פוגעים'))).toBe(true);
  });

  it('מענקים שמוחקים את ההון הפטור: יתרה 0 ואזהרה', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2028,
      expectedMonthlyPension: 12_000,
      pastGrants: [{ year: 2010, amount: 900_000 }],
    });
    expect(r.remainingExemptCapital).toBe(0);
    expect(r.warnings.some((w) => w.includes('מוחקים את מלוא ההון'))).toBe(true);
  });

  it('היוון מקסימלי: פטור חודשי 0 והקצבה כולה חייבת', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2028,
      expectedMonthlyPension: 12_000,
    });
    const max = r.scenarios.find((s) => s.key === 'max_lump_sum')!;
    expect(max.lumpSum).toBe(1_137_258);
    expect(max.monthlyExemption).toBe(0);
    expect(max.taxableMonthlyPension).toBe(12_000);
  });

  it('תרחיש מותאם: היוון 500,000 והשאר לפטור חודשי', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2028,
      expectedMonthlyPension: 12_000,
      pastGrants: [{ year: 2015, amount: 100_000 }],
      desiredLumpSum: 500_000,
    });
    const custom = r.scenarios.find((s) => s.key === 'custom')!;
    expect(custom.lumpSum).toBe(500_000);
    // (1,002,258 − 500,000) ÷ 180 = 2,790.32
    expect(custom.monthlyExemption).toBe(2790.32);
  });

  it('היוון מבוקש מעל היתרה — מוגבל ליתרה עם אזהרה', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2028,
      expectedMonthlyPension: 12_000,
      desiredLumpSum: 2_000_000,
    });
    const custom = r.scenarios.find((s) => s.key === 'custom')!;
    expect(custom.lumpSum).toBe(1_137_258);
    expect(r.warnings.some((w) => w.includes('גדול מהיתרה'))).toBe(true);
  });

  it('קצבה נמוכה מתקרת הפטור: הפטור מוגבל לקצבה + אזהרת ניצול חלקי', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2028,
      expectedMonthlyPension: 4_000,
    });
    const full = r.scenarios.find((s) => s.key === 'full_pension')!;
    expect(full.monthlyExemption).toBe(4_000);
    expect(full.taxableMonthlyPension).toBe(0);
    expect(r.warnings.some((w) => w.includes('לא ינוצל'))).toBe(true);
  });

  it('הערכת חיסכון מס לפי שיעור שולי', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2028,
      expectedMonthlyPension: 12_000,
      marginalTaxRatePct: 20,
    });
    const full = r.scenarios.find((s) => s.key === 'full_pension')!;
    expect(full.estMonthlyTaxSaved).toBe(1263.62);
    const max = r.scenarios.find((s) => s.key === 'max_lump_sum')!;
    expect(max.estMonthlyTaxSaved).toBe(0);
  });

  it('ללא שיעור מס — אין הערכת חיסכון', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2028,
      expectedMonthlyPension: 12_000,
    });
    expect(r.scenarios[0].estMonthlyTaxSaved).toBeNull();
  });

  it('אזהרת אי-הפיכות תמיד קיימת', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2028,
      expectedMonthlyPension: 12_000,
    });
    expect(r.warnings.some((w) => w.includes('161ד'))).toBe(true);
  });

  it('שנה לפני 2012 — שגיאה', () => {
    expect(() =>
      calcRightsFixation({ eligibilityYear: 2010, expectedMonthlyPension: 8_000 }),
    ).toThrow();
  });

  it('עקיפת פרמטרים (מ-RegulatoryParameter) גוברת על ברירות המחדל', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2028,
      expectedMonthlyPension: 12_000,
      paramsOverride: { annuityCeilingMonthly: 10_000 },
    });
    // 10,000 × 67% × 180 = 1,206,000
    expect(r.exemptCapitalCeiling).toBe(1_206_000);
  });
});

describe('defaultParamsFor — פריסת העלייה ל-67% (חוק ההסדרים)', () => {
  it('2025 עדיין 52%', () => {
    expect(defaultParamsFor(2025).exemptionPct).toBe(52);
  });

  it('2026: 57% — פטור חודשי 5,375.1 ₪ (מאומת מול מקור מקצועי)', () => {
    const r = calcRightsFixation({
      eligibilityYear: 2026,
      expectedMonthlyPension: 8_000,
    });
    // 9,430 × 57% = 5,375.1 לחודש
    expect(r.exemptCapitalCeiling).toBe(967_518);
    const full = r.scenarios.find((s) => s.key === 'full_pension')!;
    expect(full.monthlyExemption).toBe(5375.1);
  });

  it('2027: 62.5%', () => {
    expect(defaultParamsFor(2027).exemptionPct).toBe(62.5);
  });
});
