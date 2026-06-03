-- Preserve import row order (createdAt is identical within a batch transaction).
ALTER TABLE "Question" ADD COLUMN "importSortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Question_batchId_importSortOrder_idx" ON "Question"("batchId", "importSortOrder");
CREATE INDEX "Question_fillInBatchId_importSortOrder_idx" ON "Question"("fillInBatchId", "importSortOrder");

WITH objective_ranked AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (
      PARTITION BY "batchId"
      ORDER BY "createdAt" ASC, id ASC
    ) - 1)::INTEGER AS rn
  FROM "Question"
  WHERE "batchId" IS NOT NULL
)
UPDATE "Question" AS q
SET "importSortOrder" = r.rn
FROM objective_ranked AS r
WHERE q.id = r.id;

WITH fill_ranked AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (
      PARTITION BY "fillInBatchId"
      ORDER BY
        CASE
          WHEN "knowledgePoints" ~ '^[0-9]+$' THEN "knowledgePoints"::INTEGER
          ELSE 2147483647
        END ASC,
        CASE
          WHEN "explanation" ~ '^[0-9]+$' THEN "explanation"::INTEGER
          ELSE 2147483647
        END ASC,
        "createdAt" ASC,
        id ASC
    ) - 1)::INTEGER AS rn
  FROM "Question"
  WHERE "fillInBatchId" IS NOT NULL
)
UPDATE "Question" AS q
SET "importSortOrder" = r.rn
FROM fill_ranked AS r
WHERE q.id = r.id;
