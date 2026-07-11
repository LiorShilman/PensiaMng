-- AlterTable: persist the last AI analysis result per client so it survives page reloads
ALTER TABLE "Client" ADD COLUMN "lastAiAnalysisText" TEXT;
ALTER TABLE "Client" ADD COLUMN "lastAiAnalysisProvider" TEXT;
ALTER TABLE "Client" ADD COLUMN "lastAiAnalysisModel" TEXT;
ALTER TABLE "Client" ADD COLUMN "lastAiAnalysisAt" TIMESTAMP(3);
