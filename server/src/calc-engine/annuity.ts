import { AnnuityInput, AnnuityResult } from './types';

/**
 * חישוב קצבה חודשית — הנוסחה מהמפרט (4.3):
 *
 *   קצבה_חודשית = צבירה_בפרישה / מקדם_המרה
 *
 * מקדם ההמרה מגיע מטבלאות התקנון (תלוי שנת לידה, גיל פרישה, מסלול קצבה)
 * — בשלב זה נמסר כקלט; בהמשך יישלף מטבלת פרמטרים.
 */
export function annuityFromBalance(input: AnnuityInput): AnnuityResult {
  if (input.conversionFactor <= 0) {
    throw new Error('conversionFactor חייב להיות חיובי');
  }
  if (input.balanceAtRetirement < 0) {
    throw new Error('balanceAtRetirement לא יכול להיות שלילי');
  }

  const monthlyAnnuity =
    Math.round((input.balanceAtRetirement / input.conversionFactor) * 100) / 100;

  return {
    monthlyAnnuity,
    trace: {
      formula: 'monthlyAnnuity = balanceAtRetirement / conversionFactor',
      inputs: {
        balanceAtRetirement: input.balanceAtRetirement,
        conversionFactor: input.conversionFactor,
      },
      notes: [
        'מקדם ההמרה תלוי שנת לידה, גיל פרישה ומסלול קצבה (הבטחת תשלומים / % שאירים)',
      ],
    },
  };
}
