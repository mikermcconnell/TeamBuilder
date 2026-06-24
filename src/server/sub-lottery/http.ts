import type { ApiFailure, ApiSuccess } from '../../sub-lottery/apiContracts.js';

export interface SubLotteryServerlessRequest {
  method?: string;
  body?: unknown;
}

export interface SubLotteryServerlessResponse {
  status: (code: number) => SubLotteryServerlessResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
}

export function allowOnlyPost(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse): boolean {
  if (req.method === 'POST') return true;
  res.setHeader('Allow', 'POST');
  sendFailure(res, 'Only POST requests are supported.', 405);
  return false;
}

export function parseBody<T>(body: unknown): T {
  if (typeof body === 'string') {
    return JSON.parse(body) as T;
  }
  return body as T;
}

export function sendSuccess<T>(res: SubLotteryServerlessResponse, data: T) {
  const body: ApiSuccess<T> = { ok: true, data };
  res.status(200).json(body);
}

export function sendFailure(res: SubLotteryServerlessResponse, error: string, statusCode = 400) {
  const body: ApiFailure = { ok: false, error };
  res.status(statusCode).json(body);
}

export async function handleSubLotteryEndpoint<TBody, TData>(
  req: SubLotteryServerlessRequest,
  res: SubLotteryServerlessResponse,
  action: (body: TBody) => Promise<TData>,
) {
  if (!allowOnlyPost(req, res)) return;

  try {
    const data = await action(parseBody<TBody>(req.body ?? {}));
    sendSuccess(res, data);
  } catch (error) {
    sendFailure(res, error instanceof Error ? error.message : 'Sub lottery request failed.', 400);
  }
}
