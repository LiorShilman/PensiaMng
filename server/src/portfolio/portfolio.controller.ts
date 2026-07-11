import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import { PortfolioService } from './portfolio.service';
import type { SavedPortfolio } from './portfolio.service';

@Controller('portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

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
    return this.portfolio.save(req.user.sub, body);
  }
}
