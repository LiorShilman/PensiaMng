import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';

@Module({
  imports: [AiModule],
  controllers: [TrainingController],
  providers: [TrainingService],
})
export class TrainingModule {}
