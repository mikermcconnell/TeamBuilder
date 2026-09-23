import type { CancelSubRequestRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { cancelSubRequest } from '../../src/server/sub-lottery/service.js';
import { assertCaptainRequestSession } from '../../src/server/sub-lottery/identityAuth.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<CancelSubRequestRequest, Awaited<ReturnType<typeof cancelSubRequest>>>(
    req,
    res,
    async body => { await assertCaptainRequestSession(req, body.requestId); return cancelSubRequest(body); },
  );
}
