import type { CalcTrace } from './types';

/**
 * בחירת מסלול קצבה בפרישה (מפרט 4.3 + 5.2) — השוואת כמה מסלולי קצבה
 * (כל אחד עם מקדם המרה, % קצבת שאיר וחודשי הבטחת תשלומים משלו, כפי
 * שמופיעים בטבלת המסלולים שהקרן שולחת לקראת הפרישה) ומציאת "נקודת איזון":
 * הגיל שבו הגמלאי צריך להיפטר כדי שמסלול נדיב יותר לשאירים "ישתלם"
 * בסך הכול (כולל קצבת השאיר) יותר ממסלול הבסיס (בד"כ המסלול הראשון —
 * הקצבה החודשית הגבוהה ביותר, בד"כ ללא/עם מעט הבטחת שאירים).
 *
 * כללי החישוב (בהנחות תוחלת חיים קבועות שהוזנו):
 * - כל עוד לא חלפו חודשי הבטחת התשלומים — במקרה מוות ממשיכים לשלם את
 *   מלוא הקצבה החודשית (לא מופחתת ב-% השאיר) עד תום תקופת ההבטחה.
 * - אחרי תום ההבטחה: אם יש בן/בת זוג ו-survivorPct > 0, משולמת קצבת שאיר
 *   (survivorPct% מהקצבה) עד תום תוחלת החיים של בן/בת הזוג.
 */

export interface AnnuityTrackOption {
  id: string;
  label: string;
  /** מקדם המרה של המסלול הזה — צבירה ÷ מקדם = קצבה חודשית */
  conversionFactor: number;
  /** % קצבת שאיר לבן/בת הזוג אחרי פטירת הגמלאי (0–100) */
  survivorPct: number;
  /** חודשי הבטחת תשלומים (למשל 0/60/120/180/240) */
  guaranteedMonths: number;
}

export interface AnnuityTrackInput {
  /** צבירה בפרישה (₪) — משותפת לכל המסלולים המושווים */
  balanceAtRetirement: number;
  /** לפחות שני מסלולים להשוואה; הראשון משמש כבסיס ההשוואה לנקודת האיזון */
  options: AnnuityTrackOption[];
  hasSpouse: boolean;
  /** גיל הגמלאי בפרישה */
  retirementAge: number;
  /** גיל שאליו מניחים שהגמלאי יגיע (לצורך אומדן סך תשלומים) */
  retireeLifeExpectancyAge: number;
  /** גיל בן/בת הזוג בעת הפרישה — נדרש אם hasSpouse */
  spouseAgeAtRetirement?: number;
  /** גיל שאליו מניחים שבן/בת הזוג יגיע/תגיע — נדרש אם hasSpouse */
  spouseLifeExpectancyAge?: number;
}

export interface AnnuityTrackOutcome {
  id: string;
  label: string;
  monthlyAnnuity: number;
  /** קצבת השאיר החודשית (0 אם אין בן/בת זוג או survivorPct=0) */
  survivorMonthly: number;
  survivorPct: number;
  guaranteedMonths: number;
  /** סך תשלומים משוער למשפחה עד תום תוחלות החיים שהוזנו (גמלאי + שאיר) */
  totalExpectedPayout: number;
  /**
   * גיל הגמלאי בפטירה שבו מסלול זה "משתלם" (סך תשלומים גבוה יותר) לעומת
   * מסלול הבסיס (options[0]). undefined עבור מסלול הבסיס עצמו;
   * null אם אינו משתלם באופק הנבדק (עד תוחלת החיים שהוזנה + 20 שנה).
   */
  breakEvenAge?: number | null;
}

