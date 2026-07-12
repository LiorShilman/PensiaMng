import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { PortfolioService, ClientRole } from './portfolio.service';
import type { SavedPortfolio } from './portfolio.service';

@Controller('portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  load(@Req() req: AuthedRequest): Promise<SavedPortfolio> {
    return this.portfolio.load(req.user.sub);
  }

  @Put()
  async save(
    @Req() req: AuthedRequest,
    @Body() body: SavedPortfolio,
  ): Promise<SavedPortfolio> {
    if (!Array.isArray(body?.products)) {
      throw new BadRequestException('גוף הבקשה חייב לכלול מערך products');
    }
    const saved = await this.portfolio.save(req.user.sub, body);
    await this.audit.log({
      userId: req.user.sub,
      action: 'PORTFOLIO_SAVED',
      detail: `${body.products.length} מוצרים`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return saved;
  }

  /** מבט זוגי (מפרט §9 פריט 5) — תיק בן/בת הזוג, נוצר אוטומטית בטעינה הראשונה */
  @Get('spouse')
  loadSpouse(@Req() req: AuthedRequest): Promise<SavedPortfolio> {
    return this.portfolio.load(req.user.sub, ClientRole.SPOUSE);
  }

  @Get('spouse/exists')
  async spouseExists(@Req() req: AuthedRequest): Promise<{ exists: boolean }> {
    return { exists: await this.portfolio.hasSpouse(req.user.sub) };
  }

  @Put('spouse')
  async saveSpouse(
    @Req() req: AuthedRequest,
    @Body() body: SavedPortfolio,
  ): Promise<SavedPortfolio> {
    if (!Array.isArray(body?.products)) {
      throw new BadRequestException('גוף הבקשה חייב לכלול מערך products');
    }
    const saved = await this.portfolio.save(req.user.sub, body, ClientRole.SPOUSE);
    await this.audit.log({
      userId: req.user.sub,
      action: 'SPOUSE_PORTFOLIO_SAVED',
      detail: `${body.products.length} מוצרים`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return saved;
  }

  /** ביטול מבט זוגי — מסיר את תיק בן/בת הזוג וכל מוצריו */
  @Delete('spouse')
  async removeSpouse(@Req() req: AuthedRequest): Promise<{ ok: true }> {
    await this.portfolio.deleteSpouse(req.user.sub);
    await this.audit.log({
      userId: req.user.sub,
      action: 'SPOUSE_PORTFOLIO_REMOVED',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { ok: true };
  }
}
