import type { AdminImportPlayersRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { importSubPlayers } from '../../src/server/sub-lottery/service.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<AdminImportPlayersRequest, Awaited<ReturnType<typeof importSubPlayers>>>(
    req,
    res,
    body => importSubPlayers(body),
  );
}
