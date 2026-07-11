-- New product type: standalone disability insurance / insurance umbrella
ALTER TYPE "ProductType" ADD VALUE 'DISABILITY_INSURANCE';

-- Umbrella flag (occupational definition, offset cancellation)
ALTER TABLE "Product" ADD COLUMN "umbrellaFlag" BOOLEAN NOT NULL DEFAULT false;
