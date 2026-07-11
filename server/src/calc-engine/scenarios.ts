import type { CalcTrace, ProductType } from './types';

/**
 * תרחישי "מה אם" — מוות ואובדן כושר עבודה (מפרט פרק 5).
 * חישוב snapshot: מה קורה אם האירוע מתרחש היום.
 *
 * כללי התקנון (מפרט 5.1):
 * - קצבת שאירים: אלמן/ה 60% מהשכר המבוטח, יתום (עד גיל 21) 40%,
 *   סה"כ מוגבל ל-100% מהשכר המבוטח — מוכפל בשיעור הכיסוי שנבחר.
 * - אין שאירים / ויתור שארים → הצבירה למוטבים כסכום חד-פעמי.
 * - קצבת נכות: עד 75% מהשכר המבוטח (לפי שיעור הכיסוי) + שחרור מהפקדות.
 */

export interface FamilyStatus {
  hasSpouse: boolean;
  /** תאריכי לידה של הילדים (ISO) — זכאות יתום עד גיל 21 */
  childrenBirthDates: string[];
}

export interface ScenarioProductInput {
  id: string;
  name: string;
  type: ProductType;
  currentBalance: number;
  /**
   * שכר מבוטח בקרן זו (₪ לחודש) — "השכר הקובע" של הקרן.
   * ריק = נופל חזרה לשכר הגלובלי של הפרופיל.
   */
  insuredMonthlySalary?: number;
  /**
   * קרן לא פעילה (מוקפאת) — ללא הפקדות שוטפות.
   * למשל: קרן שהתקבלה בחלוקה לאחר גירושין, או קרן ממעסיק קודם.
   * עמית לא פעיל = אין כיסוי שאירים ונכות; הצבירה בלבד.
   */
  frozen?: boolean;
  /** % כיסוי שאירים (ברירת מחדל 100) — רלוונטי לקרנות פנסיה */
  survivorsPct?: number;
  /** % כיסוי נכות (ברירת מחדל 75) — רלוונטי לקרנות פנסיה */
  disabilityPct?: number;
  /** ויתור על כיסוי שאירים (רווק/ה) */
  survivorsWaiver?: boolean;
  /** סכום ביטוח למקרה מוות — ביטוח מנהלים */
  deathBenefitAmount?: number;
  /** מוטבים לסכומים חד-פעמיים — ריק = "יורשים על פי דין" */
  beneficiaries?: { name: string; pct: number }[];
  /** לשלב הפרישה: הקצבה החודשית של המוצר (חושבה בפרישה) */
  monthlyAnnuity?: number;
  /** לשלב הפרישה: הצבירה/ההון בפרישה */
  balanceAtRetirement?: number;
  /** % קצבת שאיר לבן/בת זוג ממסלול הקצבה (ברירת מחדל 60) */
  retirementSurvivorPct?: number;
  /** תקופת הבטחת תשלומים בחודשים (ברירת מחדל 240 — המסלול הנפוץ) */
  guaranteedMonths?: number;
}

export interface ScenariosInput {
  family: FamilyStatus;
  /** שכר חודשי מבוטח (₪) — הבסיס לקצבאות שאירים ונכות */
  insuredMonthlySalary: number;
  /** יעד הכנסה למשפחה כאחוז מהשכר (ברירת מחדל 70%) */
  incomeTargetPct?: number;
  products: ScenarioProductInput[];
  /** נקודת ייחוס (ברירת מחדל היום) — לקיבוע בבדיקות */
  asOf?: string;
  /**
   * מצב "אחרי פרישה": האירוע מתרחש בשלב קבלת הקצבה.
   * הכללים שונים לגמרי — קצבת שאיר כאחוז מהקצבה + הבטחת תשלומים.
   */
  retirementPhase?: { monthsSinceRetirement: number };
}

