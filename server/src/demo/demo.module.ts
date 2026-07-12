import { Module } from '@nestjs/common';
import { PortfolioModule } from '../portfolio/portfolio.module';
import { DemoService } from './demo.service';
import { DemoController } from './demo.controller';

@Module({
  imports: [PortfolioModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
