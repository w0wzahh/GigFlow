-- DropIndex
DROP INDEX "Earning_userId_importKey_idx";

-- DropIndex
DROP INDEX "Expense_userId_importKey_idx";

-- DropIndex
DROP INDEX "MileageRecord_userId_importKey_idx";

-- DropIndex
DROP INDEX "ScheduleEntry_userId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Earning_userId_importKey_key" ON "Earning"("userId", "importKey");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_userId_importKey_key" ON "Expense"("userId", "importKey");

-- CreateIndex
CREATE UNIQUE INDEX "MileageRecord_userId_importKey_key" ON "MileageRecord"("userId", "importKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEntry_userId_importKey_key" ON "ScheduleEntry"("userId", "importKey");

