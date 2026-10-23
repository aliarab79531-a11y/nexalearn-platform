import type { ErrorRequestHandler } from 'express';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'REQUEST_FAILED',
  ) {
    super(message);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const apiErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }
  if (isRecord(error) && (error['code'] === 11000 || error['code'] === '23505')) {
    response.status(409).json({
      error: { code: 'ALREADY_EXISTS', message: 'A record with these details already exists.' },
    });
    return;
  }
  if (isRecord(error) && typeof error['code'] === 'string'
    && (/^(08|23|28|3D)/.test(error['code']) || /^(ECONN|ETIMEDOUT|EAI_AGAIN)/.test(error['code']))) {
    console.error('MongoDB API request failed:', error['code']);
    response.status(503).json({
      error: { code: 'DATABASE_UNAVAILABLE', message: 'The data service is temporarily unavailable.' },
    });
    return;
  }
  if (isRecord(error) && typeof error['status'] === 'number'
    && error['status'] >= 400 && error['status'] < 500) {
    const tooLarge = error['status'] === 413;
    response.status(error['status']).json({
      error: {
        code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INVALID_REQUEST',
        message: tooLarge ? 'Request body is too large.' : 'The request body is invalid.',
      },
    });
    return;
  }
  console.error('Unhandled API request error:', error);
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' },
  });
};
