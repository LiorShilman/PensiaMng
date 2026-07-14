import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CalcEngineModule } from './calc-engine/calc-engine.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { AiModule } from './ai/ai.module';
import { DemoModule } from './demo/demo.module';
import { ReportModule } from './report/report.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // בפרודקשן (PM2, NODE_ENV=production) קורא server/.env.production —
      // כדי שקובץ .env הרגיל של הפיתוח המקומי לעולם לא יידרס בפריסה
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    PortfolioModule,
    AiModule,
    CalcEngineModule,
    DemoModule,
    ReportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
