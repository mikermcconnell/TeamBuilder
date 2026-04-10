import type { ApiErrorCode, ApiFailure, ApiSuccess } from '@/shared/ai-contracts';
import { MAX_AI_REQUEST_BYTES } from '@/config/constants';
import { enforceAiRateLimits, verifyAuthenticatedAiUser, type RequestHeaders } from './security';

export interface ServerlessRequest {
  method?: string;
  body?: unknown;
  headers?: RequestHeaders;
}

export interface ServerlessResponse {
  status: (code: number) => ServerlessResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
}

export class RequestGuardError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = 'RequestGuardError';
  }
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
    try {
      return JSON.parse(body) as T;
    } catch {
      throw new RequestGuardError('BAD_REQUEST', 'Request body must contain valid JSON.', 400);
    }
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

function getSerializedBodySize(body: unknown): number {
  if (typeof body === 'string') {
    return Buffer.byteLength(body, 'utf8');
  }

  if (body === undefined || body === null) {
    return 0;
  }

  try {
    return Buffer.byteLength(JSON.stringify(body), 'utf8');
  } catch {
    throw new RequestGuardError('BAD_REQUEST', 'Request body could not be processed.', 400);
  }
}

export async function ensureAiRequestSecurity(req: ServerlessRequest): Promise<{ userId: string }> {
  const bodySize = getSerializedBodySize(req.body);
  if (bodySize > MAX_AI_REQUEST_BYTES) {
    throw new RequestGuardError(
      'BAD_REQUEST',
      `AI requests must be ${Math.floor(MAX_AI_REQUEST_BYTES / 1024)} KB or smaller.`,
      413,
    );
  }

  let decodedToken;
  try {
    decodedToken = await verifyAuthenticatedAiUser(req.headers);
  } catch (error) {
    if (error instanceof RequestGuardError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes('Missing Firebase project ID')) {
      throw new RequestGuardError('SERVER_ERROR', 'AI authentication is not configured on the server.', 500);
    }

    throw new RequestGuardError('UNAUTHORIZED', 'Please sign in to use AI features.', 401);
  }

  try {
    enforceAiRateLimits(req.headers, decodedToken.uid);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('RATE_LIMITED')) {
      throw new RequestGuardError(
        'RATE_LIMITED',
        'Too many AI requests right now. Please wait a moment and try again.',
        429,
      );
    }

    throw error;
  }

  return { userId: decodedToken.uid };
}

export function sendGuardError(res: ServerlessResponse, error: RequestGuardError) {
  sendError(res, error.code, error.message, error.statusCode, error.details);
}
