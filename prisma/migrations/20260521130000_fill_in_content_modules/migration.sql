-- Add FILL to QuestionType
ALTER TYPE "QuestionType" ADD VALUE 'FILL';

-- CreateEnum ExamContentModule
CREATE TYPE "ExamContentModule" AS ENUM ('OBJECTIVE', 'FILL', 'PRACTICAL');

-- CreateTable FillInQuestionImportBatch
CREATE TABLE "FillInQuestionImportBatch" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "wordFileName" TEXT NOT NULL,
    "wordStorageKey" TEXT NOT NULL,
    "excelFileName" TEXT NOT NULL,
    "excelStorageKey" TEXT NOT NULL,
    "studentExcelStorageKey" TEXT NOT NULL,
    "importedCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FillInQuestionImportBatch_pkey" PRIMARY KEY ("id")
);

-- Question: optional objective batch, optional fill-in batch
ALTER TABLE "Question" ALTER COLUMN "batchId" DROP NOT NULL;
ALTER TABLE "Question" ADD COLUMN "fillInBatchId" TEXT;

-- Exam: contentModules array, fillInBatchId, drop contentMode
ALTER TABLE "Exam" ADD COLUMN "contentModules" "ExamContentModule"[];
ALTER TABLE "Exam" ADD COLUMN "fillInBatchId" TEXT;

UPDATE "Exam" SET "contentModules" = ARRAY['OBJECTIVE']::"ExamContentModule"[]
WHERE "contentMode" = 'OBJECTIVE';

UPDATE "Exam" SET "contentModules" = ARRAY['PRACTICAL']::"ExamContentModule"[]
WHERE "contentMode" = 'PRACTICAL';

UPDATE "Exam" SET "contentModules" = ARRAY['OBJECTIVE', 'PRACTICAL']::"ExamContentModule"[]
WHERE "contentMode" = 'MIXED';

ALTER TABLE "Exam" ALTER COLUMN "contentModules" SET NOT NULL;
ALTER TABLE "Exam" DROP COLUMN "contentMode";

DROP TYPE "ExamContentMode";

-- Indexes
CREATE INDEX "FillInQuestionImportBatch_teacherId_idx" ON "FillInQuestionImportBatch"("teacherId");
CREATE INDEX "Question_fillInBatchId_idx" ON "Question"("fillInBatchId");
CREATE INDEX "Exam_fillInBatchId_idx" ON "Exam"("fillInBatchId");

-- Foreign keys
ALTER TABLE "FillInQuestionImportBatch" ADD CONSTRAINT "FillInQuestionImportBatch_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_fillInBatchId_fkey" FOREIGN KEY ("fillInBatchId") REFERENCES "FillInQuestionImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_fillInBatchId_fkey" FOREIGN KEY ("fillInBatchId") REFERENCES "FillInQuestionImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
