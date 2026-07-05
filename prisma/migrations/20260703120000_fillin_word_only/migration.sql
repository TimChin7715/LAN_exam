-- AlterTable: Word-only fill-in import; legacy Excel fields optional
ALTER TABLE "FillInQuestionImportBatch" ADD COLUMN "sourceWordStorageKey" TEXT;
ALTER TABLE "FillInQuestionImportBatch" ALTER COLUMN "excelFileName" DROP NOT NULL;
ALTER TABLE "FillInQuestionImportBatch" ALTER COLUMN "excelStorageKey" DROP NOT NULL;
ALTER TABLE "FillInQuestionImportBatch" ALTER COLUMN "studentExcelStorageKey" DROP NOT NULL;
