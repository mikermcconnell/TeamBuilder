import { assertAdminSession } from '../../src/server/sub-lottery/adminAuth.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { retryEmail } from '../../src/server/sub-lottery/service.js';
export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) { await handleSubLotteryEndpoint<{ notificationId: string }, void>(req, res, async body => { assertAdminSession(req); await retryEmail(body.notificationId); }); }
