import { ApiError, isRecord } from './api-errors';

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(pageValue: unknown, limitValue: unknown): Pagination {
  const page = parsePositiveInteger(pageValue, 1);
  const limit = Math.min(parsePositiveInteger(limitValue, 20), 100);
  if (!Number.isSafeInteger((page - 1) * limit)) {
    throw new ApiError(400, 'Requested page is too large.', 'INVALID_PAGINATION');
  }
  return { page, limit, skip: (page - 1) * limit };
}

export function parsePositiveInteger(value: unknown, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'string' || !/^[1-9]\d{0,5}$/.test(value)) {
    throw new ApiError(400, 'Pagination values must be positive whole numbers.', 'INVALID_PAGINATION');
  }
  return Number(value);
}

export function requireObjectId(value: unknown, field = 'id'): string {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throw new ApiError(400, `A valid ${field} is required.`, 'INVALID_ID');
  }
  return value;
}

export function requireString(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, `${field} must be text.`, 'INVALID_FIELD');
  }
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new ApiError(400, `${field} must be between ${minimum} and ${maximum} characters.`, 'INVALID_FIELD');
  }
  return normalized;
}

export function requireRequestBody(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ApiError(400, 'A JSON object is required.', 'INVALID_BODY');
  }
  return value;
}

export function parseOptionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ApiError(400, `${field} must be a date.`, 'INVALID_FIELD');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${field} must be a valid date.`, 'INVALID_FIELD');
  }
  return date;
}
