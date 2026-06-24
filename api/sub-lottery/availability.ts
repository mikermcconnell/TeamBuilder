import type { MarkAvailabilityRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { markPlayerAvailable } from '../../src/server/sub-lottery/service.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<MarkAvailabilityRequest, Awaited<ReturnType<typeof markPlayerAvailable>>>(
    req,
    res,
    body => markPlayerAvailable(body.requestId, body.playerId),
  );
}
