import type { CalcTrace } from './types';

/**
 * קצבאות ביטוח לאומי — הרגל השלישית של התכנון הפנסיוני.
 *
 * שלוש קצבאות ממודלות: אזרח ותיק (פרישה), שאירים (מוות), נכות כללית (אכ"ע).
 * הערכים נכונים ל-2025 ומנוהלים כפרמטרים (RegulatoryParameter + ברירות
 * מחדל מתועדות כאן) — לאימות מול פרסומי ביטוח לאומי לפני עלייה לאוויר.
 *
 * פישוטים מוצהרים (MVP):
 * - מבחן הכנסות בין גיל פרישה לגיל הזכאות המוחלט (70) אינו ממודל.
 * - דחיית קצבה (5% לשנה) אינה ממודלת.
 * - השלמת הכנסה ותוספות מיוחדות אינן ממודלות.
 * - נכות: מניחים דרגת אי-כושר מלאה (100%), קצבת יחיד ללא תוספות תלויים.
 */

// ---------- פרמטרים (2025, ₪ לחודש — לאימות) ----------

export const NI_PARAMS_2025 = {
  /** קצבת אזרח ותיק בסיסית ליחיד (עד גיל 80) */
  oldAgeIndividual: 1_795,
  /** תוספת בן/בת זוג (כשאינו/ה מקבל/ת קצבה בעצמו/ה) */
  oldAgeSpouseSupplement: 902,
  /** תוספת ותק: % לשנת ביטוח */
  seniorityPctPerYear: 2,
  /** תקרת תוספת הוותק (%) */
  seniorityMaxPct: 50,
  /** קצבת שאירים לאלמן/ה בגיל 50+ */
  survivorsWidow50Plus: 1_795,
  /** קצבת שאירים לאלמן/ה בגיל 40–49 */
  survivorsWidow40to49: 1_349,
  /** תוספת לכל יתום */
  survivorsOrphanSupplement: 902,
  /** גיל תום זכאות יתום בביטוח לאומי (שונה מ-21 בקרן פנסיה!) */
  orphanAgeLimit: 18,
  /** קצבת נכות כללית מלאה ליחיד (דרגת אי-כושר 100%) */
  disabilityFullIndividual: 4_291,
} as const;

