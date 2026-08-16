import type { UpdatePreferencesRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { updatePlayerPreferences } from '../../src/server/sub-lottery/service.js';
export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) { await handleSubLotteryEndpoint<UpdatePreferencesRequest, Awaited<ReturnType<typeof updatePlayerPreferences>>>(req, res, updatePlayerPreferences); }
