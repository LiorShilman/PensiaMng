import { Module } from '@nestjs/common';
import { CalcEngineController } from './calc-engine.controller';

@Module({
  controllers: [CalcEngineController],
})
export class CalcEngineModule {}
