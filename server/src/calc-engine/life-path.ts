import type { CalcTrace, SeriesPoint } from './types';
import { annualToMonthlyRate } from './projection';
import { calcJobExit } from './job-exit';

/**
 * סימולטור מסלול חיים — לא עוד מחשבון בודד, אלא ציר זמן שמריץ אירועי
 * חיים (עזיבת עבודה, אבטלה, חופשת לידה, שינוי שכר) ברצף על התיק האמיתי
 * של המשתמש, ומראה עקומת הקרנה אחת מהיום ועד הפרישה — לעומת "מה היה
 * קורה בלי האירועים האלה". משתמש בנוסחת ההקרנה הקיימת (projection.ts)
 * ובנוסחת עזיבת העבודה הקיימת (job-exit.ts) — לא ממציא חישוב פיננסי חדש.
 */

export type LifePathEventType =
  | 'JOB_EXIT_WITHDRAW'
  | 'UNEMPLOYMENT_GAP'
  | 'PARENTAL_LEAVE'
  | 'SALARY_CHANGE';

export interface LifePathEvent {
  id: string;
  type: LifePathEventType;
  /** חודשים מהיום שבו האירוע מתרחש (0 = היום) */
  atMonth: number;
  label?: string;

  // JOB_EXIT_WITHDRAW
  /** הסכום שנמשך מרכיב הפיצויים (₪) — יוצא מהצבירה המצטברת */
  severanceWithdrawn?: number;
  yearsOfServiceAtExit?: number;
  lastMonthlySalaryAtExit?: number;
  marginalTaxRatePct?: number;

  // UNEMPLOYMENT_GAP / PARENTAL_LEAVE
  /** משך האירוע בחודשים */
  durationMonths?: number;
  /** % מההפקדה הרגילה שממשיך במהלך האירוע (0 = הפקדות מושהות לגמרי) */
  depositDuringPct?: number;

  // SALARY_CHANGE
  /** ההפקדה החודשית החדשה מרגע זה ואילך (₪) */
  newMonthlyDeposit?: number;
}

export interface LifePathInput {
  currentBalance: number;
  monthlyDeposit: number;
  feeFromDepositPct: number;
  feeFromBalancePct: number;
  annualReturnPct: number;
  annualSalaryGrowthPct: number;
  /** חודשים עד הפרישה */
  months: number;
  /** מקדם המרה לקצבה חודשית, לצורך המרת הצבירה הסופית */
  conversionFactor: number;
  events: LifePathEvent[];
}

export interface LifePathEventOutcome {
  id: string;
  type: LifePathEventType;
  label: string;
  monthOccurred: number;
  detail: string;
  /** השפעה על הצבירה הסופית מול הבסיס (שלילי = פגיעה, חיובי = שיפור) */
  balanceImpact: number;
}

