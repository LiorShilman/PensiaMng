-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'MONEY_MARKET_FUND';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "totpBackupCodes" DROP DEFAULT;
