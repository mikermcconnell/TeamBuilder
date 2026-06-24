import { sendFailure, sendSuccess, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { runDueDrawsAndLoadState } from '../../src/server/sub-lottery/service.js';

function getHeader(req: SubLotteryServerlessRequest, name: string): string | undefined {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendFailure(res, 'Only GET requests are supported.', 405);
    return;
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && getHeader(req, 'authorization') !== `Bearer ${cronSecret}`) {
    sendFailure(res, 'Unauthorized.', 401);
    return;
  }

  try {
    const state = await runDueDrawsAndLoadState();
    sendSuccess(res, state);
  } catch (error) {
    sendFailure(res, error instanceof Error ? error.message : 'Due draws failed.', 400);
  }
}
