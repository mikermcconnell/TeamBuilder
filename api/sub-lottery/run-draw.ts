import type { RunDrawRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { runDrawAndLoadState } from '../../src/server/sub-lottery/service.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<RunDrawRequest, Awaited<ReturnType<typeof runDrawAndLoadState>>>(
    req,
    res,
    body => runDrawAndLoadState(body.requestId),
  );
}
