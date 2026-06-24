import type { LoadPublicStateRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { loadPublicSubLotteryState } from '../../src/server/sub-lottery/service.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<LoadPublicStateRequest, Awaited<ReturnType<typeof loadPublicSubLotteryState>>>(
    req,
    res,
    body => loadPublicSubLotteryState(body.seasonId),
  );
}