export interface DeathProductOutcome {
  id: string;
  name: string;
  type: ProductType;
  /** קצבת שאירים חודשית מהמוצר */
  survivorMonthly: number;
  /** פיצול הקצבה: חלק בן/בת הזוג וחלק הילדים */
  spouseMonthly: number;
  childrenMonthly: number;
  /** סכום חד-פעמי (צבירה למוטבים / סכום ביטוח) */
  lumpSum: number;
  /** פיצול הסכום החד-פעמי לפי מוטבים */
  lumpSumSplit: { name: string; amount: number }[];
  detail: string;
}

export interface DisabilityProductOutcome {
  id: string;
  name: string;
  type: ProductType;
  /** קצבת נכות חודשית */
  disabilityMonthly: number;
  detail: string;
}

export interface ScenariosResult {
  death: {
    eligibleChildren: number;
    totalSurvivorMonthly: number;
    totalLumpSum: number;
    targetMonthly: number;
    /** פער חודשי מול היעד (0 = אין פער) */
    gapMonthly: number;
    products: DeathProductOutcome[];
  };
  disability: {
    /** קצבת הנכות בפועל — מוגבלת ל-75% מהשכר המבוטח הכולל */
    totalDisabilityMonthly: number;
    /** סך הכיסויים לפני הקיטום — להצגת כיסוי עודף */
    uncappedTotalMonthly: number;
    /** כיסוי עודף שמשולם עליו אך לא ניתן לממשו (0 = אין) */
    excessMonthly: number;
    targetMonthly: number;
    gapMonthly: number;
    products: DisabilityProductOutcome[];
  };
  warnings: string[];
  trace: CalcTrace;
}

/** מוצרים עם כיסוי ביטוחי מובנה (קרנות פנסיה חדשות) */
const PENSION_TYPES: ReadonlySet<ProductType> = new Set([
  'PENSION_COMPREHENSIVE',
  'PENSION_GENERAL',
]);

const SPOUSE_RATE = 0.6;
const ORPHAN_RATE = 0.4;
const DEFAULT_DISABILITY_PCT = 75;
const DEFAULT_SURVIVORS_PCT = 100;
const DEFAULT_TARGET_PCT = 70;
const ORPHAN_MAX_AGE = 21;

const DEFAULT_RETIREMENT_SURVIVOR_PCT = 60;
const DEFAULT_GUARANTEED_MONTHS = 240;

