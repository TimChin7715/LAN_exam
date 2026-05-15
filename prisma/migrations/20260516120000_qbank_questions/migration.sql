-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE', 'MULTI', 'JUDGE');

-- CreateEnum
CREATE TYPE "MultiScoringRule" AS ENUM ('ALL_OR_NOTHING');

-- CreateTable
CREATE TABLE "QuestionImportBatch" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "importedCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "stem" TEXT NOT NULL,
    "answerKeys" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "explanation" TEXT,
    "knowledgePoints" TEXT,
    "multiScoringRule" "MultiScoringRule",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionImportBatch_teacherId_idx" ON "QuestionImportBatch"("teacherId");

-- CreateIndex
CREATE INDEX "Question_batchId_idx" ON "Question"("batchId");

-- CreateIndex
CREATE INDEX "Question_type_idx" ON "Question"("type");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_key_key" ON "QuestionOption"("questionId", "key");

-- AddForeignKey
ALTER TABLE "QuestionImportBatch" ADD CONSTRAINT "QuestionImportBatch_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "QuestionImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
