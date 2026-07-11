import {
  calcNiDisability,
  calcNiOldAge,
  calcNiSurvivors,
} from './national-insurance';

describe('calcNiOldAge — קצבת אזרח ותיק', () => {
  it('יחיד עם 35 שנות ביטוח: בסיס + ותק מקסימלי (50%)', () => {
    const r = calcNiOldAge({ insuranceYears: 35, spouseSupplementEligible: false });
    // 1,795 + 1,795 × 50% = 2,692.5
    expect(r.seniorityPct).toBe(50);
    expect(r.monthly).toBe(2692.5);
  });

  it('תוספת ותק חלקית: 10 שנים → 20%', () => {
    const r = calcNiOldAge({ insuranceYears: 10, spouseSupplementEligible: false });
    expect(r.seniorityPct).toBe(20);
    expect(r.monthly).toBe(round(1795 + 1795 * 0.2));
  });

  it('תוספת בן/בת זוג', () => {
    const r = calcNiOldAge({ insuranceYears: 35, spouseSupplementEligible: true });
    expect(r.spouseSupplement).toBe(902);
    expect(r.monthly).toBe(3594.5);
  });

  it('0 שנות ביטוח: הבסיס בלבד', () => {
    const r = calcNiOldAge({ insuranceYears: 0, spouseSupplementEligible: false });
    expect(r.monthly).toBe(1795);
  });
});

describe('calcNiSurvivors — קצבת שאירים', () => {
  it('אלמנה 50+ עם שני יתומים מתחת ל-18', () => {
    const r = calcNiSurvivors({ hasSpouse: true, spouseAge: 55, childrenAges: [10, 15] });
    // 1,795 + 2 × 902 = 3,599
    expect(r.widowMonthly).toBe(1795);
    expect(r.eligibleOrphans).toBe(2);
    expect(r.monthly).toBe(3599);
  });

  it('יתום מעל 18 אינו זכאי בביטוח לאומי (אך זכאי בקרן עד 21)', () => {
    const r = calcNiSurvivors({ hasSpouse: true, spouseAge: 55, childrenAges: [19, 10] });
    expect(r.eligibleOrphans).toBe(1);
    expect(r.trace.notes.some((n) => n.includes('עד גיל 18'))).toBe(true);
  });

  it('אלמן/ה 40–49 ללא ילדים: קצבה מופחתת', () => {
    const r = calcNiSurvivors({ hasSpouse: true, spouseAge: 45, childrenAges: [] });
    expect(r.widowMonthly).toBe(1349);
  });

  it('אלמן/ה צעיר/ה עם ילדים: קצבה מלאה', () => {
    const r = calcNiSurvivors({ hasSpouse: true, spouseAge: 38, childrenAges: [5] });
    expect(r.widowMonthly).toBe(1795);
  });

  it('ללא בן זוג: יתומים בלבד', () => {
    const r = calcNiSurvivors({ hasSpouse: false, childrenAges: [8] });
    expect(r.widowMonthly).toBe(0);
    expect(r.monthly).toBe(902);
  });

  it('גיל אלמן/ה לא נמסר — הנחת 50+', () => {
    const r = calcNiSurvivors({ hasSpouse: true, childrenAges: [] });
    expect(r.widowMonthly).toBe(1795);
  });
});

describe('calcNiDisability — נכות כללית', () => {
  it('קצבה מלאה ליחיד', () => {
    const r = calcNiDisability();
    expect(r.monthly).toBe(4291);
  });

  it('עקיפת פרמטרים', () => {
    const r = calcNiDisability({ disabilityFullIndividual: 4500 });
    expect(r.monthly).toBe(4500);
  });
});

const round = (n: number) => Math.round(n * 100) / 100;
