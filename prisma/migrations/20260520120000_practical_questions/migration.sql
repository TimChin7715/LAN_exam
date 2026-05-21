-- CreateEnum
CREATE TYPE "ExamContentMode" AS ENUM ('OBJECTIVE', 'PRACTICAL', 'MIXED');

-- CreateTable
CREATE TABLE "PracticalQuestionImportBatch" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "wordFileName" TEXT NOT NULL,
    "wordStorageKey" TEXT NOT NULL,
    "excelFileName" TEXT NOT NULL,
    "excelStorageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticalQuestionImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticalSubmission" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "rosterEntryId" TEXT NOT NULL,
    "docxStorageKey" TEXT NOT NULL,
    "docxFileName" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticalSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticalAnswerDraft" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "rosterEntryId" TEXT NOT NULL,
    "docxStorageKey" TEXT NOT NULL,
    "docxFileName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticalAnswerDraft_pkey" PRIMARY KEY ("id")
);

-- AlterTable Exam: add contentMode and practicalBatchId, make questionBatchId nullable
ALTER TABLE "Exam" ADD COLUMN "contentMode" "ExamContentMode" NOT NULL DEFAULT 'OBJECTIVE';
ALTER TABLE "Exam" ADD COLUMN "practicalBatchId" TEXT;
ALTER TABLE "Exam" ALTER COLUMN "questionBatchId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "PracticalQuestionImportBatch_teacherId_idx" ON "PracticalQuestionImportBatch"("teacherId");
CREATE INDEX "Exam_practicalBatchId_idx" ON "Exam"("practicalBatchId");
CREATE INDEX "PracticalSubmission_examId_idx" ON "PracticalSubmission"("examId");
CREATE UNIQUE INDEX "PracticalSubmission_examId_rosterEntryId_key" ON "PracticalSubmission"("examId", "rosterEntryId");
CREATE INDEX "PracticalAnswerDraft_examId_rosterEntryId_idx" ON "PracticalAnswerDraft"("examId", "rosterEntryId");
CREATE UNIQUE INDEX "PracticalAnswerDraft_examId_rosterEntryId_key" ON "PracticalAnswerDraft"("examId", "rosterEntryId");

-- AddForeignKey
ALTER TABLE "PracticalQuestionImportBatch" ADD CONSTRAINT "PracticalQuestionImportBatch_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_practicalBatchId_fkey" FOREIGN KEY ("practicalBatchId") REFERENCES "PracticalQuestionImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PracticalSubmission" ADD CONSTRAINT "PracticalSubmission_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticalSubmission" ADD CONSTRAINT "PracticalSubmission_rosterEntryId_fkey" FOREIGN KEY ("rosterEntryId") REFERENCES "RosterEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PracticalAnswerDraft" ADD CONSTRAINT "PracticalAnswerDraft_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticalAnswerDraft" ADD CONSTRAINT "PracticalAnswerDraft_rosterEntryId_fkey" FOREIGN KEY ("rosterEntryId") REFERENCES "RosterEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
