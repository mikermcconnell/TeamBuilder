import type { ApiErrorCode, ApiFailure, ApiSuccess } from '@/shared/ai-contracts';

export interface ServerlessRequest {
  method?: string;
  body?: unknown;
}

export interface ServerlessResponse {
  status: (code: number) => ServerlessResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
}

export function sendSuccess<T>(res: ServerlessResponse, data: T, statusCode = 200) {
  const body: ApiSuccess<T> = {
    ok: true,
    data,
  };

  res.status(statusCode).json(body);
}

export function sendError(
  res: ServerlessResponse,
  code: ApiErrorCode,
  message: string,
  statusCode = 400,
  details?: string[]
) {
  const body: ApiFailure = {
    ok: false,
    error: {
      code,
      message,
      details,
    },
  };

  res.status(statusCode).json(body);
}

export function parseRequestBody<T>(body: unknown): T {
  if (typeof body === 'string') {
    return JSON.parse(body) as T;
  }

  return body as T;
}

export function allowOnlyPost(req: ServerlessRequest, res: ServerlessResponse): boolean {
  if (req.method === 'POST') {
    return true;
  }

  res.setHeader('Allow', 'POST');
  sendError(res, 'BAD_REQUEST', 'Only POST requests are supported for this endpoint.', 405);
  return false;
}
