import type { RunTestingDrawRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { runTestingWeekDraw } from '../../src/server/sub-lottery/service.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<RunTestingDrawRequest, Awaited<ReturnType<typeof runTestingWeekDraw>>>(
    req,
    res,
    body => runTestingWeekDraw(body.seasonId),
  );
}
