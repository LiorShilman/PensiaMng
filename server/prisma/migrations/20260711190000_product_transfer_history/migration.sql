-- CreateTable: transfer/migration history per product (source of funds, e.g. gemel that originated from managers insurance)
CREATE TABLE "ProductTransfer" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fromProvider" TEXT NOT NULL,
    "fromType" TEXT,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductTransfer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProductTransfer" ADD CONSTRAINT "ProductTransfer_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
