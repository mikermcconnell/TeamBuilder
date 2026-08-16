import type { SubLotteryWinnerEmailNotification } from '../../src/sub-lottery/types.js';
import { assertAdminSession } from '../../src/server/sub-lottery/adminAuth.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { sendSafeTestEmail } from '../../src/server/sub-lottery/service.js';
export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) { await handleSubLotteryEndpoint<{ template: SubLotteryWinnerEmailNotification['kind'] }, Awaited<ReturnType<typeof sendSafeTestEmail>>>(req, res, body => { assertAdminSession(req); return sendSafeTestEmail(body.template); }); }