export function calcScenarios(input: ScenariosInput): ScenariosResult {
  if (input.retirementPhase) {
    return calcRetirementPhase(input, input.retirementPhase.monthsSinceRetirement);
  }
  if (input.insuredMonthlySalary < 0) {
    throw new Error('שכר מבוטח לא יכול להיות שלילי');
  }
  const asOf = input.asOf ? new Date(input.asOf) : new Date();
  const targetPct = input.incomeTargetPct ?? DEFAULT_TARGET_PCT;
  const targetMonthly = round2((input.insuredMonthlySalary * targetPct) / 100);

  const eligibleChildren = input.family.childrenBirthDates.filter((b) => {
    const birth = new Date(b);
    if (isNaN(birth.getTime())) throw new Error(`תאריך לידה של ילד לא תקין: ${b}`);
    return ageInYears(birth, asOf) < ORPHAN_MAX_AGE;
  }).length;

  const hasSurvivors = input.family.hasSpouse || eligibleChildren > 0;
  const warnings: string[] = [];

  /** השכר הקובע של קרן: פר-קרן אם הוזן, אחרת השכר הגלובלי */
  const salaryOf = (p: ScenarioProductInput) =>
    p.insuredMonthlySalary ?? input.insuredMonthlySalary;

  /** פיצול סכום חד-פעמי לפי מוטבים; ריק/יתרה → "יורשים על פי דין" */
  const splitLump = (
    p: ScenarioProductInput,
    total: number,
  ): { name: string; amount: number }[] => {
    if (total <= 0) return [];
    const bens = (p.beneficiaries ?? []).filter((b) => b.pct > 0 && b.name.trim());
    const pctSum = bens.reduce((s, b) => s + b.pct, 0);
    if (pctSum > 100.0001) {
      throw new Error(`"${p.name}": אחוזי המוטבים עולים על 100% (${pctSum}%)`);
    }
    const split = bens.map((b) => ({
      name: b.name.trim(),
      amount: round2((total * b.pct) / 100),
    }));
    const remainder = round2(total - split.reduce((s, b) => s + b.amount, 0));
    if (remainder > 0.01) {
      split.push({ name: 'יורשים על פי דין', amount: remainder });
    }
    return split;
  };

  // ---------- תרחיש מוות ----------
  const lumpOutcome = (
    p: ScenarioProductInput,
    total: number,
    detail: string,
  ): DeathProductOutcome => ({
    id: p.id,
    name: p.name,
    type: p.type,
    survivorMonthly: 0,
    spouseMonthly: 0,
    childrenMonthly: 0,
    lumpSum: round2(total),
    lumpSumSplit: splitLump(p, total),
    detail,
  });

  const deathProducts: DeathProductOutcome[] = input.products.map((p) => {
    if (PENSION_TYPES.has(p.type)) {
      if (p.frozen) {
        return lumpOutcome(
          p,
          p.currentBalance,
          'קרן לא פעילה (ללא הפקדות) — אין כיסוי שאירים מהשכר; הצבירה לשאירים/מוטבים',
        );
      }
      if (p.survivorsWaiver || !hasSurvivors) {
        return lumpOutcome(
          p,
          p.currentBalance,
          p.survivorsWaiver
            ? 'ויתור על כיסוי שאירים — הצבירה למוטבים כסכום חד-פעמי'
            : 'אין שאירים זכאים — הצבירה למוטבים כסכום חד-פעמי',
        );
      }
      const coverage = (p.survivorsPct ?? DEFAULT_SURVIVORS_PCT) / 100;
      const coveredSalary = salaryOf(p) * coverage;
      const spousePart = input.family.hasSpouse ? SPOUSE_RATE : 0;
      const childrenPart = eligibleChildren * ORPHAN_RATE;
      const rawRate = spousePart + childrenPart;
      const totalRate = Math.min(rawRate, 1);
      // אם עברנו את תקרת ה-100% — מקטינים את החלקים באופן יחסי
      const scale = rawRate > 0 ? totalRate / rawRate : 0;
      const spouseMonthly = round2(coveredSalary * spousePart * scale);
      const childrenMonthly = round2(coveredSalary * childrenPart * scale);
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        survivorMonthly: round2(spouseMonthly + childrenMonthly),
        spouseMonthly,
        childrenMonthly,
        lumpSum: 0,
        lumpSumSplit: [],
        detail: buildSurvivorDetail(
          input.family.hasSpouse,
          eligibleChildren,
          rawRate > 1,
        ),
      };
    }

    if (p.type === 'MANAGERS_INSURANCE') {
      const lump = p.currentBalance + (p.deathBenefitAmount ?? 0);
      return lumpOutcome(
        p,
        lump,
        p.deathBenefitAmount
          ? 'צבירה + סכום ביטוח למקרה מוות — למוטבים'
          : 'הצבירה למוטבים (לא הוגדר סכום ביטוח למקרה מוות)',
      );
    }

    // מוצרים הוניים וגמל: הצבירה למוטבים/יורשים
    return lumpOutcome(p, p.currentBalance, 'הצבירה למוטבים כסכום חד-פעמי');
  });

  const totalSurvivorMonthly = round2(
    deathProducts.reduce((s, p) => s + p.survivorMonthly, 0),
  );
  const totalLumpSum = round2(deathProducts.reduce((s, p) => s + p.lumpSum, 0));

  // ---------- תרחיש נכות (אובדן כושר עבודה) ----------
  const disabilityProducts: DisabilityProductOutcome[] = input.products.map((p) => {
    if (PENSION_TYPES.has(p.type)) {
      if (p.frozen) {
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          disabilityMonthly: 0,
          detail: 'קרן לא פעילה (ללא הפקדות) — אין כיסוי נכות',
        };
      }
      const pct = p.disabilityPct ?? DEFAULT_DISABILITY_PCT;
      const monthly = round2((salaryOf(p) * pct) / 100);
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        disabilityMonthly: monthly,
        detail: `קצבת נכות ${pct}% מהשכר המבוטח + שחרור מהפקדות (הקרן ממשיכה להפקיד עבורך)`,
      };
    }
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      disabilityMonthly: 0,
      detail:
        p.type === 'MANAGERS_INSURANCE'
          ? 'כיסוי אכ"ע בביטוח מנהלים אינו נתמך עדיין בחישוב — בדוק בפוליסה'
          : 'ללא כיסוי נכות במוצר זה',
    };
  });

  // תקרה מצרפית: בפועל קצבת נכות כוללת מוגבלת ל-75% מהשכר המבוטח
  const uncappedTotalMonthly = round2(
    disabilityProducts.reduce((s, p) => s + p.disabilityMonthly, 0),
  );
  const disabilityCap =
    input.insuredMonthlySalary > 0
      ? round2(input.insuredMonthlySalary * 0.75)
      : null;
  const totalDisabilityMonthly =
    disabilityCap !== null
      ? Math.min(uncappedTotalMonthly, disabilityCap)
      : uncappedTotalMonthly;
  const excessMonthly = round2(uncappedTotalMonthly - totalDisabilityMonthly);

  // ---------- אזהרות ----------
  if (input.insuredMonthlySalary === 0) {
    warnings.push('לא הוזן שכר מבוטח — קצבאות השאירים והנכות מחושבות כ-0');
  }
  const activePensions = input.products.filter(
    (p) => PENSION_TYPES.has(p.type) && !p.frozen,
  ).length;
  const frozenPensions = input.products.filter(
    (p) => PENSION_TYPES.has(p.type) && p.frozen,
  ).length;
  if (activePensions === 0) {
    warnings.push('אין בתיק קרן פנסיה פעילה — אין כיסוי שאירים ונכות מובנה');
  }
  if (excessMonthly > 0) {
    warnings.push(
      `כפל ביטוחי בנכות: סך הכיסויים ${uncappedTotalMonthly.toLocaleString('he-IL')} ₪ אך התקרה בפועל 75% מהשכר (${totalDisabilityMonthly.toLocaleString('he-IL')} ₪) — אתה משלם על כיסוי עודף של ${excessMonthly.toLocaleString('he-IL')} ₪/חודש שלא ניתן לממש`,
    );
  } else if (activePensions > 1) {
    warnings.push(
      'יותר מקרן פנסיה פעילה אחת עם כיסוי — בדוק כפל עלויות כיסוי בין הקרנות',
    );
  }
  if (frozenPensions > 0) {
    warnings.push(
      'יש בתיק קרן לא פעילה — שקול איחוד לקרן הפעילה: חוסך דמי ניהול ומרכז את הצבירה (בדוק תנאים לפני ניוד)',
    );
  }
  if (
    input.family.hasSpouse === false &&
    eligibleChildren === 0 &&
    input.products.some(
      (p) => PENSION_TYPES.has(p.type) && !p.survivorsWaiver && !p.frozen,
    )
  ) {
    warnings.push(
      'רווק/ה ללא ילדים: ניתן לחתום על ויתור כיסוי שאירים בקרן ולהוזיל עלויות — הוויתור תקף לשנתיים ודורש חידוש',
    );
  }

  return {
    death: {
      eligibleChildren,
      totalSurvivorMonthly,
      totalLumpSum,
      targetMonthly,
      gapMonthly: round2(Math.max(0, targetMonthly - totalSurvivorMonthly)),
      products: deathProducts,
    },
    disability: {
      totalDisabilityMonthly,
      uncappedTotalMonthly,
      excessMonthly,
      targetMonthly,
      gapMonthly: round2(Math.max(0, targetMonthly - totalDisabilityMonthly)),
      products: disabilityProducts,
    },
    warnings,
    trace: {
      formula:
        'survivorMonthly = insuredSalary × survivorsPct × min(0.6·spouse + 0.4·orphans, 1); disabilityMonthly = insuredSalary × disabilityPct',
      inputs: {
        insuredMonthlySalary: input.insuredMonthlySalary,
        hasSpouse: String(input.family.hasSpouse),
        childrenCount: input.family.childrenBirthDates.length,
        eligibleChildren,
        incomeTargetPct: targetPct,
        productCount: input.products.length,
      },
      notes: [
        'שכר קובע פר קרן: אם הוזן שכר מבוטח למוצר — הוא הבסיס לקצבאות שלו; אחרת השכר הגלובלי',
        'שיעורי התקנון: אלמן/ה 60%, יתום עד גיל 21 — 40%, מוגבל ל-100% מהשכר המבוטח',
        'קצבת נכות: לפי שיעור הכיסוי בקרן (ברירת מחדל 75%) + שחרור מהפקדות',
        'ביטוח מנהלים: סכום הביטוח למקרה מוות משולם כהון חד-פעמי למוטבים',
        'יעד ההכנסה למשפחה: ' + targetPct + '% מהשכר המבוטח (מפרט 5.1: 70–80%)',
        'החישוב הוא תמונת מצב להיום; מטריצת גילאים מלאה — בשלב הבא',
      ],
    },
  };
}

