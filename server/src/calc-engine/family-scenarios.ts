import type { CalcTrace } from './types';
import { calcScenarios } from './scenarios';
import type { ScenariosInput, ScenariosResult } from './scenarios';

/**
 * מסך משפחה — מבט זוגי, תרחישי שארים הדדיים (מפרט §9, פריט 5).
 *
 * לכל בן/בת זוג יש תיק מוצרים משלו/ה. תרחיש "מה אם" של כל אחד/ת כבר מחושב
 * ע"י calcScenarios (הצבירה/הביטוח של אותו תיק במקרה מוות). המודול הזה
 * מרכיב מהתוצאות האלה תמונת מצב **הדדית** למשפחה: אם בן/בת הזוג האחד/ת
 * נפטר/ת, מה מקבל/ת הנותר/ת בחיים בפועל — הכנסתו/ה השוטפת הממשיכה
 * (שכר) + קצבת השאירים והסכום החד-פעמי מתיק הנפטר/ת (כולל ביטוח לאומי).
 */

export interface FamilyMemberInput {
  /** שם/כינוי להצגה — "עיקרי/ת" או "בן/בת הזוג" */
  label: string;
  /** שכר מבוטח נוכחי — ההכנסה שממשיכה אם בן/בת הזוג האחר/ת נפטר/ת */
  insuredMonthlySalary: number;
  /** קלט תרחישי המוות/נכות של התיק האישי (family.hasSpouse צריך להיות true) */
  scenarios: ScenariosInput;
}

export interface FamilyScenariosInput {
  primary: FamilyMemberInput;
  spouse: FamilyMemberInput;
  /** יעד הכנסה משפחתי כאחוז מהכנסת הבסיס (ברירת מחדל 70%) */
  incomeTargetPct?: number;
}

export interface FamilyMemberOutcome {
  /** שם/כינוי הנותר/ת בחיים */
  survivorLabel: string;
  /** הכנסתו/ה השוטפת הממשיכה של הנותר/ת בחיים (שכר) */
  ownContinuingIncome: number;
  /** קצבת שאירים חודשית מתיק הנפטר/ת (קרנות + ביטוח מנהלים וכד') */
  productsSurvivorMonthly: number;
  /** קצבת שאירים חודשית מביטוח לאומי */
  niSurvivorsMonthly: number;
  /** סכום חד-פעמי מתיק הנפטר/ת (ביטוח חיים, קופות ללא שארים וכד') */
  lumpSum: number;
  /** סה"כ הכנסה חודשית של המשפחה אחרי האובדן (הכנסה ממשיכה + קצבאות שארים) */
  totalHouseholdMonthly: number;
  /** פער מול היעד המשפחתי */
  gapMonthly: number;
  /** תוצאת תרחישי המוות/נכות המלאה של תיק הנפטר/ת — ל-drill-down */
  deceasedScenario: ScenariosResult;
}

export interface FamilyScenariosResult {
  /** הכנסת הבסיס המשפחתית — שני השכרים יחד, שני בני הזוג בחיים */
  baselineHouseholdMonthly: number;
  targetMonthly: number;
  /** מה קורה אם primary נפטר/ת — התוצאה מתארת את מצב/ה של spouse */
  ifPrimaryDies: FamilyMemberOutcome;
  /** מה קורה אם spouse נפטר/ת — התוצאה מתארת את מצב/ה של primary */
  ifSpouseDies: FamilyMemberOutcome;
  warnings: string[];
  trace: CalcTrace;
}

export function calcFamilyScenarios(input: FamilyScenariosInput): FamilyScenariosResult {
  const targetPct = input.incomeTargetPct ?? 70;
  const baselineHouseholdMonthly = round2(
    input.primary.insuredMonthlySalary + input.spouse.insuredMonthlySalary,
  );
  const targetMonthly = round2((baselineHouseholdMonthly * targetPct) / 100);

  const primaryScenario = calcScenarios(input.primary.scenarios);
  const spouseScenario = calcScenarios(input.spouse.scenarios);

  const ifPrimaryDies = buildOutcome(
    input.spouse.label,
    input.spouse.insuredMonthlySalary,
    primaryScenario,
    targetMonthly,
  );
  const ifSpouseDies = buildOutcome(
    input.primary.label,
    input.primary.insuredMonthlySalary,
    spouseScenario,
    targetMonthly,
  );

  const warnings = [
    ...primaryScenario.warnings.map((w) => `${input.primary.label}: ${w}`),
    ...spouseScenario.warnings.map((w) => `${input.spouse.label}: ${w}`),
  ];
  warnings.push(
    'ההכנסה הממשיכה של הנותר/ת בחיים מניחה המשך עבודה בשכר הנוכחי — אינה כוללת שינויי קריירה או פרישה עתידית',
  );

  return {
    baselineHouseholdMonthly,
    targetMonthly,
    ifPrimaryDies,
    ifSpouseDies,
    warnings,
    trace: {
      formula:
        'householdAfterDeath = survivorOwnSalary + deceasedProductsSurvivorMonthly + deceasedNiSurvivorsMonthly',
      inputs: {
        primaryLabel: input.primary.label,
        primarySalary: input.primary.insuredMonthlySalary,
        spouseLabel: input.spouse.label,
        spouseSalary: input.spouse.insuredMonthlySalary,
        incomeTargetPct: targetPct,
      },
      notes: [
        'כל בן/בת זוג מחזיק/ה תיק מוצרים נפרד — תרחיש המוות של כל תיק מחושב בנפרד ע"י מנוע התרחישים הרגיל',
        'התמונה ההדדית: הנותר/ת בחיים ממשיך/ה בשכרו/ה + מקבל/ת את קצבאות/הסכומים משאירי תיק הנפטר/ת',
        'יעד ההכנסה המשפחתי הוא ' + targetPct + '% מסך שני השכרים לפני האובדן',
      ],
    },
  };
}

function buildOutcome(
  survivorLabel: string,
  survivorOwnSalary: number,
  deceasedScenario: ScenariosResult,
  targetMonthly: number,
): FamilyMemberOutcome {
  const productsSurvivorMonthly = deceasedScenario.death.totalSurvivorMonthly;
  const niSurvivorsMonthly = deceasedScenario.death.niSurvivorsMonthly;
  const lumpSum = deceasedScenario.death.totalLumpSum;
  const totalHouseholdMonthly = round2(
    survivorOwnSalary + productsSurvivorMonthly + niSurvivorsMonthly,
  );
  return {
    survivorLabel,
    ownContinuingIncome: round2(survivorOwnSalary),
    productsSurvivorMonthly,
    niSurvivorsMonthly,
    lumpSum,
    totalHouseholdMonthly,
    gapMonthly: round2(Math.max(0, targetMonthly - totalHouseholdMonthly)),
    deceasedScenario,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
