import type { CalcTrace, ProductType } from './types';

/**
 * ציון בריאות פנסיוני 0–100 (מפרט 7.1).
 *
 * משקולות: שיעור תחלופה 35 · עלויות 20 · כיסוי שאירים 15 ·
 * כיסוי נכות 15 · התאמת מסלול לגיל 10 · היגיינה 5.
 * כל רכיב מחזיר פירוט והמלצת שיפור — ההמלצות ממוינות לפי הפער בנקודות.
 */

export interface HealthScoreProductInput {
  type: ProductType;
  frozen?: boolean;
  currentBalance: number;
  feeFromBalancePct: number;
  feeFromDepositPct: number;
  /** יש מוטבים מוגדרים */
  hasBeneficiaries: boolean;
  /** % מנייתי מתוך הקצאת המסלולים (מניות + S&P 500) */
  equityPct?: number;
  /** מסלול תלוי גיל (ברירת המחדל הרגולטורית) */
  ageDependentTrack?: boolean;
}

export interface HealthScoreInput {
  age: number;
  /** שיעור תחלופה צפוי (כולל ביטוח לאומי) — null אם אין שכר */
  replacementRatePct: number | null;
  /** יחס כיסוי מוות: קצבת שאירים בפועל ÷ יעד (null = אין יעד/שכר) */
  deathCoverageRatio: number | null;
  /** יחס כיסוי נכות: קצבה בפועל ÷ יעד */
  disabilityCoverageRatio: number | null;
  products: HealthScoreProductInput[];
}

export interface HealthComponent {
  key:
    | 'replacement'
    | 'fees'
    | 'death_coverage'
    | 'disability_coverage'
    | 'track_fit'
    | 'hygiene';
  label: string;
  score: number;
  max: number;
  detail: string;
  recommendation?: string;
}

export type HealthGrade = 'excellent' | 'good' | 'fair' | 'poor';

