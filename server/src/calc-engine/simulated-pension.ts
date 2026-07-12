import type { CalcTrace } from './types';

/**
 * פרישה מדומה ("פנסיה מדומה") — הפעלת קצבה מגיל 60 תוך המשך עבודה.
 *
 * ההשוואה: הפעלה מוקדמת בגיל ההתחלה (קצבה קטנה יותר, מקדם גבוה יותר,
 * חייבת במס שולי כיגיעה אישית אך פטורה מדמי ביטוח לאומי) מול המתנה
 * לגיל הפרישה החוקי (צבירה גדולה יותר ומקדם טוב יותר).
 * הפלט המרכזי: ההכנסה נטו בחלון הביניים, ההפסד החודשי לכל החיים
 * אחרי הגיל החוקי, וגיל נקודת האיזון.
 *
 * פישוטים מוצהרים (MVP): צבירה בקירוב ללא דמי ניהול; המס על הקצבה
 * אחרי הפרישה אינו ממודל (קיבוע זכויות בנפרד); ערכים ריאליים.
 */

export interface SimulatedPensionInput {
  /** גיל נוכחי (שנים, אפשר שבר) */
  currentAge: number;
  /** גיל הפעלת הקצבה המדומה (מינימום 60) */
  startAge: number;
  /** גיל הפרישה החוקי (לרוב 67) */
  legalRetirementAge: number;
  /** הצבירה היום במוצר/ים שיופעלו מוקדם (₪) */
  balanceNow: number;
  /** הפקדה חודשית שנמשכת עד גיל ההפעלה (נפסקת עם ההפעלה) */
  monthlyDeposit: number;
  /** תשואה ריאלית שנתית (%) */
  annualReturnPct: number;
  /** מקדם המרה בגיל ההפעלה (גבוה יותר = קצבה קטנה יותר) */
  conversionFactorAtStart: number;
  /** מקדם המרה בגיל הפרישה החוקי */
  conversionFactorAtLegal: number;
  /** מס שולי בזמן העבודה (%) — הקצבה המוקדמת מתווספת לשכר */
  marginalTaxRatePct: number;
}

