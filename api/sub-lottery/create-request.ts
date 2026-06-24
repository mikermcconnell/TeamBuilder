import type { CreateSubRequestRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { createSubRequest } from '../../src/server/sub-lottery/service.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<CreateSubRequestRequest, Awaited<ReturnType<typeof createSubRequest>>>(
    req,
    res,
    body => createSubRequest(body),
  );
}
