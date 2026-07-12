import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { encryptSecret, decryptSecret } from '../ai/crypto.util';

export interface AuthResult {
  token: string;
  user: { id: string; email: string; fullName: string };
}

export interface TwoFaChallenge {
  requires2fa: true;
  tempToken: string;
}

export type LoginResult = AuthResult | TwoFaChallenge;

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface TwoFaSetup {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export interface TwoFaStatus {
  enabled: boolean;
  enabledAt: string | null;
  backupCodesRemaining: number;
}

const ISSUER = 'PensiaMng';
const BACKUP_CODE_COUNT = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private secret(): string {
    return this.config.getOrThrow<string>('JWT_SECRET');
  }

  async register(
    email: string,
    password: string,
    fullName: string,
    meta: RequestMeta = {},
  ): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password || password.length < 6) {
      throw new UnauthorizedException('אימייל וסיסמה (6 תווים לפחות) נדרשים');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('כתובת האימייל כבר רשומה במערכת');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: fullName?.trim() || normalizedEmail,
        // כל משתמש נפתח עם "לקוח" ברירת מחדל — התיק האישי שלו.
        // ערכי לידה/מגדר זמניים יעודכנו במסך פרטים אישיים (שלב הבא).
        clients: {
          create: {
            fullName: fullName?.trim() || 'התיק שלי',
            birthDate: new Date('1985-01-01'),
            gender: 'MALE',
            maritalStatus: 'SINGLE',
            employmentStatus: 'EMPLOYEE',
          },
        },
      },
    });

    await this.audit.log({
      userId: user.id,
      email: normalizedEmail,
      action: 'REGISTER',
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.issueToken(user.id, user.email, user.fullName);
  }

  async login(
    email: string,
    password: string,
    meta: RequestMeta = {},
  ): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      await this.audit.log({
        email: normalizedEmail,
        action: 'LOGIN_FAILED',
        success: false,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('אימייל או סיסמה שגויים');
    }

    if (user.totpEnabled) {
      const tempToken = await this.jwt.signAsync(
        { sub: user.id, email: user.email, purpose: '2fa' },
        { expiresIn: '5m' },
      );
      await this.audit.log({
        userId: user.id,
        action: 'LOGIN_PASSWORD_OK_2FA_PENDING',
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return { requires2fa: true, tempToken };
    }

    await this.audit.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.issueToken(user.id, user.email, user.fullName);
  }

  // ---------- אימות דו-שלבי (2FA) ----------

  /** שלב 1: יוצר סוד TOTP חדש (עדיין לא מופעל) ומחזיר QR להתקנה באפליקציית אימות */
  async setupTwoFa(userId: string): Promise<TwoFaSetup> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, ISSUER, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpPendingEnc: encryptSecret(secret, this.secret()) },
    });
    return { secret, otpauthUrl, qrDataUrl };
  }

  /** שלב 2: מאמת קוד מהאפליקציה ומפעיל את ה-2FA, עם קודי גיבוי חד-פעמיים */
  async enableTwoFa(
    userId: string,
    code: string,
    meta: RequestMeta = {},
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpPendingEnc) {
      throw new BadRequestException('לא בוצעה הגדרת 2FA — התחל מהסריקת קוד QR מחדש');
    }
    const pendingSecret = decryptSecret(user.totpPendingEnc, this.secret());
    if (!authenticator.verify({ token: code, secret: pendingSecret })) {
      throw new UnauthorizedException('קוד האימות שגוי — נסה שוב');
    }

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      crypto.randomBytes(5).toString('hex'),
    );
    const hashed = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecretEnc: user.totpPendingEnc,
        totpPendingEnc: null,
        totpEnabled: true,
        totpEnabledAt: new Date(),
        totpBackupCodes: hashed,
      },
    });
    await this.audit.log({
      userId,
      action: 'TWOFA_ENABLED',
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { backupCodes };
  }

  /** מבטל 2FA — דורש קוד נוכחי (או קוד גיבוי) כדי למנוע ביטול על ידי מי שגנב את הטוקן בלבד */
  async disableTwoFa(userId: string, code: string, meta: RequestMeta = {}): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpEnabled || !user.totpSecretEnc) {
      throw new BadRequestException('2FA אינו מופעל');
    }
    const valid = await this.verifyCodeOrBackup(user, code);
    if (!valid.ok) {
      throw new UnauthorizedException('קוד האימות שגוי');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecretEnc: null,
        totpPendingEnc: null,
        totpEnabled: false,
        totpEnabledAt: null,
        totpBackupCodes: [],
      },
    });
    await this.audit.log({
      userId,
      action: 'TWOFA_DISABLED',
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  /** שלב 3 של ההתחברות: מאמת את הקוד מול הטוקן הזמני ומנפיק טוקן גישה מלא */
  async verifyTwoFa(
    tempToken: string,
    code: string,
    meta: RequestMeta = {},
  ): Promise<AuthResult> {
    let payload: { sub: string; purpose?: string };
    try {
      payload = await this.jwt.verifyAsync(tempToken);
    } catch {
      throw new UnauthorizedException('פג תוקף — התחבר מחדש');
    }
    if (payload.purpose !== '2fa') {
      throw new UnauthorizedException('טוקן לא תקף לפעולה זו');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    if (!user.totpEnabled || !user.totpSecretEnc) {
      throw new UnauthorizedException('2FA אינו מופעל עבור המשתמש');
    }

    const result = await this.verifyCodeOrBackup(user, code);
    if (!result.ok) {
      await this.audit.log({
        userId: user.id,
        action: 'TWOFA_VERIFY_FAILED',
        success: false,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('קוד שגוי');
    }
    if (result.usedBackupCode) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { totpBackupCodes: result.remainingBackupCodes },
      });
    }
    await this.audit.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      detail: result.usedBackupCode ? 'via backup code' : 'via TOTP',
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return this.issueToken(user.id, user.email, user.fullName);
  }

  async twoFaStatus(userId: string): Promise<TwoFaStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      enabled: user.totpEnabled,
      enabledAt: user.totpEnabledAt?.toISOString() ?? null,
      backupCodesRemaining: user.totpBackupCodes.length,
    };
  }

  private async verifyCodeOrBackup(
    user: { totpSecretEnc: string | null; totpBackupCodes: string[] },
    code: string,
  ): Promise<{ ok: boolean; usedBackupCode: boolean; remainingBackupCodes: string[] }> {
    const cleaned = code.trim();
    if (user.totpSecretEnc) {
      const secret = decryptSecret(user.totpSecretEnc, this.secret());
      if (authenticator.verify({ token: cleaned, secret })) {
        return { ok: true, usedBackupCode: false, remainingBackupCodes: user.totpBackupCodes };
      }
    }
    for (const hash of user.totpBackupCodes) {
      if (await bcrypt.compare(cleaned, hash)) {
        return {
          ok: true,
          usedBackupCode: true,
          remainingBackupCodes: user.totpBackupCodes.filter((h) => h !== hash),
        };
      }
    }
    return { ok: false, usedBackupCode: false, remainingBackupCodes: user.totpBackupCodes };
  }

  private async issueToken(
    id: string,
    email: string,
    fullName: string,
  ): Promise<AuthResult> {
    const token = await this.jwt.signAsync({ sub: id, email });
    return { token, user: { id, email, fullName } };
  }
}
