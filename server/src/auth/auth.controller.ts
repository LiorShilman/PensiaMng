import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import type {
  AuthResult,
  LoginResult,
  RequestMeta,
  TwoFaSetup,
  TwoFaStatus,
} from './auth.service';
import { AuditService } from '../audit/audit.service';
import type { AuditEntry } from '../audit/audit.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthedRequest } from './jwt-auth.guard';

interface RegisterDto {
  email: string;
  password: string;
  fullName: string;
}

interface LoginDto {
  email: string;
  password: string;
}

/** מטא-נתוני הבקשה (IP/דפדפן) — ליומן הגישה בלבד, לעולם לא לתוכן */
function metaOf(req: { ip?: string; headers: Record<string, unknown> }): RequestMeta {
  return {
    ip: req.ip,
    userAgent:
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: AuthedRequest): Promise<AuthResult> {
    return this.auth.register(dto.email, dto.password, dto.fullName, metaOf(req));
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: AuthedRequest): Promise<LoginResult> {
    return this.auth.login(dto.email, dto.password, metaOf(req));
  }

  /** שלב 3 של ההתחברות כש-2FA מופעל: קוד + הטוקן הזמני מ-login */
  @Post('2fa/verify')
  verifyTwoFa(
    @Body() dto: { tempToken: string; code: string },
    @Req() req: AuthedRequest,
  ): Promise<AuthResult> {
    return this.auth.verifyTwoFa(dto.tempToken, dto.code, metaOf(req));
  }

  @UseGuards(JwtAuthGuard)
  @Get('2fa/status')
  twoFaStatus(@Req() req: AuthedRequest): Promise<TwoFaStatus> {
    return this.auth.twoFaStatus(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  setupTwoFa(@Req() req: AuthedRequest): Promise<TwoFaSetup> {
    return this.auth.setupTwoFa(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  enableTwoFa(
    @Body() dto: { code: string },
    @Req() req: AuthedRequest,
  ): Promise<{ backupCodes: string[] }> {
    return this.auth.enableTwoFa(req.user.sub, dto.code, metaOf(req));
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  async disableTwoFa(
    @Body() dto: { code: string },
    @Req() req: AuthedRequest,
  ): Promise<{ ok: true }> {
    await this.auth.disableTwoFa(req.user.sub, dto.code, metaOf(req));
    return { ok: true };
  }

  /** יומן הגישה והפעולות של המשתמש (מפרט §11) */
  @UseGuards(JwtAuthGuard)
  @Get('audit-log')
  auditLog(@Req() req: AuthedRequest): Promise<AuditEntry[]> {
    return this.audit.list(req.user.sub);
  }
}
