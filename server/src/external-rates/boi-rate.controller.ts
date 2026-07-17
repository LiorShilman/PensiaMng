import { Controller, Get } from '@nestjs/common';
import { BoiRateService, BoiInterestRate } from './boi-rate.service';

@Controller('external')
export class BoiRateController {
  constructor(private readonly boiRate: BoiRateService) {}

  /** ריבית בנק ישראל הנוכחית — ציבורי, בלי נתון אישי, בלי אימות */
  @Get('boi-interest-rate')
  boiInterestRate(): Promise<BoiInterestRate> {
    return this.boiRate.getBoiInterestRate();
  }
}
