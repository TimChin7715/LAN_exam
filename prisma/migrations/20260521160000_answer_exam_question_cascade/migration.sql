-- Answer.examQuestionId: cascade when exam questions are removed (e.g. clear-all-data, rematerialize).
ALTER TABLE "Answer" DROP CONSTRAINT "Answer_examQuestionId_fkey";
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_examQuestionId_fkey" FOREIGN KEY ("examQuestionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