export interface LifePathResult {
  /** הקרנה עם כל האירועים ברצף */
  series: SeriesPoint[];
  /** הקרנת בסיס — ללא אף אירוע, להשוואה */
  baselineSeries: SeriesPoint[];
  baselineFinalBalance: number;
  finalBalance: number;
  baselineMonthlyAnnuity: number;
  finalMonthlyAnnuity: number;
  /** finalBalance − baselineFinalBalance */
  totalImpact: number;
  events: LifePathEventOutcome[];
  warnings: string[];
  trace: CalcTrace;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** מריץ הקרנה חודש-אחר-חודש, עם אירועים אופציונליים שמשנים את המסלול */
function runPath(input: LifePathInput, events: LifePathEvent[]): SeriesPoint[] {
  const rMonthly = annualToMonthlyRate(input.annualReturnPct);
  const salaryGrowthMonthly = annualToMonthlyRate(input.annualSalaryGrowthPct);
  const depositFeeFraction = input.feeFromDepositPct / 100;
  const balanceFeeMonthlyFraction = input.feeFromBalancePct / 100 / 12;

  const sorted = [...events].sort((a, b) => a.atMonth - b.atMonth);
  const gaps = sorted.filter(
    (e) => e.type === 'UNEMPLOYMENT_GAP' || e.type === 'PARENTAL_LEAVE',
  );
  const salaryChanges = sorted.filter((e) => e.type === 'SALARY_CHANGE');
  const withdrawals = sorted.filter((e) => e.type === 'JOB_EXIT_WITHDRAW');

  let balance = input.currentBalance;
  let baseDeposit = input.monthlyDeposit;
  const series: SeriesPoint[] = [{ month: 0, balance: round2(balance) }];

  for (let m = 0; m < input.months; m++) {
    // שינוי שכר קבוע שמתחיל בחודש הזה
    for (const s of salaryChanges) {
      if (s.atMonth === m && s.newMonthlyDeposit !== undefined) {
        baseDeposit = s.newMonthlyDeposit;
      }
    }

    // האם אנחנו בתוך חלון אבטלה/חופשת לידה החודש?
    const activeGap = gaps.find(
      (g) => m >= g.atMonth && m < g.atMonth + (g.durationMonths ?? 0),
    );
    const deposit = activeGap
      ? baseDeposit * ((activeGap.depositDuringPct ?? 0) / 100)
      : baseDeposit;

    const growth = balance * rMonthly;
    const depositFee = deposit * depositFeeFraction;
    const netDeposit = deposit - depositFee;
    const balanceFee = balance * balanceFeeMonthlyFraction;
    balance = balance + growth + netDeposit - balanceFee;

    // משיכת פיצויים בעזיבת עבודה — יוצאת מהצבירה המצטברת באותו חודש
    for (const w of withdrawals) {
      if (w.atMonth === m && w.severanceWithdrawn) {
        balance = Math.max(0, balance - w.severanceWithdrawn);
      }
    }

    baseDeposit *= 1 + salaryGrowthMonthly;

    if ((m + 1) % 12 === 0 || m === input.months - 1) {
      series.push({ month: m + 1, balance: round2(balance) });
    }
  }

  return series;
}

export function calcLifePath(input: LifePathInput): LifePathResult {
  if (input.months <= 0 || !Number.isInteger(input.months)) {
    throw new Error('months חייב להיות מספר שלם חיובי');
  }
  if (input.currentBalance < 0) throw new Error('currentBalance לא יכול להיות שלילי');
  if (!(input.conversionFactor > 0)) throw new Error('מקדם המרה חייב להיות חיובי');
  for (const e of input.events) {
    if (e.atMonth < 0 || e.atMonth > input.months) {
      throw new Error(`אירוע "${e.label ?? e.id}" מחוץ לטווח הציר (0–${input.months} חודשים)`);
    }
  }

  const baselineSeries = runPath(input, []);
  const series = runPath(input, input.events);

  const baselineFinalBalance = baselineSeries[baselineSeries.length - 1].balance;
  const finalBalance = series[series.length - 1].balance;
  const baselineMonthlyAnnuity = round2(baselineFinalBalance / input.conversionFactor);
  const finalMonthlyAnnuity = round2(finalBalance / input.conversionFactor);

  const warnings: string[] = [];
  const events: LifePathEventOutcome[] = [];

  for (const e of [...input.events].sort((a, b) => a.atMonth - b.atMonth)) {
    if (e.type === 'JOB_EXIT_WITHDRAW' && e.severanceWithdrawn) {
      const yearsToRetirement = Math.max(0, (input.months - e.atMonth) / 12);
      let detail = `משיכת ${e.severanceWithdrawn.toLocaleString('he-IL')} ₪ מרכיב הפיצויים`;
      let balanceImpact = -e.severanceWithdrawn;
      if (
        e.yearsOfServiceAtExit &&
        e.lastMonthlySalaryAtExit &&
        e.marginalTaxRatePct !== undefined
      ) {
        try {
          const jr = calcJobExit({
            severanceBalance: e.severanceWithdrawn,
            yearsOfService: e.yearsOfServiceAtExit,
            lastMonthlySalary: e.lastMonthlySalaryAtExit,
            yearsToRetirement,
            annualReturnPct: input.annualReturnPct,
            conversionFactor: input.conversionFactor,
            marginalTaxRatePct: e.marginalTaxRatePct,
          });
          detail = `נטו ביד: ${jr.netToday.toLocaleString('he-IL')} ₪ (מס ${jr.taxOnTaxable.toLocaleString('he-IL')} ₪) · אובדן קצבה עתידית: ${jr.monthlyAnnuityLoss.toLocaleString('he-IL')} ₪/חודש`;
          balanceImpact = -jr.balanceAtRetirement;
        } catch {
          // אם הקלט המלא לא הוזן — משאירים את הפירוט הבסיסי
        }
      }
      events.push({
        id: e.id,
        type: e.type,
        label: e.label ?? 'עזיבת עבודה — משיכת פיצויים',
        monthOccurred: e.atMonth,
        detail,
        balanceImpact: round2(balanceImpact),
      });
    } else if (e.type === 'UNEMPLOYMENT_GAP' || e.type === 'PARENTAL_LEAVE') {
      const months = e.durationMonths ?? 0;
      const pct = e.depositDuringPct ?? 0;
      events.push({
        id: e.id,
        type: e.type,
        label:
          e.label ?? (e.type === 'UNEMPLOYMENT_GAP' ? 'תקופת אבטלה' : 'חופשת לידה'),
        monthOccurred: e.atMonth,
        detail:
          pct > 0
            ? `${months} חודשים בהפקדה מופחתת ל-${pct}% מהרגיל`
            : `${months} חודשים ללא הפקדות`,
        balanceImpact: 0, // ההשפעה מגולמת בהפרש הכולל, לא ניתנת לבידוד מדויק
      });
      if (months <= 0) {
        warnings.push(`"${e.label ?? e.type}": לא הוגדר משך — האירוע לא השפיע על ההקרנה`);
      }
    } else if (e.type === 'SALARY_CHANGE') {
      events.push({
        id: e.id,
        type: e.type,
        label: e.label ?? 'שינוי שכר/הפקדה',
        monthOccurred: e.atMonth,
        detail: `ההפקדה החודשית משתנה ל-${(e.newMonthlyDeposit ?? 0).toLocaleString('he-IL')} ₪ מחודש זה ואילך`,
        balanceImpact: 0,
      });
    }
  }

  if (input.events.length === 0) {
    warnings.push('לא נוספו אירועים — ההקרנה זהה לתחזית הרגילה של התיק');
  }

  return {
    series,
    baselineSeries,
    baselineFinalBalance,
    finalBalance,
    baselineMonthlyAnnuity,
    finalMonthlyAnnuity,
    totalImpact: round2(finalBalance - baselineFinalBalance),
    events,
    warnings,
    trace: {
      formula:
        'runPath(events) vs runPath([]) — אותה נוסחת הקרנה חודשית כמו בתחזית הרגילה (projection.ts), עם אירועים שמשנים הפקדה/מושכים מהצבירה בנקודות זמן נבחרות',
      inputs: {
        currentBalance: input.currentBalance,
        monthlyDeposit: input.monthlyDeposit,
        months: input.months,
        eventCount: input.events.length,
      },
      notes: [
        'משיכת פיצויים משתמשת בנוסחת עזיבת העבודה הקיימת (job-exit.ts) כשהוזן קלט מלא לאירוע',
        'אבטלה/חופשת לידה משפיעות על ההפקדה בלבד — לא על דמי הניהול או הכיסויים הביטוחיים',
        'ההשוואה היא "עם האירועים" מול "בלי האירועים" — לא מול הפרופיל של אדם אחר',
      ],
    },
  };
}
