import type { CreateSubRequestRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { createSubRequest } from '../../src/server/sub-lottery/service.js';
import { assertIdentitySession } from '../../src/server/sub-lottery/identityAuth.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<CreateSubRequestRequest, Awaited<ReturnType<typeof createSubRequest>>>(
    req,
    res,
    async body => { await assertIdentitySession(req, 'captain', body.scheduleEntryId); return createSubRequest(body); },
  );
}
