-- CreateTable
CREATE TABLE "FillInBatchAttachment" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FillInBatchAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FillInBatchAttachment_batchId_idx" ON "FillInBatchAttachment"("batchId");

-- AddForeignKey
ALTER TABLE "FillInBatchAttachment" ADD CONSTRAINT "FillInBatchAttachment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FillInQuestionImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate legacy single attachment rows
INSERT INTO "FillInBatchAttachment" ("id", "batchId", "fileName", "storageKey", "sortOrder", "createdAt")
SELECT
    'legacy-' || "id",
    "id",
    "attachmentFileName",
    "attachmentStorageKey",
    0,
    "createdAt"
FROM "FillInQuestionImportBatch"
WHERE "attachmentStorageKey" IS NOT NULL
  AND "attachmentFileName" IS NOT NULL;
