-- Allow the same person in different roster import batches (per-batch uniqueness).
DROP INDEX IF EXISTS "RosterEntry_fullName_nationalId_key";
CREATE UNIQUE INDEX "RosterEntry_batchId_fullName_nationalId_key" ON "RosterEntry"("batchId", "fullName", "nationalId");
