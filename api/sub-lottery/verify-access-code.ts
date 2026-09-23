import type { VerifyAccessCodeRequest } from '../../src/sub-lottery/apiContracts.js';
import { verifyAccessCode } from '../../src/server/sub-lottery/identityAuth.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<VerifyAccessCodeRequest, { verified: true }>(req, res, async body => {
    res.setHeader('Set-Cookie', await verifyAccessCode(body));
    return { verified: true };
  });
}
