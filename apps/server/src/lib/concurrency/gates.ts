import { ConcurrencyGate } from './concurrency-gate.js';
import { FifoGate } from './fifo-gate.js';
import {
  getExamPaperMaxConcurrent,
  getExamSubmitMaxConcurrent,
  getExamSubmitMaxQueue,
  getExamSyncMaxConcurrent,
  getExamSyncMaxQueue,
} from '../env.js';

export const examPaperGate = new ConcurrencyGate(getExamPaperMaxConcurrent());

export const examSubmitGate = new FifoGate(
  getExamSubmitMaxConcurrent(),
  getExamSubmitMaxQueue(),
);

export const examSyncGate = new FifoGate(
  getExamSyncMaxConcurrent(),
  getExamSyncMaxQueue(),
);