/**
 * תרחיש מוות אחרי הפרישה — כללי שלב הקצבה:
 * - מוצר קצבתי: בן/בת הזוג מקבל/ת % מהקצבה (מסלול הקצבה, ברירת מחדל 60%).
 *   ללא בן/בת זוג: יתרת התשלומים המובטחים משולמת למוטבים.
 * - מוצר הוני: ההון (בהנחה שטרם נמשך) למוטבים.
 * - אין כיסוי אכ"ע אחרי הפרישה — לא רלוונטי.
 */
function calcRetirementPhase(
  input: ScenariosInput,
  monthsSinceRetirement: number,
): ScenariosResult {
  if (monthsSinceRetirement < 0) {
    throw new Error('monthsSinceRetirement לא יכול להיות שלילי');
  }
  const asOf = input.asOf ? new Date(input.asOf) : new Date();
  const eligibleChildren = input.family.childrenBirthDates.filter((b) => {
    const birth = new Date(b);
    if (isNaN(birth.getTime())) throw new Error(`תאריך לידה של ילד לא תקין: ${b}`);
    return ageInYears(birth, asOf) < ORPHAN_MAX_AGE;
  }).length;

  const warnings: string[] = [];

  const splitLump = (
    p: ScenarioProductInput,
    total: number,
  ): { name: string; amount: number }[] => {
    if (total <= 0) return [];
    const bens = (p.beneficiaries ?? []).filter((b) => b.pct > 0 && b.name.trim());
    const pctSum = bens.reduce((s, b) => s + b.pct, 0);
    if (pctSum > 100.0001) {
      throw new Error(`"${p.name}": אחוזי המוטבים עולים על 100% (${pctSum}%)`);
    }
    const split = bens.map((b) => ({
      name: b.name.trim(),
      amount: round2((total * b.pct) / 100),
    }));
    const remainder = round2(total - split.reduce((s, b) => s + b.amount, 0));
    if (remainder > 0.01) split.push({ name: 'יורשים על פי דין', amount: remainder });
    return split;
  };

  const deathProducts: DeathProductOutcome[] = input.products.map((p) => {
    const annuity = p.monthlyAnnuity ?? 0;

    if (annuity > 0) {
      // מוצר קצבתי בשלב תשלום
      if (input.family.hasSpouse) {
        const pct = p.retirementSurvivorPct ?? DEFAULT_RETIREMENT_SURVIVOR_PCT;
        const spouseMonthly = round2((annuity * pct) / 100);
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          survivorMonthly: spouseMonthly,
          spouseMonthly,
          childrenMonthly: 0,
          lumpSum: 0,
          lumpSumSplit: [],
          detail: `קצבת שאיר לבן/בת הזוג: ${pct}% מהקצבה (לפי מסלול הקצבה), לכל החיים`,
        };
      }
      // ללא בן/בת זוג — יתרת התשלומים המובטחים ליורשים
      const guaranteed = p.guaranteedMonths ?? DEFAULT_GUARANTEED_MONTHS;
      const remaining = Math.max(0, guaranteed - monthsSinceRetirement);
      const lump = round2(remaining * annuity);
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        survivorMonthly: 0,
        spouseMonthly: 0,
        childrenMonthly: 0,
        lumpSum: lump,
        lumpSumSplit: splitLump(p, lump),
        detail:
          remaining > 0
            ? `יתרת הבטחת תשלומים: ${remaining} חודשים × ${round2(annuity).toLocaleString('he-IL')} ₪ (בהנחת הבטחת ${guaranteed} תשלומים)`
            : `תקופת ההבטחה (${guaranteed} תשלומים) הסתיימה — הקצבה פוקעת ללא שאירים`,
      };
    }

    // מוצר הוני
    const capital = p.balanceAtRetirement ?? p.currentBalance;
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      survivorMonthly: 0,
      spouseMonthly: 0,
      childrenMonthly: 0,
      lumpSum: round2(capital),
      lumpSumSplit: splitLump(p, capital),
      detail: 'ההון למוטבים — בהנחה שטרם נמשך (משיכה הדרגתית תוצג בשלב הבא)',
    };
  });

  if (eligibleChildren > 0) {
    warnings.push(
      'יש ילדים מתחת לגיל 21 במועד זה — קצבת יתומי פנסיונר קיימת בחלק מהתקנונים ואינה ממודלת עדיין',
    );
  }
  warnings.push(
    'מסלול הקצבה (אחוז שאיר והבטחת תשלומים) הוא הנחת ברירת מחדל — נבחר בפועל רק במועד הפרישה',
  );

  const totalSurvivorMonthly = round2(
    deathProducts.reduce((s, p) => s + p.survivorMonthly, 0),
  );
  const totalLumpSum = round2(deathProducts.reduce((s, p) => s + p.lumpSum, 0));
  const targetPct = input.incomeTargetPct ?? DEFAULT_TARGET_PCT;
  const targetMonthly = round2((input.insuredMonthlySalary * targetPct) / 100);

  return {
    death: {
      eligibleChildren,
      totalSurvivorMonthly,
      totalLumpSum,
      targetMonthly,
      gapMonthly: round2(Math.max(0, targetMonthly - totalSurvivorMonthly)),
      products: deathProducts,
    },
    disability: {
      totalDisabilityMonthly: 0,
      uncappedTotalMonthly: 0,
      excessMonthly: 0,
      targetMonthly: 0,
      gapMonthly: 0,
      products: input.products.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        disabilityMonthly: 0,
        detail: 'לאחר הפרישה אין כיסוי אובדן כושר עבודה — הקצבה ממשיכה להשתלם כרגיל',
      })),
    },
    warnings,
    trace: {
      formula:
        'spouseMonthly = annuity × survivorPct; heirsLump = max(0, guaranteedMonths − monthsSinceRetirement) × annuity',
      inputs: {
        monthsSinceRetirement,
        hasSpouse: String(input.family.hasSpouse),
        productCount: input.products.length,
      },
      notes: [
        'שלב הפרישה: קצבת שאיר לבן/בת זוג היא אחוז מהקצבה לפי מסלול הקצבה (ברירת מחדל 60%)',
        'ללא בן/בת זוג: יתרת התשלומים המובטחים (ברירת מחדל 240) משולמת למוטבים',
        'מוצרים הוניים: ההון בפרישה למוטבים, בהנחה שטרם נמשך',
        'משיכה הדרגתית של הון בפנסיה (decumulation) — בשלב הבא',
      ],
    },
  };
}

function buildSurvivorDetail(
  hasSpouse: boolean,
  eligibleChildren: number,
  capped: boolean,
): string {
  const parts: string[] = [];
  if (hasSpouse) parts.push('אלמן/ה 60%');
  if (eligibleChildren > 0) parts.push(`${eligibleChildren} יתומים × 40%`);
  let s = 'קצבת שאירים: ' + parts.join(' + ');
  if (capped) s += ' (הוגבל ל-100% מהשכר המבוטח)';
  return s;
}

function ageInYears(birth: Date, asOf: Date): number {
  let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
