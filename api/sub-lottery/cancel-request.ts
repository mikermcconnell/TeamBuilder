import type { CancelSubRequestRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { cancelSubRequest } from '../../src/server/sub-lottery/service.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<CancelSubRequestRequest, Awaited<ReturnType<typeof cancelSubRequest>>>(
    req,
    res,
    body => cancelSubRequest(body),
  );
}
