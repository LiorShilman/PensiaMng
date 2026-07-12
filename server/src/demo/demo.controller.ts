import { Controller, Post, Req } from '@nestjs/common';
import type { AuthedRequest } from '../auth/jwt-auth.guard';
import type { AuthResult, RequestMeta } from '../auth/auth.service';
import { DemoService } from './demo.service';

function metaOf(req: { ip?: string; headers: Record<string, unknown> }): RequestMeta {
  return {
    ip: req.ip,
    userAgent:
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

@Controller('auth')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  /** כניסת דמו בלחיצה אחת — חשבון נפרד לגמרי, מאופס לתמונת מצב קנונית בכל כניסה */
  @Post('demo-login')
  demoLogin(@Req() req: AuthedRequest): Promise<AuthResult> {
    return this.demo.loginAsDemo(metaOf(req));
  }
}