export type NiParams = { -readonly [K in keyof typeof NI_PARAMS_2025]: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

const withDefaults = (override?: Partial<NiParams>): NiParams => ({
  ...NI_PARAMS_2025,
  ...override,
});

// ---------- קצבת אזרח ותיק ----------

export interface NiOldAgeInput {
  /** שנות ביטוח (שנות עבודה/תושבות מבוטחת) — קובעות את תוספת הוותק */
  insuranceYears: number;
  /** בן/בת זוג שאינו/ה מקבל/ת קצבה בעצמו/ה */
  spouseSupplementEligible: boolean;
  paramsOverride?: Partial<NiParams>;
}

export interface NiOldAgeResult {
  monthly: number;
  base: number;
  seniorityPct: number;
  seniorityAmount: number;
  spouseSupplement: number;
  trace: CalcTrace;
}

export function calcNiOldAge(input: NiOldAgeInput): NiOldAgeResult {
  const p = withDefaults(input.paramsOverride);
  const years = Math.max(0, input.insuranceYears);
  const seniorityPct = Math.min(p.seniorityMaxPct, years * p.seniorityPctPerYear);
  const seniorityAmount = round2(p.oldAgeIndividual * (seniorityPct / 100));
  const spouseSupplement = input.spouseSupplementEligible ? p.oldAgeSpouseSupplement : 0;
  const monthly = round2(p.oldAgeIndividual + seniorityAmount + spouseSupplement);
  return {
    monthly,
    base: p.oldAgeIndividual,
    seniorityPct,
    seniorityAmount,
    spouseSupplement,
    trace: {
      formula: 'monthly = base + base × min(2% × years, 50%) + spouseSupplement',
      inputs: {
        base: p.oldAgeIndividual,
        insuranceYears: years,
        seniorityPct,
        spouseSupplement,
      },
      notes: [
        'ערכי 2025 — לאימות מול ביטוח לאומי',
        'מבחן הכנסות עד גיל 70 ודחיית קצבה אינם ממודלים',
      ],
    },
  };
}

// ---------- קצבת שאירים ----------

export interface NiSurvivorsInput {
  /** האם נותר/ה אלמן/ה */
  hasSpouse: boolean;
  /** גיל האלמן/ה — קובע את גובה הקצבה (ברירת מחדל: 50+) */
  spouseAge?: number;
  /** גילאי הילדים בעת האירוע */
  childrenAges: number[];
  paramsOverride?: Partial<NiParams>;
}

export interface NiSurvivorsResult {
  monthly: number;
  widowMonthly: number;
  orphansMonthly: number;
  eligibleOrphans: number;
  trace: CalcTrace;
}

export function calcNiSurvivors(input: NiSurvivorsInput): NiSurvivorsResult {
  const p = withDefaults(input.paramsOverride);
  const notes: string[] = ['ערכי 2025 — לאימות מול ביטוח לאומי'];

  let widowMonthly = 0;
  if (input.hasSpouse) {
    const age = input.spouseAge ?? 50;
    if (age >= 50) {
      widowMonthly = p.survivorsWidow50Plus;
    } else if (age >= 40) {
      widowMonthly = p.survivorsWidow40to49;
      notes.push('אלמן/ה בגיל 40–49 — קצבה מופחתת');
    } else {
      notes.push('אלמן/ה מתחת לגיל 40 ללא ילדים — מענק חד-פעמי בלבד (לא ממודל)');
    }
    // אלמן/ה צעיר/ה עם ילדים זכאי/ת לקצבה מלאה
    if (age < 50 && input.childrenAges.some((a) => a < p.orphanAgeLimit)) {
      widowMonthly = p.survivorsWidow50Plus;
      notes.push('אלמן/ה עם ילדים — קצבה מלאה ללא תלות בגיל');
    }
  }

  const eligibleOrphans = input.childrenAges.filter((a) => a < p.orphanAgeLimit).length;
  const orphansMonthly = round2(eligibleOrphans * p.survivorsOrphanSupplement);
  if (eligibleOrphans < input.childrenAges.length) {
    notes.push(
      `יתום זכאי בביטוח לאומי עד גיל ${p.orphanAgeLimit} (לעומת 21 בקרן פנסיה) — חלק מהילדים אינם זכאים`,
    );
  }

  return {
    monthly: round2(widowMonthly + orphansMonthly),
    widowMonthly,
    orphansMonthly,
    eligibleOrphans,
    trace: {
      formula: 'monthly = widowBase(age) + orphanSupplement × eligibleOrphans(<18)',
      inputs: {
        hasSpouse: input.hasSpouse ? 'כן' : 'לא',
        spouseAge: input.spouseAge ?? 'לא נמסר (הונח 50+)',
        eligibleOrphans,
      },
      notes,
    },
  };
}

// ---------- קצבת נכות כללית ----------

export interface NiDisabilityResult {
  monthly: number;
  trace: CalcTrace;
}

export function calcNiDisability(paramsOverride?: Partial<NiParams>): NiDisabilityResult {
  const p = withDefaults(paramsOverride);
  return {
    monthly: p.disabilityFullIndividual,
    trace: {
      formula: 'monthly = disabilityFullIndividual (דרגת אי-כושר 100%)',
      inputs: { disabilityFullIndividual: p.disabilityFullIndividual },
      notes: [
        'ערכי 2025 — לאימות מול ביטוח לאומי',
        'הונחה דרגת אי-כושר מלאה; תוספות תלויים אינן ממודלות',
        'קרן הפנסיה רשאית לקזז קצבת ביטוח לאומי כשהסך עולה על השכר — אלא אם קיימת מטריה ביטוחית עם ביטול קיזוז',
      ],
    },
  };
}
