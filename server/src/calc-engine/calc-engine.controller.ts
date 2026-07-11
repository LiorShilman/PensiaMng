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
  /** מסלולי ההשקעה הסטנדרטיים + הנחות התשואה שלהם */
  @Get('tracks')
  tracks(): readonly TrackDef[] {
    return TRACK_DEFS;
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
}
