-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'COMMON_LAW', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('EMPLOYEE', 'SELF_EMPLOYED', 'BOTH', 'CONTROLLING_SHAREHOLDER', 'NOT_WORKING', 'RETIRED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PENSION_COMPREHENSIVE', 'PENSION_GENERAL', 'MANAGERS_INSURANCE', 'PROVIDENT_FUND', 'PROVIDENT_INVESTMENT', 'IRA', 'STUDY_FUND', 'OLD_PENSION_FUND', 'BUDGETARY_PENSION');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'FROZEN', 'PAYING', 'CLOSED');

-- CreateEnum
CREATE TYPE "InsuranceCoveragePlan" AS ENUM ('DEFAULT_75_100', 'MAX_SAVINGS', 'MAX_DISABILITY', 'MAX_SURVIVORS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "Section14Status" AS ENUM ('FULL', 'PARTIAL', 'NONE');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "maritalStatus" "MaritalStatus" NOT NULL,
    "employmentStatus" "EmploymentStatus" NOT NULL,
    "grossSalary" DECIMAL(12,2),
    "insuredSalary" DECIMAL(12,2),
    "annualIncome" DECIMAL(14,2),
    "spouseBirthDate" TIMESTAMP(3),
    "spouseGender" "Gender",
    "healthFlag" BOOLEAN NOT NULL DEFAULT false,
    "smokerFlag" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "name" TEXT,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "provider" TEXT NOT NULL,
    "accountNumber" TEXT,
    "joinDate" TIMESTAMP(3) NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "balanceTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balanceEmployee" DECIMAL(14,2),
    "balanceEmployer" DECIMAL(14,2),
    "balanceSeverance" DECIMAL(14,2),
    "balanceAsOf" TIMESTAMP(3),
    "feeFromDeposit" DECIMAL(5,3) NOT NULL DEFAULT 0,
    "feeFromBalance" DECIMAL(5,3) NOT NULL DEFAULT 0,
    "depositEmployee" DECIMAL(10,2),
    "depositEmployer" DECIMAL(10,2),
    "depositSeverance" DECIMAL(10,2),
    "depositSelf" DECIMAL(10,2),
    "coveragePlan" "InsuranceCoveragePlan",
    "disabilityPct" DECIMAL(5,2),
    "survivorsPct" DECIMAL(5,2),
    "survivorsWaiver" BOOLEAN NOT NULL DEFAULT false,
    "survivorsWaiverDate" TIMESTAMP(3),
    "qualifyingPeriodStart" TIMESTAMP(3),
    "monthlyCoverageCost" DECIMAL(10,2),
    "policyGeneration" TEXT,
    "guaranteedFactor" DECIMAL(8,4),
    "deathBenefitAmount" DECIMAL(14,2),
    "section14" "Section14Status" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentTrack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "riskLevel" INTEGER NOT NULL DEFAULT 4,
    "defaultReturn" DECIMAL(5,2) NOT NULL DEFAULT 3.74,

    CONSTRAINT "InvestmentTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentAllocation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "InvestmentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT,
    "percentage" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "employerName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "insuredSalary" DECIMAL(12,2),
    "section14" "Section14Status" NOT NULL DEFAULT 'NONE',
    "severanceOutcome" TEXT,

    CONSTRAINT "Employment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryParameter" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "source" TEXT,
    "notes" TEXT,

    CONSTRAINT "RegulatoryParameter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentAllocation_productId_trackId_key" ON "InvestmentAllocation"("productId", "trackId");

-- CreateIndex
CREATE INDEX "RegulatoryParameter_key_validFrom_idx" ON "RegulatoryParameter"("key", "validFrom");

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentAllocation" ADD CONSTRAINT "InvestmentAllocation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentAllocation" ADD CONSTRAINT "InvestmentAllocation_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "InvestmentTrack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employment" ADD CONSTRAINT "Employment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
