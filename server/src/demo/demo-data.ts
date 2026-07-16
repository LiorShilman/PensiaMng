import type { SavedPortfolio } from '../portfolio/portfolio.service';

/**
 * תמונת מצב קנונית להדגמה — משתמש "דמו" עם תיק עשיר שמכסה כמעט את כל
 * סוגי המוצרים והיכולות: כיסויים ביטוחיים, ניוד, מוטבים, מסלולי השקעה,
 * קרן מוקפאת, מטריה ביטוחית, ילדים מתחת/מעל גיל 21, ותיק בן/בת זוג
 * נפרד (מבט זוגי). נטען מחדש בכל כניסת דמו כדי שההדגמה תמיד תיראה שלמה.
 *
 * חשוב: שמות בדיוניים בלבד ("ישראל ישראלי", "קרן דוגמה") — לא שמות של
 * גופים מוסדיים אמיתיים — כדי שיהיה חד-משמעי שזה תיק הדגמה ולא נתונים
 * אמיתיים של מישהו.
 */

export const DEMO_PRIMARY_PORTFOLIO: SavedPortfolio = {
  assumptions: {
    annualReturnPct: 4,
    annualSalaryGrowthPct: 2,
    // מידע אישי היפותטי (בקשת היוון + מענקי עבר) — קיים רק כדי שהדגמה תראה
    // את תרחיש "השילוב" השלישי ואת קיזוז המענקים; משתמשים אמיתיים מתחילים
    // ריק, כי אלה נתונים אישיים שאי אפשר לנחש
    fixationInput: {
      lumpSum: 300_000,
      grants: [{ year: 2015, amount: 45_000, employer: 'מעסיק קודם (דוגמה)' }],
    },
  },
  profile: {
    fullName: 'ישראל ישראלי (משתמש הדגמה)',
    gender: 'MALE',
    birthDate: '1970-01-01', // תאריך עגול במכוון — לא תאריך לידה אמיתי
    maritalStatus: 'MARRIED',
    insuredMonthlySalary: 22000,
    children: [
      { birthDate: '2010-01-01', name: 'ילד/ה לדוגמה א׳' }, // מתחת לגיל 21 — יתום/ה זכאי/ת
      { birthDate: '2003-01-01', name: 'ילד/ה לדוגמה ב׳' }, // מעל גיל 21 — לא זכאי/ת
      { birthDate: '2015-01-01', name: 'ילד/ה לדוגמה ג׳' }, // מתחת לגיל 21 — יתום/ה זכאי/ת
    ],
  },
  products: [
    {
      id: 'demo-p1',
      name: 'קרן פנסיה מקיפה (דוגמה)',
      type: 'PENSION_COMPREHENSIVE',
      currentBalance: 650_000,
      monthlyDeposit: 2_400,
      feeFromDepositPct: 1.0,
      feeFromBalancePct: 0.19,
      monthlyCoverageCost: 180,
      conversionFactor: 200,
      survivorsPct: 100,
      disabilityPct: 75,
      joinDate: '2010-01-01',
      tracks: [
        { category: 'EQUITY', pct: 60 },
        { category: 'BONDS', pct: 40 },
      ],
      beneficiaries: [{ name: 'בן/בת הזוג (לדוגמה)', pct: 100 }],
    },
    {
      id: 'demo-p2',
      name: 'קרן פנסיה משלימה — ממעסיק קודם (דוגמה)',
      type: 'PENSION_GENERAL',
      currentBalance: 120_000,
      monthlyDeposit: 0,
      feeFromDepositPct: 0,
      feeFromBalancePct: 0.3,
      monthlyCoverageCost: 0,
      conversionFactor: 200,
      frozen: true,
      joinDate: '2005-03-01',
    },
    {
      id: 'demo-p3',
      name: 'ביטוח מנהלים (דוגמה)',
      type: 'MANAGERS_INSURANCE',
      currentBalance: 300_000,
      monthlyDeposit: 1_200,
      feeFromDepositPct: 2.5,
      feeFromBalancePct: 1.0,
      monthlyCoverageCost: 150,
      conversionFactor: 190,
      deathBenefitAmount: 800_000,
      joinDate: '2018-04-01',
      tracks: [
        { category: 'SP500', pct: 40 },
        { category: 'BONDS', pct: 30 },
        { category: 'MONEY_MARKET', pct: 30 },
      ],
      beneficiaries: [
        { name: 'בן/בת הזוג (לדוגמה)', pct: 70 },
        { name: 'הילדים (לדוגמה)', pct: 30 },
      ],
      transfers: [
        {
          fromProvider: 'גוף מנהל קודם (דוגמה)',
          fromType: 'ביטוח מנהלים',
          transferDate: '2018-04-01',
          note: 'איבוד מקדם המרה מובטח 200 ← 190 בעת הניוד',
        },
      ],
    },
    {
      id: 'demo-p4',
      name: 'קופת גמל (דוגמה)',
      type: 'PROVIDENT_FUND',
      currentBalance: 180_000,
      monthlyDeposit: 300,
      feeFromDepositPct: 0,
      feeFromBalancePct: 0.6,
      monthlyCoverageCost: 0,
      conversionFactor: 200,
      joinDate: '2012-01-01',
      tracks: [{ category: 'AGE_DEPENDENT', pct: 100 }],
      beneficiaries: [
        { name: 'בן/בת הזוג (לדוגמה)', pct: 60 },
        { name: 'הילדים (לדוגמה)', pct: 40 },
      ],
    },
    {
      id: 'demo-p5',
      name: 'קופת גמל להשקעה (דוגמה)',
      type: 'PROVIDENT_INVESTMENT',
      currentBalance: 95_000,
      monthlyDeposit: 800,
      feeFromDepositPct: 0,
      feeFromBalancePct: 0.7,
      monthlyCoverageCost: 0,
      joinDate: '2020-06-01',
      tracks: [
        { category: 'EQUITY', pct: 80 },
        { category: 'BONDS', pct: 20 },
      ],
      beneficiaries: [{ name: 'בן/בת הזוג (לדוגמה)', pct: 100 }],
    },
    {
      id: 'demo-p6',
      name: 'IRA בניהול אישי (דוגמה)',
      type: 'IRA',
      currentBalance: 60_000,
      monthlyDeposit: 350,
      feeFromDepositPct: 0,
      feeFromBalancePct: 0.3,
      monthlyCoverageCost: 0,
      joinDate: '2015-01-01',
    },
    {
      id: 'demo-p7',
      name: 'קרן השתלמות (דוגמה)',
      type: 'STUDY_FUND',
      currentBalance: 140_000,
      monthlyDeposit: 950,
      feeFromDepositPct: 0,
      feeFromBalancePct: 0.6,
      monthlyCoverageCost: 0,
      joinDate: '2016-01-01',
      tracks: [
        { category: 'EQUITY', pct: 50 },
        { category: 'BONDS', pct: 50 },
      ],
    },
    {
      id: 'demo-p8',
      name: 'ביטוח אכ"ע פרטי — מטריה ביטוחית (דוגמה)',
      type: 'DISABILITY_INSURANCE',
      currentBalance: 0,
      monthlyDeposit: 0,
      feeFromDepositPct: 0,
      feeFromBalancePct: 0,
      monthlyCoverageCost: 120,
      disabilityPct: 25,
      umbrella: true,
    },
    {
      id: 'demo-p9',
      name: 'ביטוח חיים פרטי — ריסק (דוגמה)',
      type: 'LIFE_INSURANCE',
      currentBalance: 0,
      monthlyDeposit: 0,
      feeFromDepositPct: 0,
      feeFromBalancePct: 0,
      monthlyCoverageCost: 85,
      deathBenefitAmount: 500_000,
    },
    {
      id: 'demo-p10',
      name: 'קרן כספית שקלית (דוגמה)',
      type: 'MONEY_MARKET_FUND',
      currentBalance: 40_000,
      monthlyDeposit: 0,
      feeFromDepositPct: 0,
      feeFromBalancePct: 0.15,
      monthlyCoverageCost: 0,
      beneficiaries: [{ name: 'בן/בת הזוג (לדוגמה)', pct: 100 }],
    },
  ],
};

