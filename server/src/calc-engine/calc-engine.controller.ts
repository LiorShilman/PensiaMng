import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { TRACK_DEFS } from './tracks';
import type { TrackDef } from './tracks';
import { projectBalance } from './projection';
import { annuityFromBalance } from './annuity';
import { calcPortfolio } from './portfolio';
import { calcRetirement } from './retirement';
import type { RetirementInput, RetirementResult } from './retirement';
import { calcScenarios } from './scenarios';
import type { ScenariosInput, ScenariosResult } from './scenarios';
import { calcFamilyScenarios } from './family-scenarios';
import type { FamilyScenariosInput, FamilyScenariosResult } from './family-scenarios';
import { RightsFixationService } from './rights-fixation.service';
import type {
  RightsFixationInput,
  RightsFixationResult,
} from './rights-fixation';
import { calcHealthScore } from './health-score';
import type { HealthScoreInput, HealthScoreResult } from './health-score';
import { calcTaxBenefits } from './tax-benefits';
import type { TaxBenefitsInput, TaxBenefitsResult } from './tax-benefits';
import { calcSimulatedPension } from './simulated-pension';
import type {
  SimulatedPensionInput,
  SimulatedPensionResult,
} from './simulated-pension';
import { calcJobExit } from './job-exit';
import type { JobExitInput, JobExitResult } from './job-exit';
import { calcFeeComparison } from './fee-comparison';
import type { FeeComparisonInput, FeeComparisonResult } from './fee-comparison';
import { calcDecumulation } from './decumulation';
import type { DecumulationInput, DecumulationResult } from './decumulation';
import { buildInsights } from './insights';
import type { InsightsInput, InsightsResult } from './insights';
import { calcLifePath } from './life-path';
import type { LifePathInput, LifePathResult } from './life-path';
import { calcAnnuityTrackComparison } from './annuity-track';
import type { AnnuityTrackInput, AnnuityTrackResult } from './annuity-track';
import { calcFundSwitch } from './fund-switch';
import type { FundSwitchInput, FundSwitchResult } from './fund-switch';
import { calcSection190 } from './section190';
import type { Section190Input, Section190Result } from './section190';
import { calcFundLoan } from './fund-loan';
import type { FundLoanInput, FundLoanResult } from './fund-loan';
import { calcDivorcePensionSplit } from './divorce-pension-split';
import type {
  DivorcePensionSplitInput,
  DivorcePensionSplitResult,
} from './divorce-pension-split';
import type {
  AnnuityInput,
  AnnuityResult,
  PortfolioInput,
  PortfolioResult,
  ProjectionInput,
  ProjectionResult,
} from './types';

@Controller('calc')
export class CalcEngineController {
  constructor(private readonly rightsFixation: RightsFixationService) {}

  /** מסלולי ההשקעה הסטנדרטיים + הנחות התשואה שלהם */
  @Get('tracks')
  tracks(): readonly TrackDef[] {
    return TRACK_DEFS;
  }

  /** קיבוע זכויות (סעיף 9א / טופס 161ד) — סימולציית ניצול ההון הפטור */
  @Post('rights-fixation')
  async rightsFixationCalc(
    @Body() body: RightsFixationInput,
  ): Promise<RightsFixationResult> {
    try {
      return await this.rightsFixation.calc(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post('retirement')
  retirement(@Body() body: RetirementInput): RetirementResult {
    try {
      return calcRetirement(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post('scenarios')
  scenarios(@Body() body: ScenariosInput): ScenariosResult {
    try {
      return calcScenarios(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** מסך משפחה — מבט זוגי, תרחישי שארים הדדיים (מפרט §9 פריט 5) */
  @Post('family-scenarios')
  familyScenarios(@Body() body: FamilyScenariosInput): FamilyScenariosResult {
    try {
      return calcFamilyScenarios(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post('portfolio')
  portfolio(@Body() body: PortfolioInput): PortfolioResult {
    try {
      return calcPortfolio(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post('projection')
  projection(@Body() body: ProjectionInput): ProjectionResult {
    try {
      return projectBalance(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post('annuity')
  annuity(@Body() body: AnnuityInput): AnnuityResult {
    try {
      return annuityFromBalance(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** ציון בריאות פנסיוני 0–100 (מפרט 7.1) */
  @Post('health-score')
  healthScore(@Body() body: HealthScoreInput): HealthScoreResult {
    try {
      return calcHealthScore(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** הטבות מס בהפקדה (מפרט 6.1) — כמה מס חסכת השנה */
  @Post('tax-benefits')
  taxBenefits(@Body() body: TaxBenefitsInput): TaxBenefitsResult {
    try {
      return calcTaxBenefits(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** פרישה מדומה — הפעלת קצבה מגיל 60 תוך המשך עבודה: השוואה ונקודת איזון */
  @Post('simulated-pension')
  simulatedPension(@Body() body: SimulatedPensionInput): SimulatedPensionResult {
    try {
      return calcSimulatedPension(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** עזיבת עבודה (מפרט 5.4) — משיכת פיצויים מול רצף קצבה */
  @Post('job-exit')
  jobExit(@Body() body: JobExitInput): JobExitResult {
    try {
      return calcJobExit(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** משיכה הדרגתית בפרישה — כמה זמן יחזיק ההון וכמה אפשר למשוך */
  @Post('decumulation')
  decumulation(@Body() body: DecumulationInput): DecumulationResult {
    try {
      return calcDecumulation(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** השוואת דמי ניהול לממוצעי השוק (מפרט 7.2) — "מחיר הפער" */
  @Post('fee-comparison')
  feeComparison(@Body() body: FeeComparisonInput): FeeComparisonResult {
    try {
      return calcFeeComparison(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** מנוע תובנות (מפרט 7.3) — מרכז ומדרג אותות שכבר חושבו, לא מחשב מחדש */
  @Post('insights')
  insights(@Body() body: InsightsInput): InsightsResult {
    try {
      return buildInsights(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** סימולטור מסלול חיים — הקרנת התיק האמיתי דרך רצף אירועי חיים שנבחרו */
  @Post('life-path')
  lifePath(@Body() body: LifePathInput): LifePathResult {
    try {
      return calcLifePath(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** בחירת מסלול קצבה (מפרט 4.3 + 5.2) — השוואת מסלולים ונקודת איזון */
  @Post('annuity-track')
  annuityTrack(@Body() body: AnnuityTrackInput): AnnuityTrackResult {
    try {
      return calcAnnuityTrackComparison(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** "כדאי לעבור קרן?" — השוואת המשך במוצר הנוכחי מול מעבר למוצר מועמד */
  @Post('fund-switch')
  fundSwitch(@Body() body: FundSwitchInput): FundSwitchResult {
    try {
      return calcFundSwitch(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** תיקון 190 — משיכה הונית (15% על הרווח) מול קצבה מוכרת (פטורה ממס) */
  @Post('section190')
  section190(@Body() body: Section190Input): Section190Result {
    try {
      return calcSection190(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** הלוואה מקרן הפנסיה מול הלוואה חלופית */
  @Post('fund-loan')
  fundLoan(@Body() body: FundLoanInput): FundLoanResult {
    try {
      return calcFundLoan(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  /** חלוקת זכויות פנסיה בגירושין — נוסחת יחס הזמנים על היתרה למועד הקרע */
  @Post('divorce-pension-split')
  divorcePensionSplit(
    @Body() body: DivorcePensionSplitInput,
  ): DivorcePensionSplitResult {
    try {
      return calcDivorcePensionSplit(body);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }
}