export interface SimulatedPensionResult {
  /** צבירה צפויה בגיל ההפעלה */
  balanceAtStart: number;
  /** צבירה צפויה בגיל החוקי אם לא מפעילים (ההפקדות נמשכות) */
  balanceAtLegal: number;
  /** הקצבה המוקדמת ברוטו (₪ לחודש, מגיל ההפעלה, לכל החיים) */
  earlyMonthlyGross: number;
  /** הקצבה המוקדמת נטו בתקופת העבודה (אחרי מס שולי) */
  earlyMonthlyNetWhileWorking: number;
  /** הקצבה אם ממתינים לגיל החוקי (₪ לחודש) */
  waitMonthlyGross: number;
  /** חודשי חלון הביניים (הפעלה → גיל חוקי) */
  windowMonths: number;
  /** סך נטו שיתקבל בחלון הביניים */
  totalNetDuringWindow: number;
  /** ההפסד החודשי ברוטו לכל החיים אחרי הגיל החוקי */
  monthlyLossAfterLegal: number;
  /** גיל נקודת האיזון (ברוטו): מעבר לו — ההמתנה משתלמת יותר */
  breakEvenAge: number | null;
  warnings: string[];
  trace: CalcTrace;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** צבירה עתידית בקירוב חודשי (ללא דמי ניהול) */
function futureValue(
  balance: number,
  monthlyDeposit: number,
  annualReturnPct: number,
  months: number,
): number {
  const r = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  let b = balance;
  for (let m = 0; m < months; m++) {
    b = b * (1 + r) + monthlyDeposit;
  }
  return b;
}

export function calcSimulatedPension(
  input: SimulatedPensionInput,
): SimulatedPensionResult {
  if (input.startAge < 60) {
    throw new Error('פרישה מדומה אפשרית רק מגיל 60 (תנאי הדין)');
  }
  if (input.startAge < input.currentAge) {
    throw new Error('גיל ההפעלה קטן מהגיל הנוכחי');
  }
  if (input.legalRetirementAge <= input.startAge) {
    throw new Error('גיל ההפעלה חייב להיות לפני גיל הפרישה החוקי');
  }
  if (input.conversionFactorAtStart <= 0 || input.conversionFactorAtLegal <= 0) {
    throw new Error('מקדמי המרה חייבים להיות חיוביים');
  }
  if (!(input.balanceNow >= 0) || !(input.monthlyDeposit >= 0)) {
    throw new Error('צבירה והפקדות חייבות להיות אי-שליליות');
  }

  const monthsToStart = Math.round((input.startAge - input.currentAge) * 12);
  const windowMonths = Math.round(
    (input.legalRetirementAge - input.startAge) * 12,
  );

  const balanceAtStart = round2(
    futureValue(input.balanceNow, input.monthlyDeposit, input.annualReturnPct, monthsToStart),
  );
  // אם ממתינים: הצבירה ממשיכה לצמוח וההפקדות נמשכות עד הגיל החוקי
  const balanceAtLegal = round2(
    futureValue(balanceAtStart, input.monthlyDeposit, input.annualReturnPct, windowMonths),
  );

  const earlyMonthlyGross = round2(balanceAtStart / input.conversionFactorAtStart);
  const waitMonthlyGross = round2(balanceAtLegal / input.conversionFactorAtLegal);
  const marginal = input.marginalTaxRatePct / 100;
  const earlyMonthlyNetWhileWorking = round2(earlyMonthlyGross * (1 - marginal));
  const totalNetDuringWindow = round2(earlyMonthlyNetWhileWorking * windowMonths);
  const monthlyLossAfterLegal = round2(
    Math.max(0, waitMonthlyGross - earlyMonthlyGross),
  );

  // נקודת איזון (ברוטו): כמה חודשים אחרי הגיל החוקי עד שההפסד המצטבר
  // משתווה למה שהתקבל נטו בחלון הביניים
  let breakEvenAge: number | null = null;
  if (monthlyLossAfterLegal > 0) {
    const monthsToBreakEven = totalNetDuringWindow / monthlyLossAfterLegal;
    breakEvenAge = Math.round((input.legalRetirementAge + monthsToBreakEven / 12) * 10) / 10;
  }

  const warnings: string[] = [
    'הקצבה המוקדמת מתווספת לשכר וחייבת במס שולי מלא עד הפרישה — אך פטורה מדמי ביטוח לאומי ומס בריאות (יתרון שאינו מכומת כאן)',
    'הקצבה הפנסיונית אינה נספרת במבחן ההכנסות לקצבת אזרח ותיק — יתרון נוסף בגילאי 67–70',
    'הפעלת קצבה היא בלתי הפיכה: המקדם ננעל והכיסויים הביטוחיים (שאירים/נכות) במוצר שהופעל מתבטלים',
    'מגיל הזכאות ניתן לבצע קיבוע זכויות (161ד) ולקבל פטור על חלק מהקצבה גם תוך המשך עבודה — ראה סימולטור קיבוע הזכויות; לפני כן הקצבה חייבת במלואה',
    'ערכי הצבירה בקירוב ללא דמי ניהול; מקדמי ההמרה לפי הזנת המשתמש — יש לאמת מול המסלקה/הקרן',
    'החלטה מהותית — מומלץ תכנון שנה מראש לפחות עם מתכנן פרישה/יועץ מס',
  ];
  if (breakEvenAge !== null) {
    warnings.push(
      `נקודת האיזון (ברוטו) בגיל ${breakEvenAge} — אם תחיה מעבר לגיל זה, ההמתנה לגיל החוקי משתלמת יותר במצטבר`,
    );
  }

  return {
    balanceAtStart,
    balanceAtLegal,
    earlyMonthlyGross,
    earlyMonthlyNetWhileWorking,
    waitMonthlyGross,
    windowMonths,
    totalNetDuringWindow,
    monthlyLossAfterLegal,
    breakEvenAge,
    warnings,
    trace: {
      formula:
        'early = FV(balance, start) ÷ factorStart ; wait = FV(balance, legal) ÷ factorLegal ; breakEven = legalAge + (netWindowTotal ÷ (wait − early)) ÷ 12',
      inputs: {
        currentAge: input.currentAge,
        startAge: input.startAge,
        legalRetirementAge: input.legalRetirementAge,
        balanceNow: input.balanceNow,
        annualReturnPct: input.annualReturnPct,
        conversionFactorAtStart: input.conversionFactorAtStart,
        conversionFactorAtLegal: input.conversionFactorAtLegal,
        marginalTaxRatePct: input.marginalTaxRatePct,
      },
      notes: [
        'פרישה מדומה: הפעלת קצבה מגיל 60 תוך המשך עבודה',
        'ההשוואה בערכים ריאליים; המס אחרי הפרישה אינו ממודל (ראה קיבוע זכויות)',
        'הפטור מדמי ביטוח לאומי על הקצבה המוקדמת — יתרון נוסף שאינו מכומת',
      ],
    },
  };
}
