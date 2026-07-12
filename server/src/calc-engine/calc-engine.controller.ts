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
}
