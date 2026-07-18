import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import {
  TrainingHistory,
  TrainingScenarioView,
  TrainingService,
  TrainingSubmitResult,
  TrainingUserAnswer,
} from './training.service';

@Controller('training')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  @Post('scenario')
  generateScenario(@Req() req: AuthedRequest): Promise<TrainingScenarioView> {
    return this.training.generateScenario(req.user.sub);
  }

  @Post('submit')
  submit(
    @Req() req: AuthedRequest,
    @Body() body: { attemptId: string; userAnswer: TrainingUserAnswer },
  ): Promise<TrainingSubmitResult> {
    return this.training.submitAnswer(req.user.sub, body.attemptId, body.userAnswer);
  }

  @Get('history')
  getHistory(@Req() req: AuthedRequest): Promise<TrainingHistory> {
    return this.training.getHistory(req.user.sub);
  }
}
