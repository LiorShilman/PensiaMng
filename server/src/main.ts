import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  // HTTPS בפרודקשן: אם קיימים certs/key.pem + certs/cert.pem יחסית ל-cwd
  // (server/, כשה-PM2 מריץ עם cwd=./server) — משתמשים בהם. בפיתוח מקומי
  // הקבצים לא קיימים, אז ה-server ממשיך לרוץ HTTP רגיל בלי שינוי.
  const keyPath = join(process.cwd(), 'certs', 'key.pem');
  const certPath = join(process.cwd(), 'certs', 'cert.pem');
  const httpsOptions =
    existsSync(keyPath) && existsSync(certPath)
      ? { key: readFileSync(keyPath), cert: readFileSync(certPath) }
      : undefined;

  const app = await NestFactory.create(AppModule, { httpsOptions });
  // קליטת דוח שנתי: PDF כ-base64 בגוף הבקשה — מעלים את מגבלת ברירת המחדל (100kb)
  app.use(json({ limit: '20mb' }));
  // localhost:* לפיתוח מקומי תמיד מותר; CORS_ORIGIN (פרודקשן) מתווסף אם מוגדר
  const allowedOrigins: (string | RegExp)[] = [/^http:\/\/localhost:\d+$/];
  if (process.env.CORS_ORIGIN) allowedOrigins.push(process.env.CORS_ORIGIN);
  app.enableCors({ origin: allowedOrigins });
  await app.listen(process.env.PORT ?? 3210);
}
bootstrap();
