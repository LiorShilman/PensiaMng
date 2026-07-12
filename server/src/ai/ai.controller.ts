import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';
import type {
  AiModelInfo,
  AiProvider,
  AiSettingsView,
  AnalyzeResult,
  ChatMessage,
  ChatResult,
  ExtractReportResult,
  LastAnalysis,
} from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('settings')
  getSettings(@Req() req: AuthedRequest): Promise<AiSettingsView | null> {
    return this.ai.getSettings(req.user.sub);
  }

  @Put('settings')
  saveSettings(
    @Req() req: AuthedRequest,
    @Body() dto: { provider: AiProvider; apiKey?: string; model?: string },
  ): Promise<AiSettingsView> {
    return this.ai.saveSettings(req.user.sub, dto);
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
