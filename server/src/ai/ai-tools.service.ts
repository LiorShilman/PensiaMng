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
import { calcJobExit } from '../calc-engine/job-exit';
import type { JobExitInput } from '../calc-engine/job-exit';
import { calcFeeComparison } from '../calc-engine/fee-comparison';
import { calcDecumulation } from '../calc-engine/decumulation';
import type { DecumulationInput } from '../calc-engine/decumulation';
import { RightsFixationService } from '../calc-engine/rights-fixation.service';
import type { RightsFixationInput } from '../calc-engine/rights-fixation';
import { calcAnnuityTrackComparison } from '../calc-engine/annuity-track';
import type { AnnuityTrackInput } from '../calc-engine/annuity-track';
import { calcFundSwitch } from '../calc-engine/fund-switch';
import type { FundSwitchInput } from '../calc-engine/fund-switch';
import { calcSection190 } from '../calc-engine/section190';
import type { Section190Input } from '../calc-engine/section190';
import { calcFundLoan } from '../calc-engine/fund-loan';
import type { FundLoanInput } from '../calc-engine/fund-loan';
import { calcDivorcePensionSplit } from '../calc-engine/divorce-pension-split';
import type { DivorcePensionSplitInput } from '../calc-engine/divorce-pension-split';
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
const INSURANCE_ONLY: ReadonlySet<ProductType> = new Set([
  'DISABILITY_INSURANCE',
  'LIFE_INSURANCE',
]);

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
        name: 'calc_job_exit',
        description:
          'עזיבת עבודה: משיכת רכיב הפיצויים היום (פטור עד תקרה, מס שולי על היתרה, פגיעה עתידית בקיבוע ×1.35) מול השארתו ברצף קצבה (תוספת קצבה בפרישה).',
        schema: {
          type: 'object',
          properties: {
            severanceBalance: { type: 'number', description: 'יתרת רכיב הפיצויים (₪)' },
            yearsOfService: { type: 'number' },
            lastMonthlySalary: { type: 'number' },
            yearsToRetirement: { type: 'number' },
            annualReturnPct: { type: 'number' },
            conversionFactor: { type: 'number' },
            marginalTaxRatePct: { type: 'number' },
          },
          required: [
            'severanceBalance',
            'yearsOfService',
            'lastMonthlySalary',
            'yearsToRetirement',
            'annualReturnPct',
            'conversionFactor',
            'marginalTaxRatePct',
          ],
          additionalProperties: false,
        },
      },
      {
        name: 'calc_decumulation',
        description:
          'משיכה הדרגתית בפרישה: בהינתן ההון הנזיל, גיל הפרישה ותשואה שמרנית — המשיכה החודשית בת-הקיימא עד גיל היעד, וגיל אזילת ההון במשיכה מבוקשת.',
        schema: {
          type: 'object',
          properties: {
            capitalAtRetirement: { type: 'number', description: 'ההון הנזיל בפרישה (₪)' },
            retirementAge: { type: 'number' },
            annualReturnPct: { type: 'number', description: 'תשואה ריאלית בפרישה (מומלץ 1.5–3)' },
            monthlyWithdrawal: { type: 'number', description: 'משיכה מבוקשת (₪ לחודש)' },
            targetAge: { type: 'number', description: 'גיל היעד (ברירת מחדל 90)' },
          },
          required: ['capitalAtRetirement', 'retirementAge', 'annualReturnPct'],
          additionalProperties: false,
        },
      },
      {
        name: 'compare_fees_to_market',
        description:
          'השוואת דמי הניהול של כל מוצרי התיק השמור לממוצעי השוק: עלות שנתית עודפת ו"מחיר הפער" בצבירה עד הפרישה.',
        schema: { type: 'object', properties: {}, additionalProperties: false },
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
      {
        name: 'calc_annuity_track',
        description:
          'השוואת מסלולי קצבה לקראת פרישה: לכל מסלול יש מקדם המרה, % קצבת שאיר וחודשי הבטחת תשלומים משלו (מהטבלה שהקרן שולחת). מחשב קצבה חודשית לכל מסלול ומוצא "נקודת איזון" — מגיל כמה מסלול נדיב יותר לשאירים משתלם בסך הכול לעומת המסלול הראשון ברשימה (הבסיס). אינו כולל מסלול "קצבה מוכרת" (תיקון 190). השתמש ב-calc_projection כדי להעריך את הצבירה הצפויה בפרישה לפני הקריאה.',
        schema: {
          type: 'object',
          properties: {
            balanceAtRetirement: { type: 'number', description: 'צבירה צפויה בפרישה (₪)' },
            options: {
              type: 'array',
              description: 'לפחות מסלול אחד; הראשון ברשימה משמש כבסיס להשוואת נקודת האיזון',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  label: { type: 'string' },
                  conversionFactor: { type: 'number' },
                  survivorPct: { type: 'number', description: '% קצבת שאיר, 0–100' },
                  guaranteedMonths: {
                    type: 'number',
                    description: 'חודשי הבטחת תשלומים (0/60/120/180/240)',
                  },
                },
                required: ['id', 'label', 'conversionFactor', 'survivorPct', 'guaranteedMonths'],
              },
            },
            hasSpouse: { type: 'boolean' },
            retirementAge: { type: 'number' },
            retireeLifeExpectancyAge: {
              type: 'number',
              description: 'גיל תוחלת חיים משוער של הגמלאי (הנחה, למשל 85)',
            },
            spouseAgeAtRetirement: { type: 'number', description: 'נדרש כש-hasSpouse=true' },
            spouseLifeExpectancyAge: {
              type: 'number',
              description: 'הנחה, למשל 90 — נדרש כש-hasSpouse=true',
            },
          },
          required: [
            'balanceAtRetirement',
            'options',
            'hasSpouse',
            'retirementAge',
            'retireeLifeExpectancyAge',
          ],
          additionalProperties: false,
        },
      },
      {
        name: 'calc_fund_switch',
        description:
          '"כדאי לעבור קרן?" — משווה המשך במוצר הנוכחי מול מעבר למוצר מועמד: הפרש צבירה בפרישה (רק דמי הניהול שונים, שאר ההנחות זהות) ואם נמסרו מקדמי המרה — גם הפרש קצבה חודשית. כולל אזהרות על מקדם מובטח שהולך לאיבוד ואיפוס תקופת אכשרה. השתמש ב-get_portfolio_summary ו-calc_projection כדי להעריך את הפרמטרים של המוצר הנוכחי לפני הקריאה.',
        schema: {
          type: 'object',
          properties: {
            currentBalance: { type: 'number', description: 'יתרה נוכחית (₪)' },
            monthlyDeposit: { type: 'number' },
            monthlyCoverageCost: { type: 'number', description: 'עלות כיסויים חודשית (₪), אם קיימת' },
            annualReturnPct: { type: 'number' },
            annualSalaryGrowthPct: { type: 'number' },
            months: { type: 'number', description: 'חודשים עד הפרישה' },
            current: {
              type: 'object',
              properties: {
                feeFromDepositPct: { type: 'number' },
                feeFromBalancePct: { type: 'number' },
                conversionFactor: { type: 'number' },
              },
              required: ['feeFromDepositPct', 'feeFromBalancePct'],
            },
            candidateName: { type: 'string' },
            candidate: {
              type: 'object',
              properties: {
                feeFromDepositPct: { type: 'number' },
                feeFromBalancePct: { type: 'number' },
                conversionFactor: { type: 'number' },
              },
              required: ['feeFromDepositPct', 'feeFromBalancePct'],
            },
            currentHasGuaranteedFactor: { type: 'boolean' },
            resetsQualifyingPeriod: { type: 'boolean' },
          },
          required: [
            'currentBalance',
            'monthlyDeposit',
            'monthlyCoverageCost',
            'annualReturnPct',
            'annualSalaryGrowthPct',
            'months',
            'current',
            'candidateName',
            'candidate',
          ],
          additionalProperties: false,
        },
      },
      {
        name: 'calc_section190',
        description:
          'תיקון 190 (מודל מפושט להשוואה, לא בדיקת זכאות): משיכה הונית (מס 15% על הרווח הריאלי בלבד) מול "קצבה מוכרת" (קצבה חודשית פטורה ממס לחלוטין).',
        schema: {
          type: 'object',
          properties: {
            balance: { type: 'number', description: 'צבירה במסלול תיקון 190 (₪)' },
            realGainPct: { type: 'number', description: '% מהצבירה שהוא רווח ריאלי, 0–100' },
            conversionFactor: { type: 'number', description: 'מקדם המרה לקצבה מוכרת' },
            currentAge: { type: 'number' },
            lifeExpectancyAge: { type: 'number' },
            annualReturnPct: { type: 'number', description: 'תשואה ריאלית להשקעת הנטו אם נמשך הונית' },
          },
          required: [
            'balance',
            'realGainPct',
            'conversionFactor',
            'currentAge',
            'lifeExpectancyAge',
            'annualReturnPct',
          ],
          additionalProperties: false,
        },
      },
      {
        name: 'calc_fund_loan',
        description:
          'הלוואה מקרן הפנסיה מול הלוואה חלופית: משווה עלות ריבית כוללת, ואם הסכום המשועבד מפסיק לצבור תשואה בזמן ההלוואה — גם את עלות ההזדמנות הזו.',
        schema: {
          type: 'object',
          properties: {
            loanAmount: { type: 'number' },
            months: { type: 'number' },
            fundLoanAnnualRatePct: { type: 'number' },
            alternativeAnnualRatePct: { type: 'number' },
            collateralFrozen: {
              type: 'boolean',
              description: 'האם הסכום המשועבד מפסיק לצבור תשואה בזמן ההלוואה',
            },
            annualReturnPct: { type: 'number', description: 'תשואה ריאלית מונחת, לחישוב עלות הזדמנות' },
          },
          required: [
            'loanAmount',
            'months',
            'fundLoanAnnualRatePct',
            'alternativeAnnualRatePct',
            'collateralFrozen',
            'annualReturnPct',
          ],
          additionalProperties: false,
        },
      },
      {
        name: 'calc_divorce_pension_split',
        description:
          'חלוקת זכויות פנסיה בגירושין (חוק חלוקת חיסכון פנסיוני בין בני זוג שנפרדו, תשע"ד-2014) — נוסחת "יחס הזמנים": החלק היחסי של תקופת הנישואין (מהמאוחר בין הנישואין/ההצטרפות לקרן ועד מועד הקרע) מתוך כלל תקופת הצבירה (מההצטרפות ועד הפרישה), מוכפל באחוז שהוסכם (עד 50% לרוב), ומיושם על היתרה נכון למועד הקרע — לא היתרה הנוכחית. מוגבל לפנסיה צוברת (יתרה כספית); פנסיה תקציבית אינה נתמכת. כלי המחשה בלבד — לא ייעוץ משפטי.',
        schema: {
          type: 'object',
          properties: {
            marriageDate: { type: 'string', description: 'תאריך נישואין, ISO yyyy-mm-dd' },
            breakDate: {
              type: 'string',
              description: 'מועד הקרע — סיום השיתוף הכלכלי, ISO yyyy-mm-dd',
            },
            retirementDate: {
              type: 'string',
              description: 'תאריך פרישה בפועל/מתוכנן, ISO yyyy-mm-dd',
            },
            awardedPct: {
              type: 'number',
              description: 'אחוז מהחלק היחסי שהוסכם/נפסק לבן/בת הזוג (ברירת מחדל 50)',
            },
            products: {
              type: 'array',
              description: 'מוצרי פנסיה צוברת שנכנסים לחלוקה',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  joinDate: { type: 'string', description: 'תאריך הצטרפות לקרן, ISO yyyy-mm-dd' },
                  balanceAtBreakDate: {
                    type: 'number',
                    description: 'יתרה נכון למועד הקרע (₪) — מאישור רשמי, לא מחושבת',
                  },
                },
                required: ['id', 'name', 'joinDate', 'balanceAtBreakDate'],
              },
            },
          },
          required: ['marriageDate', 'breakDate', 'retirementDate', 'awardedPct', 'products'],
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
      case 'calc_job_exit':
        return calcJobExit(a as unknown as JobExitInput);
      case 'compare_fees_to_market':
        return this.feeComparison(userId);
      case 'calc_decumulation':
        return calcDecumulation(a as unknown as DecumulationInput);
      case 'calc_tax_benefits':
        return calcTaxBenefits(a as unknown as TaxBenefitsInput);
      case 'calc_annuity_track':
        return calcAnnuityTrackComparison(a as unknown as AnnuityTrackInput);
      case 'calc_fund_switch':
        return calcFundSwitch(a as unknown as FundSwitchInput);
      case 'calc_section190':
        return calcSection190(a as unknown as Section190Input);
      case 'calc_fund_loan':
        return calcFundLoan(a as unknown as FundLoanInput);
      case 'calc_divorce_pension_split':
        return calcDivorcePensionSplit(a as unknown as DivorcePensionSplitInput);
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

  private async feeComparison(userId: string) {
    const { client, saved, assumptions } = await this.loadAll(userId);
    const retirement = calcRetirement({
      gender: client.gender as Gender,
      birthDate: client.birthDate.toISOString().slice(0, 10),
    });
    return calcFeeComparison({
      months: Math.max(12, retirement.monthsToRetirement),
      annualReturnPct: assumptions.annualReturnPct,
      annualSalaryGrowthPct: assumptions.annualSalaryGrowthPct,
      products: saved.products.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        currentBalance: p.currentBalance,
        monthlyDeposit: p.frozen ? 0 : p.monthlyDeposit,
        feeFromDepositPct: p.feeFromDepositPct,
        feeFromBalancePct: p.feeFromBalancePct,
      })),
    });
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
        כיסוי_שאירים_אחוז: p.survivorsPct ?? null,
        ויתור_על_כיסוי_שאירים: p.survivorsWaiver ?? false,
        תאריך_חתימת_הוויתור: p.survivorsWaiverDate ?? null,
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
        survivorsWaiverDate: p.survivorsWaiverDate,
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
