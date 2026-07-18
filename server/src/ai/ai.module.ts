import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiToolsService } from './ai-tools.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { RightsFixationService } from '../calc-engine/rights-fixation.service';

@Module({
  controllers: [AiController],
  providers: [AiService, AiToolsService, PortfolioService, RightsFixationService],
  exports: [AiService],
})
export class AiModule {}
