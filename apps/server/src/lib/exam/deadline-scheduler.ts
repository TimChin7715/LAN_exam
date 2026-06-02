import type { FastifyBaseLogger, FastifyInstance } from 'fastify';

import { prisma } from '../prisma.js';
import { endExam } from './transition.js';

const processingExamIds = new Set<string>();

export function getExamDeadlinePollMs(): number {
  const raw = process.env.EXAM_DEADLINE_POLL_MS;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 5_000) {
      return n;
    }
  }
  return 15_000;
}

export async function processExamDeadlines(
  log?: FastifyBaseLogger,
): Promise<void> {
  const now = new Date();
  const dueExams = await prisma.exam.findMany({
    where: {
      status: 'IN_PROGRESS',
      scheduledEndAt: { lte: now },
    },
    select: { id: true, teacherId: true },
  });

  for (const exam of dueExams) {
    if (processingExamIds.has(exam.id)) {
      continue;
    }
    processingExamIds.add(exam.id);
    try {
      const result = await endExam(exam.id, exam.teacherId);
      log?.info(
        { examId: exam.id, endedAt: result.endedAt },
        'Exam deadline: auto-submitted and ended',
      );
    } catch (err) {
      log?.error({ examId: exam.id, err }, 'Exam deadline processing failed');
    } finally {
      processingExamIds.delete(exam.id);
    }
  }
}

export function registerExamDeadlineScheduler(app: FastifyInstance): void {
  const intervalMs = getExamDeadlinePollMs();
  const tick = () => {
    void processExamDeadlines(app.log).catch((err) => {
      app.log.error({ err }, 'processExamDeadlines tick failed');
    });
  };

  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();

  app.addHook('onClose', async () => {
    clearInterval(timer);
  });

  app.log.info(
    { intervalMs },
    'Exam deadline scheduler registered',
  );
}
