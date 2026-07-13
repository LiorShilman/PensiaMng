import type { CalcTrace } from './types';
import type { ScenariosResult } from './scenarios';
import type { HealthScoreResult } from './health-score';
import type { FeeComparisonResult } from './fee-comparison';
import type { TaxBenefitsResult } from './tax-benefits';

/**
 * מנוע תובנות (Insights Engine, מפרט 7.3) — לא מחשב שום דבר פיננסי חדש;
 * מרכז ומדרג אותות שכבר חושבו ע"י מנועי scenarios / health-score /
 * fee-comparison / tax-benefits לרשימה אחת ממוינת לפי חומרה ואז השפעה
 * כספית שנתית משוערת, כדי שהמשתמש יראה במבט אחד מה הכי כדאי לטפל בו.
 */

export type InsightSeverity = 'critical' | 'warning' | 'info';
export type InsightCategory =
  | 'coverage'
  | 'fees'
  | 'tax'
  | 'hygiene'
  | 'track_fit'
  | 'replacement';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  category: InsightCategory;
  title: string;
  detail: string;
  /** אומדן השפעה כספית שנתית (₪) — לצורך מיון בלבד; ריק אם אינו כמותי */
  estimatedAnnualImpact?: number;
}

export interface InsightsInput {
  scenarios?: ScenariosResult | null;
  healthScore?: HealthScoreResult | null;
  feeComparison?: FeeComparisonResult | null;
  taxBenefits?: TaxBenefitsResult | null;
}

export interface InsightsResult {
  insights: Insight[];
  trace: CalcTrace;
}

const HEALTH_KEY_CATEGORY: Record<HealthScoreResult['components'][number]['key'], InsightCategory> = {
  replacement: 'replacement',
  fees: 'fees',
  death_coverage: 'coverage',
  disability_coverage: 'coverage',
  track_fit: 'track_fit',
  hygiene: 'hygiene',
};

const SEVERITY_RANK: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function buildInsights(input: InsightsInput): InsightsResult {
  const insights: Insight[] = [];
  let seq = 0;
  const nextId = () => `insight-${++seq}`;

  if (input.healthScore) {
    for (const c of input.healthScore.components) {
      if (!c.recommendation) continue;
      // רכיב ההיגיינה תמיד מסכם בדיוק את אותם שני ממצאים (מוטבים חסרים / קרנות
      // מוקפאות) שכבר מוזרמים בנפרד ובפירוט רב יותר (שמות מוצרים) מ-scenarios.warnings
      // למטה — הכללתו כאן תיצור כפילות בפאנל התובנות. הניקוד עצמו (0–100) לא מושפע.
      if (c.key === 'hygiene') continue;
      const gapRatio = c.max > 0 ? (c.max - c.score) / c.max : 0;
      const severity: InsightSeverity =
        gapRatio > 0.5 ? 'critical' : gapRatio > 0.2 ? 'warning' : 'info';
      insights.push({
        id: nextId(),
        severity,
        category: HEALTH_KEY_CATEGORY[c.key] ?? 'hygiene',
        title: c.label,
        detail: c.recommendation,
      });
    }
  }

  if (input.scenarios) {
    for (const w of input.scenarios.warnings) {
      const isCritical = w.includes('כפל ביטוחי') || w.includes('מוטבים לא מוגדרים');
      insights.push({
        id: nextId(),
        severity: isCritical ? 'critical' : 'warning',
        category: w.includes('מוטבים לא מוגדרים') ? 'hygiene' : 'coverage',
        title: w.includes('מוטבים לא מוגדרים') ? 'מוטבים לא מוגדרים' : 'תרחישי ביטוח',
        detail: w,
      });
    }
  }

  if (input.feeComparison) {
    for (const p of input.feeComparison.products) {
      if (p.verdict !== 'expensive') continue;
      insights.push({
        id: nextId(),
        severity: p.annualExcessCost > 1000 ? 'critical' : 'warning',
        category: 'fees',
        title: `דמי ניהול גבוהים — ${p.name}`,
        detail: p.detail,
        estimatedAnnualImpact: p.annualExcessCost,
      });
    }
    for (const w of input.feeComparison.warnings) {
      insights.push({ id: nextId(), severity: 'info', category: 'fees', title: 'דמי ניהול', detail: w });
    }
  }

  if (input.taxBenefits) {
    if (input.taxBenefits.potentialExtraSaving > 0) {
      insights.push({
        id: nextId(),
        severity: 'info',
        category: 'tax',
        title: 'הטבת מס לא מנוצלת',
        detail: `נותרו עוד ${Math.round(input.taxBenefits.remainingDepositAllowance).toLocaleString('he-IL')} ₪ בתקרת ההפקדה המוטבת השנה — הפקדה נוספת תחסוך עד ${Math.round(input.taxBenefits.potentialExtraSaving).toLocaleString('he-IL')} ₪ מס.`,
        estimatedAnnualImpact: input.taxBenefits.potentialExtraSaving,
      });
    }
    for (const w of input.taxBenefits.warnings) {
      insights.push({ id: nextId(), severity: 'info', category: 'tax', title: 'הטבות מס', detail: w });
    }
  }

  insights.sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    return (b.estimatedAnnualImpact ?? 0) - (a.estimatedAnnualImpact ?? 0);
  });

  return {
    insights,
    trace: {
      formula:
        'aggregation of scenarios.warnings + healthScore.components + feeComparison.products/warnings + taxBenefits.potentialExtraSaving/warnings',
      inputs: {
        scenarios: input.scenarios ? 'included' : 'skipped',
        healthScore: input.healthScore ? 'included' : 'skipped',
        feeComparison: input.feeComparison ? 'included' : 'skipped',
        taxBenefits: input.taxBenefits ? 'included' : 'skipped',
      },
      notes: [
        'לא מבצע חישוב פיננסי חדש — מרכז ומדרג אותות שכבר חושבו ע"י מנועי scenarios/health-score/fee-comparison/tax-benefits',
        'מיון: חומרה (קריטי→אזהרה→מידע), ואז השפעה כספית שנתית משוערת (גבוה→נמוך)',
      ],
    },
  };
}
