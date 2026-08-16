import type { UpdateSubRequestRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { updateSubRequest } from '../../src/server/sub-lottery/service.js';
export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) { await handleSubLotteryEndpoint<UpdateSubRequestRequest, Awaited<ReturnType<typeof updateSubRequest>>>(req, res, updateSubRequest); }
