import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import type { SavedProduct } from '../portfolio/portfolio.service';
import { calcPortfolio } from '../calc-engine/portfolio';
import { calcRetirement } from '../calc-engine/retirement';
import type { Gender } from '../calc-engine/retirement';
import { calcScenarios } from '../calc-engine/scenarios';
import { calcTaxBenefits } from '../calc-engine/tax-benefits';
import type { TaxBenefitsInput } from '../calc-engine/tax-benefits';
import { calcSimulatedPension } from '../calc-engine/simulated-pension';
import type { SimulatedPensionInput } from '../calc-engine/simulated-pension';
import { RightsFixationService } from '../calc-engine/rights-fixation.service';
import type { RightsFixationInput } from '../calc-engine/rights-fixation';
import type { ProductType } from '../calc-engine/types';

/**
 * כלי ה-AI (Tool Use, מפרט 10א) — המודל קורא לפונקציות המערכת ולעולם
 * לא מחשב מספרים בעצמו. כל כלי פועל על התיק ה-שמור של המשתמש
 * (ללא פרטים מזהים: שם, ת"ז, אימייל אינם נחשפים למודל).
 */

export interface AiToolDef {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

/** מוצרי ביטוח טהורים — לא נכללים בתחזית הצבירה */
const INSURANCE_ONLY: ReadonlySet<ProductType> = new Set(['DISABILITY_INSURANCE']);

const AGE_MS = 365.25 * 24 * 3600 * 1000;

@Injectable()
export class AiToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portfolio: PortfolioService,
    private readonly rightsFixation: RightsFixationService,
  ) {}

  defs(): AiToolDef[] {
    return [
      {
        name: 'get_portfolio_summary',
        description:
          'תמונת המצב השמורה של התיק: פרופיל (גיל, מין, מצב משפחתי, שכר, גילאי ילדים), כל המוצרים (סוג, יתרה, הפקדה, דמי ניהול, כיסויים, מסלולים) והנחות התכנון. קרא לזה קודם כשחסר לך מידע על התיק.',
        schema: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'calc_projection',
        description:
          'תחזית צבירה וקצבה לפרישה על התיק השמור, בשלושה תרחישים (פסימי/מרכזי/אופטימי), כולל קצבת אזרח ותיק ושיעור תחלופה. אפשר לעקוף גיל פרישה ("מה אם אפרוש ב-62") או הנחת תשואה.',
        schema: {
          type: 'object',
          properties: {
            retirementAge: {
              type: 'number',
              description: 'גיל פרישה מבוקש (60–75); ריק = הגיל החוקי',
            },
            annualReturnPct: {
              type: 'number',
              description: 'עקיפת הנחת התשואה הריאלית השנתית (%)',
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: 'calc_insurance_scenarios',
        description:
          'תרחישי מוות ואובדן כושר עבודה על התיק השמור להיום: קצבאות שאירים/נכות מהקרנות + ביטוח לאומי, יעד למשפחה, פערים ואזהרות.',
        schema: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'calc_rights_fixation',
        description:
          'סימולציית קיבוע זכויות (סעיף 9א/161ד): הון פטור, קיזוז מענקי עבר, ותרחישי ניצול (פטור על הקצבה / היוון / שילוב).',
        schema: {
          type: 'object',
          properties: {
            eligibilityYear: { type: 'number', description: 'שנת גיל הזכאות' },
            expectedMonthlyPension: {
              type: 'number',
              description: 'קצבה חודשית צפויה (ברוטו, ₪)',
            },
            pastGrants: {
              type: 'array',
              description: 'מענקי פיצויים פטורים שנמשכו בעבר',
              items: {
                type: 'object',
                properties: {
                  year: { type: 'number' },
                  amount: { type: 'number' },
                },
                required: ['year', 'amount'],
              },
            },
            desiredLumpSum: { type: 'number', description: 'היוון מבוקש (₪)' },
            marginalTaxRatePct: { type: 'number' },
          },
          required: ['eligibilityYear', 'expectedMonthlyPension'],
          additionalProperties: false,
        },
      },
      {
        name: 'calc_simulated_pension',
        description:
          'פרישה מדומה: הפעלת קצבה מגיל 60 תוך המשך עבודה. משווה קצבה מוקדמת (מס שולי, מקדם גבוה) מול המתנה לגיל החוקי, כולל נקודת איזון. השתמש ב-get_portfolio_summary כדי להעריך צבירה וגילאים לפני הקריאה.',
        schema: {
          type: 'object',
          properties: {
            currentAge: { type: 'number' },
            startAge: { type: 'number', description: 'גיל ההפעלה (מ-60)' },
            legalRetirementAge: { type: 'number' },
            balanceNow: { type: 'number', description: 'הצבירה היום במוצרים שיופעלו (₪)' },
            monthlyDeposit: { type: 'number' },
            annualReturnPct: { type: 'number' },
            conversionFactorAtStart: { type: 'number', description: 'מקדם בגיל ההפעלה (למשל 200)' },
            conversionFactorAtLegal: { type: 'number', description: 'מקדם בגיל החוקי (למשל 185)' },
            marginalTaxRatePct: { type: 'number' },
          },
          required: [
            'currentAge',
            'startAge',
            'legalRetirementAge',
            'balanceNow',
            'monthlyDeposit',
            'annualReturnPct',
            'conversionFactorAtStart',
            'conversionFactorAtLegal',
            'marginalTaxRatePct',
          ],
          additionalProperties: false,
        },
      },
      {
        name: 'calc_tax_benefits',
        description:
          'הטבות מס בהפקדה (סעיף 45א): כמה מס נחסך השנה וכמה תקרה נותרה לניצול. שכיר: זיכוי 35% עד 7% מההכנסה המזכה; עצמאי: זיכוי + ניכוי.',
        schema: {
          type: 'object',
          properties: {
            employmentStatus: { type: 'string', enum: ['EMPLOYEE', 'SELF_EMPLOYED'] },
            monthlyIncome: { type: 'number', description: 'שכר/הכנסה חודשית (₪)' },
            annualOwnDeposits: {
              type: 'number',
              description: 'הפקדות שנתיות של החוסך עצמו (₪)',
            },
            marginalTaxRatePct: { type: 'number' },
          },
          required: ['employmentStatus', 'monthlyIncome', 'annualOwnDeposits'],
          additionalProperties: false,
        },
      },
    ];
  }

  async execute(userId: string, name: string, args: unknown): Promise<unknown> {
    const a = (args ?? {}) as Record<string, unknown>;
    switch (name) {
      case 'get_portfolio_summary':
        return this.portfolioSummary(userId);
      case 'calc_projection':
        return this.projection(
          userId,
          a.retirementAge as number | undefined,
          a.annualReturnPct as number | undefined,
        );
      case 'calc_insurance_scenarios':
        return this.insuranceScenarios(userId);
      case 'calc_rights_fixation':
        return this.rightsFixation.calc(a as unknown as RightsFixationInput);
      case 'calc_simulated_pension':
        return calcSimulatedPension(a as unknown as SimulatedPensionInput);
      case 'calc_tax_benefits':
        return calcTaxBenefits(a as unknown as TaxBenefitsInput);
      default:
        throw new Error(`כלי לא מוכר: ${name}`);
    }
  }

  // ---------- טעינת התיק (ללא PII) ----------

  private async clientRecord(userId: string) {
    const client = await this.prisma.client.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { children: true },
    });
    if (!client) throw new NotFoundException('לא נמצא תיק למשתמש');
    return client;
  }

  private async loadAll(userId: string) {
    const [client, saved] = await Promise.all([
      this.clientRecord(userId),
      this.portfolio.load(userId),
    ]);
    const assumptions = saved.assumptions ?? {
      annualReturnPct: 3.74,
      annualSalaryGrowthPct: 1.5,
    };
    return { client, saved, assumptions };
  }

  private async portfolioSummary(userId: string) {
    const { client, saved, assumptions } = await this.loadAll(userId);
    const now = Date.now();
    return {
      פרופיל: {
        גיל: Math.floor((now - client.birthDate.getTime()) / AGE_MS),
        מין: client.gender === 'MALE' ? 'זכר' : 'נקבה',
        מצב_משפחתי: client.maritalStatus,
        שכר_חודשי_מבוטח: client.insuredSalary ? Number(client.insuredSalary) : null,
        גילאי_ילדים: client.children.map((c) =>
          Math.floor((now - c.birthDate.getTime()) / AGE_MS),
        ),
      },
      הנחות: assumptions,
      מוצרים: saved.products.map((p) => ({
        שם: p.name,
        סוג: p.type,
        יתרה: p.currentBalance,
        הפקדה_חודשית: p.monthlyDeposit,
        דמי_ניהול_מהפקדה: p.feeFromDepositPct,
        דמי_ניהול_מצבירה: p.feeFromBalancePct,
        לא_פעילה: p.frozen ?? false,
        שכר_מבוטח: p.insuredMonthlySalary ?? null,
        כיסוי_נכות_אחוז: p.disabilityPct ?? null,
        מטריה_ביטוחית: p.umbrella ?? false,
        מסלולים: p.tracks ?? [],
        מוטבים_מוגדרים: (p.beneficiaries ?? []).length > 0,
      })),
    };
  }

  private async projection(
    userId: string,
    retirementAge?: number,
    annualReturnPct?: number,
  ) {
    const { client, saved, assumptions } = await this.loadAll(userId);
    const retirement = calcRetirement({
      gender: client.gender as Gender,
      birthDate: client.birthDate.toISOString().slice(0, 10),
      plannedRetirementAge: retirementAge,
    });
    if (retirement.monthsToRetirement <= 0) {
      return { שגיאה: 'לפי תאריך הלידה כבר בגיל פרישה — אין תקופת צבירה' };
    }
    const insuranceYears = Math.min(
      50,
      Math.max(0, Math.round(retirement.effectiveRetirementAgeMonths / 12 - 22)),
    );
    const result = calcPortfolio({
      months: retirement.monthsToRetirement,
      annualReturnPct: annualReturnPct ?? assumptions.annualReturnPct,
      annualSalaryGrowthPct: assumptions.annualSalaryGrowthPct,
      insuredMonthlySalary: client.insuredSalary
        ? Number(client.insuredSalary)
        : undefined,
      nationalInsurance: {
        include: true,
        insuranceYears,
        spouseSupplementEligible:
          client.maritalStatus === 'MARRIED' || client.maritalStatus === 'COMMON_LAW',
      },
      products: saved.products
        .filter((p) => !INSURANCE_ONLY.has(p.type))
        .map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          currentBalance: p.currentBalance,
          monthlyDeposit: p.frozen ? 0 : p.monthlyDeposit,
          feeFromDepositPct: p.feeFromDepositPct,
          feeFromBalancePct: p.feeFromBalancePct,
          monthlyCoverageCost: p.monthlyCoverageCost,
          conversionFactor: p.conversionFactor,
          trackAllocations: p.tracks,
        })),
    });
    const compact = (t: (typeof result.totals)['central']) => ({
      סך_צבירה: t.totalBalance,
      קצבה_חודשית_מהקרנות: t.totalMonthlyAnnuity,
      קצבת_אזרח_ותיק: t.niOldAgeMonthly,
      הון_נזיל: t.totalLumpSum,
      סך_דמי_ניהול: t.totalFeesPaid,
      שיעור_תחלופה_אחוז: t.replacementRatePct,
    });
    return {
      גיל_פרישה: retirement.effectiveRetirementAgeMonths / 12,
      שנים_עד_פרישה: Math.round((retirement.monthsToRetirement / 12) * 10) / 10,
      פסימי: compact(result.totals.pessimistic),
      מרכזי: compact(result.totals.central),
      אופטימי: compact(result.totals.optimistic),
    };
  }

  private async insuranceScenarios(userId: string) {
    const { client, saved } = await this.loadAll(userId);
    const hasSpouse =
      client.maritalStatus === 'MARRIED' || client.maritalStatus === 'COMMON_LAW';
    const result = calcScenarios({
      family: {
        hasSpouse,
        childrenBirthDates: client.children.map((c) =>
          c.birthDate.toISOString().slice(0, 10),
        ),
      },
      insuredMonthlySalary: client.insuredSalary ? Number(client.insuredSalary) : 0,
      nationalInsurance: { include: true },
      products: saved.products.map((p: SavedProduct) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        currentBalance: p.currentBalance,
        insuredMonthlySalary: p.insuredMonthlySalary,
        frozen: p.frozen,
        survivorsPct: p.survivorsPct,
        disabilityPct: p.disabilityPct,
        survivorsWaiver: p.survivorsWaiver,
        deathBenefitAmount: p.deathBenefitAmount,
        beneficiaries: p.beneficiaries,
        umbrella: p.umbrella,
      })),
    });
    return {
      מוות: {
        קצבת_שאירים_מהקרנות: result.death.totalSurvivorMonthly,
        קצבת_שאירים_ביטוח_לאומי: result.death.niSurvivorsMonthly,
        סכומים_חד_פעמיים: result.death.totalLumpSum,
        יעד_חודשי: result.death.targetMonthly,
        פער: result.death.gapMonthly,
        פירוט: result.death.products.map((p) => ({
          מוצר: p.name,
          קצבה: p.survivorMonthly,
          חד_פעמי: p.lumpSum,
          הסבר: p.detail,
        })),
      },
      נכות: {
        קצבה_מהקרנות: result.disability.totalDisabilityMonthly,
        קצבת_ביטוח_לאומי: result.disability.niDisabilityMonthly,
        קיזוז_בקרן: result.disability.niOffsetReduction,
        כיסוי_עודף: result.disability.excessMonthly,
        יעד_חודשי: result.disability.targetMonthly,
        פער: result.disability.gapMonthly,
      },
      אזהרות: result.warnings,
    };
  }
}
