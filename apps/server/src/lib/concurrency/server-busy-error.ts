import { SERVER_BUSY_CODE, SERVER_BUSY_MESSAGE } from '../errors.js';

export class ServerBusyError extends Error {
  readonly statusCode = 503;
  readonly code = SERVER_BUSY_CODE;

  constructor(message: string = SERVER_BUSY_MESSAGE) {
    super(message);
    this.name = 'ServerBusyError';
  }
}
