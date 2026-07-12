import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  /** 'access' (ברירת מחדל, לא מוגדר) לטוקן רגיל; '2fa' לטוקן ביניים בזמן אימות דו-שלבי בלבד */
  purpose?: string;
}

export interface AuthedRequest extends Request {
  user: JwtPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      throw new UnauthorizedException('נדרשת התחברות');
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      // טוקן ביניים של 2FA תקף רק ל-/auth/2fa/verify — לא למסלולים מוגנים אחרים
      if (payload.purpose === '2fa') {
        throw new UnauthorizedException('נדרש להשלים אימות דו-שלבי');
      }
      req.user = payload;
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('אסימון לא תקף — התחבר מחדש');
    }
  }
}