export const DEMO_SPOUSE_PORTFOLIO: SavedPortfolio = {
  assumptions: {
    annualReturnPct: 4,
    annualSalaryGrowthPct: 2,
  },
  profile: {
    fullName: 'דנה ישראלי (בת זוג — הדגמה)',
    gender: 'FEMALE',
    birthDate: '1972-01-01', // תאריך עגול במכוון — לא תאריך לידה אמיתי
    maritalStatus: 'MARRIED',
    insuredMonthlySalary: 15_000,
  },
  products: [
    {
      id: 'demo-s1',
      name: 'קרן פנסיה מקיפה (דוגמה)',
      type: 'PENSION_COMPREHENSIVE',
      currentBalance: 280_000,
      monthlyDeposit: 1_100,
      feeFromDepositPct: 1.0,
      feeFromBalancePct: 0.2,
      monthlyCoverageCost: 90,
      conversionFactor: 200,
      survivorsPct: 100,
      disabilityPct: 75,
      joinDate: '2011-01-01',
      tracks: [
        { category: 'GENERAL', pct: 70 },
        { category: 'EQUITY', pct: 30 },
      ],
      beneficiaries: [{ name: 'בן/בת הזוג (לדוגמה)', pct: 100 }],
    },
    {
      id: 'demo-s2',
      name: 'קרן השתלמות (דוגמה)',
      type: 'STUDY_FUND',
      currentBalance: 60_000,
      monthlyDeposit: 600,
      feeFromDepositPct: 0,
      feeFromBalancePct: 0.6,
      monthlyCoverageCost: 0,
      joinDate: '2017-01-01',
    },
  ],
};
