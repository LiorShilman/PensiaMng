import type { CalcTrace } from './types';
import { annualToMonthlyRate } from './projection';

/**
 * תיקון 190 (מפרט 6.2) — כספי גמל שהופקדו במסלול תיקון 190 (בד"כ אחרי גיל
 * 60) ניתנים למשיכה בשתי דרכים:
 * 1. משיכה הונית — מס רווח הון מופחת של 15% נומינלי (לא 25% הרגיל),
 *    רק על החלק שהוא רווח ריאלי (לא על הקרן/ההפקדות עצמן).
 * 2. "קצבה מוכרת" — קצבה חודשית מהכספים האלה, פטורה ממס לחלוטין (ללא
 *    התלות במדרגות הפטור על קצבה מזכה של סעיף 9א).
 *
 * זהו מודל מפושט לצורך השוואה — אינו בודק תנאי זכאות מדויקים (למשל
 * שיוך מלא של הכספים למסלול תיקון 190 בפועל).
 */

export interface Section190Input {
  /** צבירה במסלול תיקון 190 (₪) */
  balance: number;
  /** אחוז מהצבירה שהוא רווח ריאלי (השאר קרן/הפקדות, לא חייב במס במשיכה הונית) */
  realGainPct: number;
  /** מקדם המרה לקצבה מוכרת */
  conversionFactor: number;
  currentAge: number;
  /** גיל תוחלת חיים משוער — לצורך השוואת סך הערך משני המסלולים */
  lifeExpectancyAge: number;
  /** תשואה ריאלית שנתית להשקעת היתרה נטו אם נמשך הונית */
  annualReturnPct: number;
}

export interface Section190Result {
  lumpSum: {
    grossAmount: number;
    taxableGain: number;
    tax: number;
    netAmount: number;
    projectedValueAtLifeExpectancy: number;
  };
  recognizedPension: {
    monthlyAmount: number;
    totalMonths: number;
    totalIncomeToLifeExpectancy: number;
  };
  warnings: string[];
  trace: CalcTrace;
}

const TAX_RATE = 0.15;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcSection190(input: Section190Input): Section190Result {
  if (!(input.balance > 0)) throw new Error('הצבירה חייבת להיות חיובית');
  if (input.realGainPct < 0 || input.realGainPct > 100) {
    throw new Error('אחוז הרווח הריאלי חייב להיות בין 0 ל-100');
  }
  if (!(input.conversionFactor > 0)) throw new Error('מקדם המרה חייב להיות חיובי');
  if (!(input.lifeExpectancyAge > input.currentAge)) {
    throw new Error('גיל תוחלת החיים חייב להיות גדול מהגיל הנוכחי');
  }

  const monthsToLifeExpectancy = Math.round(
    (input.lifeExpectancyAge - input.currentAge) * 12,
  );

  const taxableGain = round2(input.balance * (input.realGainPct / 100));
  const tax = round2(taxableGain * TAX_RATE);
  const netAmount = round2(input.balance - tax);
  const monthlyRate = annualToMonthlyRate(input.annualReturnPct);
  const projectedValueAtLifeExpectancy = round2(
    netAmount * Math.pow(1 + monthlyRate, monthsToLifeExpectancy),
  );

  const monthlyAmount = round2(input.balance / input.conversionFactor);
  const totalIncomeToLifeExpectancy = round2(monthlyAmount * monthsToLifeExpectancy);

  const warnings: string[] = [
    'השוואה מפושטת: המסלול ההוני נותן סכום חד-פעמי (ערך עתידי אם מושקע), הקצבה המוכרת נותנת הכנסה חודשית מובטחת לכל החיים — אלו לא באמת תחליפים זהים, גם אם הסכום הכולל דומה',
  ];
  if (input.currentAge < 60) {
    warnings.push(
      'תיקון 190 מיועד בעיקרו למי שמעל גיל 60 — ודא זכאות בפועל מול הגוף המנהל לפני שמסתמכים על ההשוואה',
    );
  }

  return {
    lumpSum: { grossAmount: input.balance, taxableGain, tax, netAmount, projectedValueAtLifeExpectancy },
    recognizedPension: { monthlyAmount, totalMonths: monthsToLifeExpectancy, totalIncomeToLifeExpectancy },
    warnings,
    trace: {
      formula:
        'lumpSum: tax = balance × realGainPct% × 15% ; netAmount grown at annualReturnPct to life expectancy. recognizedPension: monthly = balance / conversionFactor (פטור ממס), total = monthly × months',
      inputs: {
        balance: input.balance,
        realGainPct: input.realGainPct,
        conversionFactor: input.conversionFactor,
        currentAge: input.currentAge,
        lifeExpectancyAge: input.lifeExpectancyAge,
        annualReturnPct: input.annualReturnPct,
        monthsToLifeExpectancy,
      },
      notes: [
        'מודל מפושט — אינו בודק תנאי זכאות מלאים לתיקון 190',
        'קצבה מוכרת: פטורה ממס לחלוטין, לא כפופה למדרגות הפטור על קצבה מזכה (סעיף 9א)',
        'משיכה הונית: 15% נומינלי על הרווח הריאלי בלבד, לא על מלוא הצבירה',
      ],
    },
  };
}
