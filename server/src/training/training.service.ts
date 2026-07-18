import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, FundLoanScenario } from '../ai/ai.service';
import { calcFundLoan, FundLoanInput, FundLoanResult } from '../calc-engine/fund-loan';

export interface TrainingScenarioView {
  attemptId: string;
  scenario: FundLoanScenario;
}

export type GapRange = 'UNDER_5K' | 'K5_15K' | 'K15_30K' | 'OVER_30K';

export interface TrainingUserAnswer {
  choice: 'FUND' | 'ALTERNATIVE';
  /** הערכת סדר הגודל של פער העלות הכולל — טווח, לא מספר מדויק */
  gapRange: GapRange;
}

/** גבולות הטווחים (₪) — בסדר עולה, תואם ל-GAP_RANGES בלקוח */
const GAP_RANGE_ORDER: GapRange[] = ['UNDER_5K', 'K5_15K', 'K15_30K', 'OVER_30K'];

function gapRangeOf(absGap: number): GapRange {
  if (absGap < 5_000) return 'UNDER_5K';
  if (absGap < 15_000) return 'K5_15K';
  if (absGap < 30_000) return 'K15_30K';
  return 'OVER_30K';
}

export interface TrainingSubmitResult {
  engineAnswer: FundLoanResult;
  score: number;
  verdict: string;
}

export interface TrainingHistoryEntry {
  id: string;
  topic: string;
  score: number | null;
  verdict: string | null;
  createdAt: string;
}

export interface TrainingHistory {
  count: number;
  averageScore: number | null;
  recent: TrainingHistoryEntry[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * מצב אימון (Training Scenario) — דילמת לקוח בדויה שה-AI מנסח, מול
 * התשובה הנכונה שמנוע החישוב הדטרמיניסטי מחשב. ה-AI לעולם לא קובע
 * מי צדק — ראה generateFundLoanScenario ב-AiService.
 */
@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async generateScenario(userId: string): Promise<TrainingScenarioView> {
    const scenario = await this.ai.generateFundLoanScenario(userId);
    const attempt = await this.prisma.trainingAttempt.create({
      data: {
        userId,
        topic: 'FUND_LOAN',
        scenario: scenario as unknown as object,
      },
    });
    return { attemptId: attempt.id, scenario };
  }

  async submitAnswer(
    userId: string,
    attemptId: string,
    userAnswer: TrainingUserAnswer,
  ): Promise<TrainingSubmitResult> {
    const attempt = await this.prisma.trainingAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('התרחיש לא נמצא');
    if (attempt.userId !== userId) throw new ForbiddenException('התרחיש שייך למשתמש אחר');
    if (attempt.answeredAt) throw new BadRequestException('התרחיש הזה כבר נענה');
    if (!userAnswer || (userAnswer.choice !== 'FUND' && userAnswer.choice !== 'ALTERNATIVE')) {
      throw new BadRequestException('יש לבחור איזו הלוואה עדיפה');
    }
    if (!GAP_RANGE_ORDER.includes(userAnswer.gapRange)) {
      throw new BadRequestException('יש לבחור טווח פער');
    }

    const scenario = attempt.scenario as unknown as FundLoanScenario;
    const input: FundLoanInput = {
      loanAmount: scenario.loanAmount,
      months: scenario.months,
      fundLoanAnnualRatePct: scenario.fundLoanAnnualRatePct,
      alternativeAnnualRatePct: scenario.alternativeAnnualRatePct,
      collateralFrozen: scenario.collateralFrozen,
      annualReturnPct: scenario.annualReturnPct,
    };
    const engineAnswer = calcFundLoan(input);

    const correctChoice: 'FUND' | 'ALTERNATIVE' = engineAnswer.totalCostGap <= 0 ? 'FUND' : 'ALTERNATIVE';
    const directionCorrect = userAnswer.choice === correctChoice;
    // ניקוד: 60 נק' על הכיוון (החלק החשוב), 40 נק' על טווח הפער —
    // מלא לטווח מדויק, חצי לטווח שכן (אומדן בעל-פה הוא מיומנות, לא ניחוש מדויק)
    let score = 0;
    let verdict = 'לא נכון';
    if (directionCorrect) {
      const actualRange = gapRangeOf(Math.abs(engineAnswer.totalCostGap));
      const rangeDist = Math.abs(
        GAP_RANGE_ORDER.indexOf(actualRange) - GAP_RANGE_ORDER.indexOf(userAnswer.gapRange),
      );
      score = 60 + (rangeDist === 0 ? 40 : rangeDist === 1 ? 20 : 0);
      verdict = score === 100 ? 'מצוין' : score === 80 ? 'טוב מאוד' : 'כיוון נכון, הטווח היה רחוק';
    }

    await this.prisma.trainingAttempt.update({
      where: { id: attemptId },
      data: {
        userAnswer: userAnswer as unknown as object,
        engineAnswer: engineAnswer as unknown as object,
        score: round2(score),
        verdict,
        answeredAt: new Date(),
      },
    });

    return { engineAnswer, score, verdict };
  }

  async getHistory(userId: string): Promise<TrainingHistory> {
    const [answered, recent] = await Promise.all([
      this.prisma.trainingAttempt.findMany({
        where: { userId, answeredAt: { not: null } },
        select: { score: true },
      }),
      this.prisma.trainingAttempt.findMany({
        where: { userId, answeredAt: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
    const scores = answered.map((a) => Number(a.score ?? 0));
    const averageScore = scores.length > 0 ? round2(scores.reduce((s, x) => s + x, 0) / scores.length) : null;
    return {
      count: answered.length,
      averageScore,
      recent: recent.map((a) => ({
        id: a.id,
        topic: a.topic,
        score: a.score != null ? Number(a.score) : null,
        verdict: a.verdict,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }
}