export interface HealthScoreResult {
  total: number;
  grade: HealthGrade;
  gradeLabel: string;
  components: HealthComponent[];
  /** המלצות ממוינות לפי הפער בנקודות (ההשפעה הגדולה קודם) */
  topRecommendations: string[];
  trace: CalcTrace;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** מוצרי חיסכון הוני — מוטבים קריטיים (הצבירה משולמת להם ישירות) */
const CAPITAL_TYPES: ReadonlySet<ProductType> = new Set([
  'PROVIDENT_FUND',
  'PROVIDENT_INVESTMENT',
  'IRA',
  'STUDY_FUND',
  'MANAGERS_INSURANCE',
]);

export function calcHealthScore(input: HealthScoreInput): HealthScoreResult {
  const components: HealthComponent[] = [];

  // ---------- 1. שיעור תחלופה (35) ----------
  {
    const max = 35;
    let score: number;
    let detail: string;
    let recommendation: string | undefined;
    const pct = input.replacementRatePct;
    if (pct === null) {
      score = 0;
      detail = 'לא הוזן שכר — לא ניתן לחשב שיעור תחלופה';
      recommendation = 'הזן שכר חודשי מבוטח כדי לקבל את המדד המרכזי בתכנון';
    } else if (pct >= 70) {
      score = max;
      detail = `שיעור תחלופה ${pct}% — מעל היעד המומלץ (70%)`;
    } else if (pct >= 55) {
      score = 20 + (15 * (pct - 55)) / 15;
      detail = `שיעור תחלופה ${pct}% — מתחת ליעד (70%)`;
      recommendation = 'הגדלת הפקדות או דחיית פרישה יקרבו אותך ליעד 70%';
    } else if (pct >= 40) {
      score = 8 + (12 * (pct - 40)) / 15;
      detail = `שיעור תחלופה ${pct}% — נמוך משמעותית מהיעד`;
      recommendation =
        'נדרשת פעולה: הגדלת הפקדות, הפקדה עצמאית או דחיית פרישה — כל שנה משנה מהותית';
    } else {
      score = (8 * pct) / 40;
      detail = `שיעור תחלופה ${pct}% — קריטי`;
      recommendation =
        'שיעור התחלופה קריטי — מומלץ ייעוץ פנסיוני מקיף ובחינת כל אפיקי החיסכון';
    }
    components.push({
      key: 'replacement',
      label: 'שיעור תחלופה',
      score: round1(score),
      max,
      detail,
      recommendation,
    });
  }

  // ---------- 2. עלויות (20) ----------
  {
    const max = 20;
    const savings = input.products.filter(
      (p) => p.type !== 'DISABILITY_INSURANCE' && p.type !== 'LIFE_INSURANCE',
    );
    const totalBalance = savings.reduce((s, p) => s + p.currentBalance, 0);
    const wAvgBalanceFee =
      totalBalance > 0
        ? savings.reduce((s, p) => s + p.feeFromBalancePct * p.currentBalance, 0) /
          totalBalance
        : savings.length > 0
          ? savings.reduce((s, p) => s + p.feeFromBalancePct, 0) / savings.length
          : 0;
    const avgDepositFee =
      savings.length > 0
        ? savings.reduce((s, p) => s + p.feeFromDepositPct, 0) / savings.length
        : 0;

    let score: number;
    if (wAvgBalanceFee <= 0.3) score = max;
    else if (wAvgBalanceFee <= 0.6) score = 15;
    else if (wAvgBalanceFee <= 0.9) score = 10;
    else if (wAvgBalanceFee <= 1.05) score = 5;
    else score = 0;
    if (avgDepositFee > 2) score = Math.max(0, score - 3);

    const feeStr = round1(wAvgBalanceFee);
    components.push({
      key: 'fees',
      label: 'דמי ניהול',
      score: round1(score),
      max,
      detail: `דמי ניהול מצבירה משוקללים: ${feeStr}% (מהפקדה בממוצע: ${round1(avgDepositFee)}%)`,
      recommendation:
        score < 15
          ? 'דמי הניהול גבוהים — השווה מול קרנות ברירת מחדל (0.22%/1%) ושקול מיקוח או ניוד'
          : undefined,
    });
  }

  // ---------- 3+4. כיסויים ביטוחיים (15+15) ----------
  const coverageComponent = (
    key: 'death_coverage' | 'disability_coverage',
    label: string,
    ratio: number | null,
    recommendationText: string,
  ): HealthComponent => {
    const max = 15;
    if (ratio === null) {
      return {
        key,
        label,
        score: 7,
        max,
        detail: 'לא הוזן שכר — הכיסוי לא נבחן מול יעד',
        recommendation: 'הזן שכר מבוטח כדי לבחון את הכיסוי מול צורכי המשפחה',
      };
    }
    const capped = Math.min(1, Math.max(0, ratio));
    const pctStr = Math.round(ratio * 100);
    return {
      key,
      label,
      score: round1(max * capped),
      max,
      detail:
        ratio >= 1
          ? `הכיסוי עומד ביעד (${pctStr}%)`
          : `הכיסוי מכסה ${pctStr}% מהיעד בלבד`,
      recommendation: ratio < 1 ? recommendationText : undefined,
    };
  };
  components.push(
    coverageComponent(
      'death_coverage',
      'כיסוי שאירים',
      input.deathCoverageRatio,
      'פער בכיסוי שאירים — שקול הגדלת שיעור הכיסוי בקרן או ריסק משלים',
    ),
    coverageComponent(
      'disability_coverage',
      'כיסוי אובדן כושר עבודה',
      input.disabilityCoverageRatio,
      'פער בכיסוי אכ"ע — בדוק ביטוח שכר לא מבוטח או פוליסת אכ"ע פרטית/מטריה',
    ),
  );

  // ---------- 5. התאמת מסלול לגיל (10) ----------
  {
    const max = 10;
    const withTracks = input.products.filter(
      (p) =>
        p.type !== 'DISABILITY_INSURANCE' &&
        (p.ageDependentTrack || p.equityPct !== undefined),
    );
    let score: number;
    let detail: string;
    let recommendation: string | undefined;
    if (withTracks.length === 0) {
      score = 6;
      detail = 'לא הוגדרו מסלולי השקעה — הונח מסלול ברירת מחדל';
      recommendation =
        'הגדר את מסלולי ההשקעה בפועל של כל מוצר לבחינת התאמה לגיל';
    } else if (withTracks.some((p) => p.ageDependentTrack)) {
      score = max;
      detail = 'מסלול תלוי גיל — מתאים את הסיכון אוטומטית';
    } else {
      const totalBal = withTracks.reduce((s, p) => s + p.currentBalance, 0);
      const wEquity =
        totalBal > 0
          ? withTracks.reduce(
              (s, p) => s + (p.equityPct ?? 0) * p.currentBalance,
              0,
            ) / totalBal
          : withTracks.reduce((s, p) => s + (p.equityPct ?? 0), 0) /
            withTracks.length;
      const eq = Math.round(wEquity);
      if (input.age < 45) {
        if (wEquity >= 40) {
          score = max;
          detail = `גיל ${input.age} עם ${eq}% מניות — רמת סיכון מתאימה לטווח הארוך`;
        } else {
          score = 6;
          detail = `גיל ${input.age} עם ${eq}% מניות בלבד — שמרני ביחס לאופק ההשקעה`;
          recommendation =
            'בגיל צעיר מסלול מנייתי מגדיל משמעותית את הצבירה — שקול העלאת החשיפה';
        }
      } else if (input.age < 55) {
        score = wEquity >= 30 && wEquity <= 70 ? max : 7;
        detail = `גיל ${input.age} עם ${eq}% מניות`;
      } else {
        if (wEquity > 60) {
          score = 3;
          detail = `גיל ${input.age} עם ${eq}% מניות — חשיפה גבוהה סמוך לפרישה`;
          recommendation =
            'סמוך לפרישה ירידת שוק חדה עלולה לפגוע בקצבה — שקול הפחתת סיכון הדרגתית';
        } else {
          score = max;
          detail = `גיל ${input.age} עם ${eq}% מניות — רמת סיכון סבירה לקראת פרישה`;
        }
      }
    }
    components.push({
      key: 'track_fit',
      label: 'התאמת מסלול לגיל',
      score: round1(score),
      max,
      detail,
      recommendation,
    });
  }

  // ---------- 6. היגיינה (5) ----------
  {
    const max = 5;
    let score = max;
    const issues: string[] = [];
    const missingBens = input.products.filter(
      (p) => CAPITAL_TYPES.has(p.type) && p.currentBalance > 0 && !p.hasBeneficiaries,
    );
    if (missingBens.length > 0) {
      score -= 2;
      issues.push(`${missingBens.length} מוצרים הוניים ללא מוטבים מוגדרים`);
    }
    const frozen = input.products.filter((p) => p.frozen);
    if (frozen.length > 0) {
      score -= 1;
      issues.push(`${frozen.length} קופות לא פעילות (שקול איחוד)`);
    }
    const recommendations: string[] = [];
    if (missingBens.length > 0) recommendations.push('עדכן מוטבים בכל המוצרים ההוניים');
    if (frozen.length > 0) recommendations.push('שקול איחוד קופות לא פעילות');
    components.push({
      key: 'hygiene',
      label: 'היגיינה פנסיונית',
      score: Math.max(0, round1(score)),
      max,
      detail: issues.length > 0 ? issues.join(' · ') : 'מוטבים מוגדרים ואין קופות רדומות',
      recommendation: recommendations.length > 0 ? recommendations.join(' · ') : undefined,
    });
  }

  const total = Math.round(components.reduce((s, c) => s + c.score, 0));
  const grade: HealthGrade =
    total >= 85 ? 'excellent' : total >= 70 ? 'good' : total >= 50 ? 'fair' : 'poor';
  const gradeLabel = { excellent: 'מצוין', good: 'טוב', fair: 'דורש שיפור', poor: 'דורש טיפול' }[
    grade
  ];

  const topRecommendations = components
    .filter((c) => c.recommendation)
    .sort((a, b) => b.max - b.score - (a.max - a.score))
    .map((c) => c.recommendation!);

  return {
    total,
    grade,
    gradeLabel,
    components,
    topRecommendations,
    trace: {
      formula:
        'total = replacement(35) + fees(20) + death(15) + disability(15) + trackFit(10) + hygiene(5)',
      inputs: {
        age: input.age,
        replacementRatePct: input.replacementRatePct ?? 'לא הוזן שכר',
        productCount: input.products.length,
      },
      notes: [
        'משקולות לפי מפרט 7.1',
        'שיעור התחלופה כולל קצבת אזרח ותיק אם נכללה בחישוב התיק',
        'רכיב העלויות: דמי ניהול מצבירה משוקללים לפי יתרה',
      ],
    },
  };
}
