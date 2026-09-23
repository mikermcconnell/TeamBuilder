import type { RequestAccessCodeRequest } from '../../src/sub-lottery/apiContracts.js';
import { requestAccessCode } from '../../src/server/sub-lottery/identityAuth.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<RequestAccessCodeRequest, { sent: true }>(req, res, async body => {
    await requestAccessCode(body);
    return { sent: true };
  });
}
