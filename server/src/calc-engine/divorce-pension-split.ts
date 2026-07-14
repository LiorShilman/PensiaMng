import type { CalcTrace } from './types';

/**
 * חלוקת זכויות פנסיה בגירושין (חוק לחלוקת חיסכון פנסיוני בין בני זוג
 * שנפרדו, תשע"ד-2014) — נוסחת "יחס הזמנים" (coverture fraction): החלק
 * היחסי של תקופת הנישואין (מנישואין/הצטרפות לקרן, המאוחר מביניהם, ועד
 * מועד הקרע) מתוך כלל תקופת הצבירה בקרן (מהצטרפות ועד הפרישה), מוכפל
 * באחוז שהוסכם/נפסק (עד 50% לרוב), ומיושם על היתרה נכון ל"מועד הקרע" —
 * לא היתרה הנוכחית.
 *
 * מוגבל לפנסיה צוברת (יתרה כספית מוגדרת) — פנסיה תקציבית (זכות עתידית
 * בלבד) דורשת היוון אקטוארי שונה לגמרי ואינה נתמכת כאן.
 *
 * היתרה למועד הקרע מוזנת ידנית (מאישור רשמי מהגוף המנהל) — המערכת אינה
 * משחזרת יתרות עבר, רק מקדימה קדימה (ר' projection.ts).
 */

export interface DivorceSplitProductInput {
  id: string;
  name: string;
  /** תאריך הצטרפות לקרן/תחילת צבירה (ISO yyyy-mm-dd) */
  joinDate: string;
  /** יתרה נכון למועד הקרע (₪) — מאישור רשמי, לא מחושבת */
  balanceAtBreakDate: number;
}

export interface DivorcePensionSplitInput {
  marriageDate: string;
  /** מועד הקרע — סיום השיתוף הכלכלי */
  breakDate: string;
  /** תאריך פרישה בפועל/מתוכנן — גבול תקופת הצבירה הכוללת */
  retirementDate: string;
  /** אחוז מהחלק היחסי שהוסכם/נפסק לבן/בת הזוג הלא-עמית (ברירת מחדל 50) */
  awardedPct: number;
  products: DivorceSplitProductInput[];
}

export interface DivorceSplitProductResult {
  id: string;
  name: string;
  maritalFractionPct: number;
  spouseShare: number;
  remainingForMember: number;
}

export interface DivorcePensionSplitResult {
  products: DivorceSplitProductResult[];
  totalBalanceAtBreakDate: number;
  totalSpouseShare: number;
  warnings: string[];
  trace: CalcTrace;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** אינדקס חודשים אבסולוטי (שנה*12+חודש), לחישובי הפרש בין תאריכים */
function monthIndex(iso: string): number {
  const d = new Date(iso);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

export function calcDivorcePensionSplit(
  input: DivorcePensionSplitInput,
): DivorcePensionSplitResult {
  if (input.products.length === 0) throw new Error('יש להזין לפחות מוצר אחד');
  if (input.awardedPct < 0) throw new Error('awardedPct לא יכול להיות שלילי');

  const marriageIdx = monthIndex(input.marriageDate);
  const breakIdx = monthIndex(input.breakDate);
  const retireIdx = monthIndex(input.retirementDate);

  const warnings: string[] = [];
  if (breakIdx < marriageIdx) {
    warnings.push('מועד הקרע מוזן לפני תאריך הנישואין — יש לבדוק את התאריכים');
  }
  if (retireIdx < breakIdx) {
    warnings.push('תאריך הפרישה מוזן לפני מועד הקרע — יש לבדוק את התאריכים');
  }
  if (input.awardedPct > 50) {
    warnings.push(
      'האחוז שהוזן מעל 50% מהחלק היחסי — זו מעל התקרה המקובלת בפסיקה, ונדרש הסכם או פסק דין ספציפי המצדיק זאת',
    );
  }
  warnings.push(
    'המחשבון מתאים לפנסיה צוברת (יתרה כספית) בלבד — פנסיה תקציבית דורשת היוון אקטוארי שונה ואינה נתמכת כאן',
  );
  warnings.push(
    'אינו מהווה ייעוץ משפטי או אקטוארי — החלוקה בפועל נקבעת בהסכם גירושין או בפסק דין; יש להתייעץ עם עורך/ת דין המתמחה בדיני משפחה',
  );

  const products: DivorceSplitProductResult[] = input.products.map((p) => {
    const joinIdx = monthIndex(p.joinDate);
    const overlapStartIdx = Math.max(joinIdx, marriageIdx);
    const maritalMonths = Math.max(0, breakIdx - overlapStartIdx);
    const totalAccrualMonths = Math.max(1, retireIdx - joinIdx);
    const maritalFractionPct = round2(
      Math.min(100, (maritalMonths / totalAccrualMonths) * 100),
    );
    const spouseShare = round2(
      p.balanceAtBreakDate * (maritalFractionPct / 100) * (input.awardedPct / 100),
    );
    return {
      id: p.id,
      name: p.name,
      maritalFractionPct,
      spouseShare,
      remainingForMember: round2(p.balanceAtBreakDate - spouseShare),
    };
  });

  return {
    products,
    totalBalanceAtBreakDate: round2(
      input.products.reduce((s, p) => s + p.balanceAtBreakDate, 0),
    ),
    totalSpouseShare: round2(products.reduce((s, p) => s + p.spouseShare, 0)),
    warnings,
    trace: {
      formula:
        'יחס_זמנים = (מועד_הקרע − max(נישואין, הצטרפות_לקרן)) ÷ (פרישה − הצטרפות_לקרן) ; חלק_בן/בת_הזוג = יתרה_למועד_הקרע × יחס_זמנים × אחוז_שהוסכם',
      inputs: {
        marriageDate: input.marriageDate,
        breakDate: input.breakDate,
        retirementDate: input.retirementDate,
        awardedPct: input.awardedPct,
        productsCount: input.products.length,
      },
      notes: [
        'היתרה למועד הקרע מוזנת ידנית מאישור רשמי של הגוף המנהל — אינה מחושבת אחורה מהיתרה הנוכחית',
        'רק זכויות שנצברו החל מהמאוחר מבין תאריך הנישואין ותאריך ההצטרפות לקרן, ועד מועד הקרע, נכללות בחלק היחסי',
      ],
    },
  };
}
