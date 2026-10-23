import type { RequestHandler } from 'express';

type JsonBody = Record<string, unknown>;

/** Normalize every JSON API response to the JSend envelope. */
export const jsend: RequestHandler = (_request, response, next) => {
  const sendJson = response.json.bind(response);
  response.json = ((body?: unknown) => {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return sendJson({ status: 'success', data: body ?? null });
    }

    const payload = body as JsonBody;
    if (payload['status'] === 'success' || payload['status'] === 'fail' || payload['status'] === 'error') {
      return sendJson(body);
    }

    if (payload['error'] && typeof payload['error'] === 'object') {
      const error = payload['error'] as JsonBody;
      const data = { code: error['code'], message: error['message'] };
      if (response.statusCode >= 500) {
        return sendJson({ status: 'error', message: error['message'], code: error['code'], data });
      }
      return sendJson({ status: 'fail', data });
    }

    // Existing data/meta endpoints already hold the JSend data and pagination metadata.
    if ('data' in payload) return sendJson({ status: 'success', ...payload });
    return sendJson({ status: 'success', data: payload });
  }) as typeof response.json;
  next();
};
