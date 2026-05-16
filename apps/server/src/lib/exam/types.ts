export class ExamAccessError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ExamAccessError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ExamTransitionError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ExamTransitionError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class SubmitExamError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'SubmitExamError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
