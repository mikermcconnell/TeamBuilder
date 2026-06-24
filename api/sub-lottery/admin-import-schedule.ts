import type { AdminImportScheduleRequest } from '../../src/sub-lottery/apiContracts.js';
import { handleSubLotteryEndpoint, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../../src/server/sub-lottery/http.js';
import { importSubSchedule } from '../../src/server/sub-lottery/service.js';

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  await handleSubLotteryEndpoint<AdminImportScheduleRequest, Awaited<ReturnType<typeof importSubSchedule>>>(
    req,
    res,
    body => importSubSchedule(body),
  );
}
