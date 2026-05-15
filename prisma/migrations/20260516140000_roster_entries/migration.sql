-- CreateTable
CREATE TABLE "RosterImportBatch" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "importedCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterEntry" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RosterImportBatch_teacherId_idx" ON "RosterImportBatch"("teacherId");

-- CreateIndex
CREATE INDEX "RosterEntry_fullName_idx" ON "RosterEntry"("fullName");

-- CreateIndex
CREATE INDEX "RosterEntry_nationalId_idx" ON "RosterEntry"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_fullName_nationalId_key" ON "RosterEntry"("fullName", "nationalId");

-- AddForeignKey
ALTER TABLE "RosterImportBatch" ADD CONSTRAINT "RosterImportBatch_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "RosterImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
