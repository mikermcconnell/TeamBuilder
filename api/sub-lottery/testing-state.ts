import type { LoadTestingWeekRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { loadOrCreateTestingWeek } from '../../src/server/sub-lottery/service.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<LoadTestingWeekRequest, Awaited<ReturnType<typeof loadOrCreateTestingWeek>>>(
    req,
    res,
    body => loadOrCreateTestingWeek(Boolean(body.reset)),
  );
}