export interface AnnuityTrackResult {
  options: AnnuityTrackOutcome[];
  warnings: string[];
  trace: CalcTrace;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** סך תשלומים למשפחה אם הגמלאי נפטר בחודש retireeDeathMonth (מהפרישה) */
function cumulativePayout(
  monthlyAnnuity: number,
  survivorPct: number,
  guaranteedMonths: number,
  retireeDeathMonth: number,
  hasSpouse: boolean,
  spouseDeathMonth: number | undefined,
): number {
  let total = monthlyAnnuity * retireeDeathMonth;
  if (retireeDeathMonth < guaranteedMonths) {
    // הבטחת תשלומים: מלוא הקצבה ממשיכה למוטבים עד תום תקופת ההבטחה
    total += monthlyAnnuity * (guaranteedMonths - retireeDeathMonth);
  }
  if (hasSpouse && survivorPct > 0 && spouseDeathMonth != null) {
    const survivorStart = Math.max(retireeDeathMonth, guaranteedMonths);
    const survivorMonths = Math.max(0, spouseDeathMonth - survivorStart);
    total += monthlyAnnuity * (survivorPct / 100) * survivorMonths;
  }
  return total;
}

export function calcAnnuityTrackComparison(input: AnnuityTrackInput): AnnuityTrackResult {
  if (!(input.balanceAtRetirement > 0)) throw new Error('צבירה בפרישה חייבת להיות חיובית');
  if (!input.options || input.options.length === 0) throw new Error('יש להזין לפחות מסלול אחד');
  for (const o of input.options) {
    if (!(o.conversionFactor > 0)) throw new Error(`"${o.label}": מקדם המרה חייב להיות חיובי`);
    if (o.survivorPct < 0 || o.survivorPct > 100)
      throw new Error(`"${o.label}": % קצבת שאיר חייב להיות בין 0 ל-100`);
    if (o.guaranteedMonths < 0) throw new Error(`"${o.label}": חודשי הבטחה לא יכולים להיות שליליים`);
  }
  if (!(input.retireeLifeExpectancyAge > input.retirementAge))
    throw new Error('גיל תוחלת החיים חייב להיות גדול מגיל הפרישה');
  if (input.hasSpouse && (input.spouseAgeAtRetirement == null || input.spouseLifeExpectancyAge == null)) {
    throw new Error('יש להזין גיל בן/בת הזוג ותוחלת חייו/ה כשיש בן/בת זוג');
  }
  if (
    input.hasSpouse &&
    input.spouseLifeExpectancyAge != null &&
    input.spouseAgeAtRetirement != null &&
    input.spouseLifeExpectancyAge <= input.spouseAgeAtRetirement
  ) {
    throw new Error('תוחלת חיי בן/בת הזוג חייבת להיות גדולה מגילו/ה בפרישה');
  }

  const retireeDeathMonth = Math.round(
    (input.retireeLifeExpectancyAge - input.retirementAge) * 12,
  );
  const spouseDeathMonth =
    input.hasSpouse && input.spouseAgeAtRetirement != null && input.spouseLifeExpectancyAge != null
      ? Math.round((input.spouseLifeExpectancyAge - input.spouseAgeAtRetirement) * 12)
      : undefined;

  // אופק חיפוש נקודת האיזון: עד 20 שנה מעבר לתוחלת החיים הארוכה מבין השתיים
  const horizonMonths =
    Math.max(retireeDeathMonth, spouseDeathMonth ?? 0, ...input.options.map((o) => o.guaranteedMonths)) +
    20 * 12;

  const outcomes: AnnuityTrackOutcome[] = input.options.map((o, i) => {
    const monthlyAnnuity = round2(input.balanceAtRetirement / o.conversionFactor);
    const survivorMonthly = round2((monthlyAnnuity * o.survivorPct) / 100);
    const totalExpectedPayout = round2(
      cumulativePayout(
        monthlyAnnuity,
        o.survivorPct,
        o.guaranteedMonths,
        retireeDeathMonth,
        input.hasSpouse,
        spouseDeathMonth,
      ),
    );

    let breakEvenAge: number | null | undefined;
    if (i === 0) {
      breakEvenAge = undefined;
    } else {
      const baseline = input.options[0];
      const baselineMonthly = round2(input.balanceAtRetirement / baseline.conversionFactor);
      breakEvenAge = null;
      for (let m = 0; m <= horizonMonths; m++) {
        const optionTotal = cumulativePayout(
          monthlyAnnuity,
          o.survivorPct,
          o.guaranteedMonths,
          m,
          input.hasSpouse,
          spouseDeathMonth != null ? Math.max(spouseDeathMonth, m) : undefined,
        );
        const baselineTotal = cumulativePayout(
          baselineMonthly,
          baseline.survivorPct,
          baseline.guaranteedMonths,
          m,
          input.hasSpouse,
          spouseDeathMonth != null ? Math.max(spouseDeathMonth, m) : undefined,
        );
        if (optionTotal >= baselineTotal) {
          breakEvenAge = round2(input.retirementAge + m / 12);
          break;
        }
      }
    }

    return {
      id: o.id,
      label: o.label,
      monthlyAnnuity,
      survivorMonthly,
      survivorPct: o.survivorPct,
      guaranteedMonths: o.guaranteedMonths,
      totalExpectedPayout,
      breakEvenAge,
    };
  });

  const warnings: string[] = [];
  if (!input.hasSpouse && input.options.some((o) => o.survivorPct > 0)) {
    warnings.push('אין בן/בת זוג בתיק — % קצבת שאיר במסלולים לא ישולם בפועל, שווה לבחון מסלול ללא שאירים');
  }
  const maxMonthly = Math.max(...outcomes.map((o) => o.monthlyAnnuity));
  const minMonthly = Math.min(...outcomes.map((o) => o.monthlyAnnuity));
  if (maxMonthly > 0 && (maxMonthly - minMonthly) / maxMonthly > 0.3) {
    warnings.push(
      `פער של ${Math.round(((maxMonthly - minMonthly) / maxMonthly) * 100)}% בין הקצבה החודשית הגבוהה לנמוכה בין המסלולים — ודא שההשוואה כוללת את אותה צבירה ואת אותם מקדמים מהקרן`,
    );
  }
  warnings.push(
    'החישוב מבוסס על תוחלות חיים משוערות שהוזנו (הנחה, לא תחזית) — נקודת האיזון תשתנה עם כל שינוי בהנחות',
  );

  return {
    options: outcomes,
    warnings,
    trace: {
      formula:
        'monthlyAnnuity = balance / conversionFactor ; payout(deathMonth) = monthlyAnnuity × min(deathMonth, guaranteedMonths) + monthlyAnnuity × max(0, guaranteedMonths − deathMonth) + survivorPct% × monthlyAnnuity × survivorMonthsAfterGuarantee',
      inputs: {
        balanceAtRetirement: input.balanceAtRetirement,
        retirementAge: input.retirementAge,
        retireeLifeExpectancyAge: input.retireeLifeExpectancyAge,
        hasSpouse: String(input.hasSpouse),
        spouseAgeAtRetirement: input.spouseAgeAtRetirement ?? 'n/a',
        spouseLifeExpectancyAge: input.spouseLifeExpectancyAge ?? 'n/a',
        optionsCount: input.options.length,
      },
      notes: [
        'המסלול הראשון ברשימה משמש כבסיס להשוואת נקודת האיזון',
        'בתוך תקופת הבטחת התשלומים משולמת מלוא הקצבה למוטבים ללא קשר ל-% קצבת השאיר',
        'אינו כולל את מסלול "קצבה מוכרת" (תיקון 190) — טרם ממודל במערכת',
      ],
    },
  };
}
