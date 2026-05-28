import { z } from 'zod';

export const answerItemSchema = z.object({
  examQuestionId: z.string().min(1),
  selectedKeys: z.string().max(4096),
});

export const examAnswersBodySchema = z.object({
  examId: z.string().min(1),
  answers: z.array(answerItemSchema).min(1).max(500),
});

export const examSyncProgressBodySchema = z.object({
  examId: z.string().min(1),
  answers: z.array(answerItemSchema).min(1).max(500),
});
