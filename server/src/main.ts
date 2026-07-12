import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // קליטת דוח שנתי: PDF כ-base64 בגוף הבקשה — מעלים את מגבלת ברירת המחדל (100kb)
  app.use(json({ limit: '20mb' }));
  app.enableCors({ origin: /^http:\/\/localhost:\d+$/ });
  await app.listen(process.env.PORT ?? 3210);
}
bootstrap();
