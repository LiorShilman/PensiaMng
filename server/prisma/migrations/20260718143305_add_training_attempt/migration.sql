-- CreateTable
CREATE TABLE "TrainingAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "scenario" JSONB NOT NULL,
    "userAnswer" JSONB,
    "engineAnswer" JSONB,
    "score" DECIMAL(5,2),
    "verdict" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "TrainingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingAttempt_userId_createdAt_idx" ON "TrainingAttempt"("userId", "createdAt");
