import { Module } from '@nestjs/common';
import { BoiRateController } from './boi-rate.controller';
import { BoiRateService } from './boi-rate.service';

@Module({
  controllers: [BoiRateController],
  providers: [BoiRateService],
})
export class ExternalRatesModule {}
