import type { CalcTrace } from './types';

export type Gender = 'MALE' | 'FEMALE';

export interface RetirementInput {
  gender: Gender;
  /** תאריך לידה — ISO (yyyy-mm-dd) */
  birthDate: string;
  /** גיל פרישה מתוכנן (שנים) — עוקף את הגיל החוקי; טווח 60–75 */
  plannedRetirementAge?: number;
  /** נקודת ייחוס לחישוב (ברירת מחדל: היום) — ניתן לקיבוע בבדיקות */
  asOf?: string;
}

export interface RetirementResult {
  /** גיל הפרישה החוקי, בחודשים (למשל 67*12) */
  legalRetirementAgeMonths: number;
  /** תווית קריאה: "67" או "63 ו-9 חודשים" */
  legalRetirementAgeLabel: string;
  /** הגיל האפקטיבי לחישוב (חוקי או מתוכנן), בחודשים */
  effectiveRetirementAgeMonths: number;
  /** תאריך הפרישה הצפוי (ISO, ברזולוציית חודש) */
  retirementDate: string;
  /** חודשים שנותרו עד הפרישה (0 אם כבר בגיל פרישה) */
  monthsToRetirement: number;
  alreadyEligible: boolean;
  trace: CalcTrace;
}

const MALE_AGE_MONTHS = 67 * 12;

/**
 * גיל פרישה לנשים לפי תאריך לידה — תיקון לחוק גיל פרישה (2021).
 * טבלה מדורגת 62 → 65. לאימות מול פרסומי ביטוח לאומי;
 * בהמשך תעבור לטבלת RegulatoryParameter במסד (מפרט, נספח א').
 */
function femaleRetirementAgeMonths(birth: Date): number {
  const ym = birth.getUTCFullYear() * 12 + birth.getUTCMonth(); // חודש 0-מבוסס

  const until = (y: number, m1based: number) => y * 12 + (m1based - 1);

  if (ym <= until(1960, 4)) return 62 * 12; //        עד 4/1960
  if (ym <= until(1960, 12)) return 62 * 12 + 4; //   5/1960–12/1960
  if (ym <= until(1961, 12)) return 62 * 12 + 8; //   1961
  if (ym <= until(1962, 12)) return 63 * 12; //       1962
  if (ym <= until(1963, 12)) return 63 * 12 + 3; //   1963
  if (ym <= until(1964, 12)) return 63 * 12 + 6; //   1964
  if (ym <= until(1965, 12)) return 63 * 12 + 9; //   1965
  if (ym <= until(1966, 12)) return 64 * 12; //       1966
  if (ym <= until(1967, 12)) return 64 * 12 + 3; //   1967
  if (ym <= until(1968, 12)) return 64 * 12 + 6; //   1968
  if (ym <= until(1969, 12)) return 64 * 12 + 9; //   1969
  return 65 * 12; //                                  1970 ואילך
}

export function ageMonthsLabel(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y}` : `${y} ו-${m} חודשים`;
}

/**
 * חישוב גיל פרישה חוקי + חודשים עד פרישה.
 * רזולוציית חודש (יום בחודש לא נלקח בחשבון) — מספיק לתכנון.
 */
export function calcRetirement(input: RetirementInput): RetirementResult {
  const birth = new Date(input.birthDate);
  if (isNaN(birth.getTime())) {
    throw new Error('תאריך לידה לא תקין');
  }
  const asOf = input.asOf ? new Date(input.asOf) : new Date();
  if (birth > asOf) {
    throw new Error('תאריך הלידה בעתיד');
  }

  const legalMonths =
    input.gender === 'MALE' ? MALE_AGE_MONTHS : femaleRetirementAgeMonths(birth);

  let effectiveMonths = legalMonths;
  if (input.plannedRetirementAge !== undefined) {
    if (input.plannedRetirementAge < 60 || input.plannedRetirementAge > 75) {
      throw new Error('גיל פרישה מתוכנן חייב להיות בטווח 60–75');
    }
    effectiveMonths = Math.round(input.plannedRetirementAge * 12);
  }

  // חישוב ברזולוציית חודש
  const birthYM = birth.getUTCFullYear() * 12 + birth.getUTCMonth();
  const asOfYM = asOf.getUTCFullYear() * 12 + asOf.getUTCMonth();
  const retirementYM = birthYM + effectiveMonths;
  const monthsToRetirement = Math.max(0, retirementYM - asOfYM);

  const retirementDate = new Date(
    Date.UTC(Math.floor(retirementYM / 12), retirementYM % 12, 1),
  );

  return {
    legalRetirementAgeMonths: legalMonths,
    legalRetirementAgeLabel: ageMonthsLabel(legalMonths),
    effectiveRetirementAgeMonths: effectiveMonths,
    retirementDate: retirementDate.toISOString().slice(0, 10),
    monthsToRetirement,
    alreadyEligible: monthsToRetirement === 0,
    trace: {
      formula:
        'retirementDate = birthDate + retirementAge; monthsToRetirement = retirementDate - now (month resolution)',
      inputs: {
        gender: input.gender,
        birthDate: input.birthDate,
        plannedRetirementAge: input.plannedRetirementAge ?? 'לפי חוק',
        legalRetirementAge: ageMonthsLabel(legalMonths),
      },
      notes: [
        'גברים: גיל פרישה 67 (חוק גיל פרישה)',
        'נשים: לפי טבלת תיקון 2021 — מדורג 62 עד 65 לפי תאריך לידה',
        'החישוב ברזולוציית חודש; היום בחודש אינו נלקח בחשבון',
      ],
    },
  };
}
