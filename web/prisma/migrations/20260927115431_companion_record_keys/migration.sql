-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "importKey" TEXT;

-- AlterTable
ALTER TABLE "MileageRecord" ADD COLUMN "importKey" TEXT;

-- CreateIndex
CREATE INDEX "Expense_userId_importKey_idx" ON "Expense"("userId", "importKey");

-- CreateIndex
CREATE INDEX "MileageRecord_userId_importKey_idx" ON "MileageRecord"("userId", "importKey");
