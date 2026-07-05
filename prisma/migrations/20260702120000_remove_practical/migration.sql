-- Remove exams that included the practical module (user-confirmed data policy).
DELETE FROM "Exam" WHERE 'PRACTICAL' = ANY("contentModules");

-- Drop practical answer tables (remaining rows only reference deleted exams).
DROP TABLE IF EXISTS "PracticalAnswerDraft";
DROP TABLE IF EXISTS "PracticalSubmission";

-- Unlink and drop practical batch reference on Exam.
ALTER TABLE "Exam" DROP CONSTRAINT IF EXISTS "Exam_practicalBatchId_fkey";
DROP INDEX IF EXISTS "Exam_practicalBatchId_idx";
ALTER TABLE "Exam" DROP COLUMN IF EXISTS "practicalBatchId";

DROP TABLE IF EXISTS "PracticalQuestionImportBatch";

-- Recreate ExamContentModule enum without PRACTICAL (Postgres: no subquery in USING).
CREATE TYPE "ExamContentModule_new" AS ENUM ('OBJECTIVE', 'FILL');

CREATE OR REPLACE FUNCTION migrate_exam_content_modules(
  old_modules "ExamContentModule"[]
) RETURNS "ExamContentModule_new"[] LANGUAGE plpgsql AS $$
DECLARE
  result "ExamContentModule_new"[] := '{}';
  m "ExamContentModule";
BEGIN
  IF old_modules IS NULL THEN
    RETURN result;
  END IF;
  FOREACH m IN ARRAY old_modules LOOP
    IF m::text IN ('OBJECTIVE', 'FILL') THEN
      result := array_append(result, m::text::"ExamContentModule_new");
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

ALTER TABLE "Exam"
  ALTER COLUMN "contentModules" TYPE "ExamContentModule_new"[]
  USING migrate_exam_content_modules("contentModules");

DROP FUNCTION migrate_exam_content_modules("ExamContentModule"[]);

DROP TYPE "ExamContentModule";
ALTER TYPE "ExamContentModule_new" RENAME TO "ExamContentModule";
