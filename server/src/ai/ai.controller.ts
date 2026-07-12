import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { AiService } from './ai.service';
import type {
  AiModelInfo,
  AiProvider,
  AiSettingsView,
  AiUsageView,
  AnalyzeResult,
  ChatMessage,
  ChatResult,
  ExtractReportResult,
  LastAnalysis,
} from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly audit: AuditService,
  ) {}

  @Get('settings')
  getSettings(@Req() req: AuthedRequest): Promise<AiSettingsView | null> {
    return this.ai.getSettings(req.user.sub);
  }

  @Put('settings')
  async saveSettings(
    @Req() req: AuthedRequest,
    @Body()
    dto: {
      provider: AiProvider;
      apiKey?: string;
      model?: string;
      monthlyBudgetUsd?: number | null;
    },
  ): Promise<AiSettingsView> {
    const saved = await this.ai.saveSettings(req.user.sub, dto);
    await this.audit.log({
      userId: req.user.sub,
      action: 'AI_SETTINGS_SAVED',
      detail: `${dto.provider}/${dto.model ?? saved.model}${dto.apiKey ? ' + מפתח עודכן' : ''}`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return saved;
  }

  /** ניצול החודש + התקציב + יומן הקריאות האחרון (מפרט 10א) */
  @Get('usage')
  usage(@Req() req: AuthedRequest): Promise<AiUsageView> {
    return this.ai.getUsage(req.user.sub);
  }

  /** ניתוח בזרימה — מקטעי טקסט נשלחים כ-SSE תוך כדי יצירה */
  @Post('analyze/stream')
  async analyzeStream(
    @Req() req: AuthedRequest,
    @Body() body: { context: unknown },
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      const result = await this.ai.analyzeStream(req.user.sub, body.context, (delta) =>
        send('delta', delta),
      );
      send('done', { provider: result.provider, model: result.model });
    } catch (e) {
      send('error', { message: (e as Error).message });
    } finally {
      res.end();
    }
  }

  /** רשימת מודלים מהספק — משמש גם כבדיקת חיבור */
  @Get('models')
  models(@Req() req: AuthedRequest): Promise<AiModelInfo[]> {
    return this.ai.listModels(req.user.sub);
  }

  @Post('analyze')
  analyze(
    @Req() req: AuthedRequest,
    @Body() body: { context: unknown },
  ): Promise<AnalyzeResult> {
    return this.ai.analyze(req.user.sub, body.context);
  }

  /** הניתוח האחרון שנשמר לתיק — נטען עם הכניסה כדי לא לנתח מחדש כל פעם */
  @Get('last')
  last(@Req() req: AuthedRequest): Promise<LastAnalysis | null> {
    return this.ai.getLastAnalysis(req.user.sub);
  }

  /** יועץ צ'אט עם Tool Use — המודל מפעיל את מנוע החישוב על התיק השמור */
  @Post('chat')
  chat(
    @Req() req: AuthedRequest,
    @Body() body: { messages: ChatMessage[] },
  ): Promise<ChatResult> {
    return this.ai.chat(req.user.sub, body.messages);
  }

  /** קליטת דוח שנתי מ-PDF — חילוץ מובנה לאישור המשתמש (נשלח בהסכמה מפורשת) */
  @Post('extract-report')
  extractReport(
    @Req() req: AuthedRequest,
    @Body() body: { pdfBase64: string },
  ): Promise<ExtractReportResult> {
    return this.ai.extractReport(req.user.sub, body.pdfBase64);
  }
}
