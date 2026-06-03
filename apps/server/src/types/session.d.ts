import 'express-session';

declare module 'express-session' {
  interface SessionData {
    teacherId?: string;
    studentRosterEntryId?: string;
    studentName?: string;
    /** Selected in-progress exam when multiple share the same roster batch */
    studentExamId?: string;
  }
}

import type session from 'express-session';

declare module 'http' {
  interface IncomingMessage {
    session: session.Session & Partial<session.SessionData>;
  }
}
