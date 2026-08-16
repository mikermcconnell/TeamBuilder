import { assertAdminSession } from '../../src/server/sub-lottery/adminAuth.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { loadAdminOperations } from '../../src/server/sub-lottery/service.js';
export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) { await handleSubLotteryEndpoint<{ seasonId?: string }, Awaited<ReturnType<typeof loadAdminOperations>>>(req, res, body => { assertAdminSession(req); return loadAdminOperations(body.seasonId); }); }
