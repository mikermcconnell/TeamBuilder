import type { UpdateSubRequestRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { updateSubRequest } from '../../src/server/sub-lottery/service.js';
import { assertCaptainRequestSession } from '../../src/server/sub-lottery/identityAuth.js';
export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) { await handleSubLotteryEndpoint<UpdateSubRequestRequest, Awaited<ReturnType<typeof updateSubRequest>>>(req, res, async body => { await assertCaptainRequestSession(req, body.requestId); return updateSubRequest(body); }); }
