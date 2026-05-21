-- CreateTable
CREATE TABLE "ExamSeatAssignment" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "rosterEntryId" TEXT NOT NULL,
    "seatLabel" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamSeatAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamSeatAssignment_examId_displayOrder_idx" ON "ExamSeatAssignment"("examId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSeatAssignment_examId_rosterEntryId_key" ON "ExamSeatAssignment"("examId", "rosterEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSeatAssignment_examId_seatLabel_key" ON "ExamSeatAssignment"("examId", "seatLabel");

-- AddForeignKey
ALTER TABLE "ExamSeatAssignment" ADD CONSTRAINT "ExamSeatAssignment_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeatAssignment" ADD CONSTRAINT "ExamSeatAssignment_rosterEntryId_fkey" FOREIGN KEY ("rosterEntryId") REFERENCES "RosterEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
