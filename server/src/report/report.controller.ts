import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportService } from './report.service';

const MAX_HTML_LENGTH = 2_000_000; // ~2MB — הגנה מפני בקשות ענק

@Controller('report')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly report: ReportService) {}

  /** מייצר PDF אמיתי (וקטורי) מה-HTML המעוצב שנבנה בצד הלקוח (report.ts) */
  @Post('pdf')
  async pdf(@Body() body: { html: string }, @Res() res: Response): Promise<void> {
    if (!body?.html || typeof body.html !== 'string') {
      throw new BadRequestException('חסר תוכן HTML לדוח');
    }
    if (body.html.length > MAX_HTML_LENGTH) {
      throw new BadRequestException('תוכן הדוח גדול מדי');
    }
    const pdf = await this.report.renderPdf(body.html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="pensiamng-report.pdf"');
    res.send(pdf);
  }
}
