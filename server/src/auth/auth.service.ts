import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthResult {
  token: string;
  user: { id: string; email: string; fullName: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(
    email: string,
    password: string,
    fullName: string,
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

    return this.issueToken(user.id, user.email, user.fullName);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('אימייל או סיסמה שגויים');
    }
    return this.issueToken(user.id, user.email, user.fullName);
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
