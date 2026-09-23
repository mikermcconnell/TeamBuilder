import type { AccessStatusRequest } from '../../src/sub-lottery/apiContracts.js';
import { hasIdentitySession } from '../../src/server/sub-lottery/identityAuth.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<AccessStatusRequest, { verified: boolean }>(req, res, async body => ({
    verified: hasIdentitySession(req, body.kind, body.subjectId),
  }));
}
