import { Module } from '@nestjs/common';
import { CalcEngineController } from './calc-engine.controller';
import { RightsFixationService } from './rights-fixation.service';

@Module({
  controllers: [CalcEngineController],
  providers: [RightsFixationService],
})
export class CalcEngineModule {}
