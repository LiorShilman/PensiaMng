import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PortfolioService, ClientRole } from '../portfolio/portfolio.service';
import type { AuthResult, RequestMeta } from '../auth/auth.service';
import { DEMO_PRIMARY_PORTFOLIO, DEMO_SPOUSE_PORTFOLIO } from './demo-data';

const DEMO_EMAIL = 'demo@pensiamng.local';

/**
 * חשבון "דמו" נפרד לגמרי מהמשתמשים האמיתיים — מאפשר להציג בלחיצה אחת
 * את מלוא היכולות של המערכת מבלי לגעת בנתונים של אף משתמש רשום.
 * בכל כניסה מאפסים את התיק לתמונת המצב הקנונית כדי שההדגמה תמיד
 * תיראה שלמה, גם אם מבקר קודם שינה/מחק משהו בה.
 */
@Injectable()
export class DemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portfolio: PortfolioService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async loginAsDemo(meta: RequestMeta = {}): Promise<AuthResult> {
    let user = await this.prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      user = await this.prisma.user.create({
        data: {
          email: DEMO_EMAIL,
          passwordHash,
          fullName: DEMO_PRIMARY_PORTFOLIO.profile!.fullName!,
          clients: {
            create: {
              fullName: DEMO_PRIMARY_PORTFOLIO.profile!.fullName!,
              birthDate: new Date(DEMO_PRIMARY_PORTFOLIO.profile!.birthDate),
              gender: DEMO_PRIMARY_PORTFOLIO.profile!.gender,
              maritalStatus: 'MARRIED',
              employmentStatus: 'EMPLOYEE',
            },
          },
        },
      });
    } else if (user.totpEnabled) {
      // מבטיחים כניסת דמו חד-לחיצה חלקה גם אם 2FA הופעל בהדגמה קודמת
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          totpEnabled: false,
          totpSecretEnc: null,
          totpPendingEnc: null,
          totpBackupCodes: [],
          totpEnabledAt: null,
        },
      });
    }

    // איפוס לתמונת המצב הקנונית — כדי שההדגמה תמיד תראה את מלוא היכולות
    await this.portfolio.save(user.id, DEMO_PRIMARY_PORTFOLIO, ClientRole.PRIMARY);
    await this.portfolio.save(user.id, DEMO_SPOUSE_PORTFOLIO, ClientRole.SPOUSE);

    await this.audit.log({
      userId: user.id,
      action: 'DEMO_LOGIN',
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email, fullName: user.fullName } };
  }
}
