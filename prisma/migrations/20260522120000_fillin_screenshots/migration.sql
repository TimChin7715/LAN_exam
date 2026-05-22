-- CreateTable
CREATE TABLE "FillInScreenshotDraft" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "rosterEntryId" TEXT NOT NULL,
    "examQuestionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FillInScreenshotDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FillInScreenshot" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "examQuestionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,

    CONSTRAINT "FillInScreenshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FillInScreenshotDraft_examId_rosterEntryId_idx" ON "FillInScreenshotDraft"("examId", "rosterEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "FillInScreenshotDraft_examId_rosterEntryId_examQuestionId_so_key" ON "FillInScreenshotDraft"("examId", "rosterEntryId", "examQuestionId", "sortOrder");

-- CreateIndex
CREATE INDEX "FillInScreenshot_submissionId_idx" ON "FillInScreenshot"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "FillInScreenshot_submissionId_examQuestionId_sortOrder_key" ON "FillInScreenshot"("submissionId", "examQuestionId", "sortOrder");

-- AddForeignKey
ALTER TABLE "FillInScreenshotDraft" ADD CONSTRAINT "FillInScreenshotDraft_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInScreenshotDraft" ADD CONSTRAINT "FillInScreenshotDraft_rosterEntryId_fkey" FOREIGN KEY ("rosterEntryId") REFERENCES "RosterEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInScreenshotDraft" ADD CONSTRAINT "FillInScreenshotDraft_examQuestionId_fkey" FOREIGN KEY ("examQuestionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FillInScreenshot" ADD CONSTRAINT "FillInScreenshot_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
