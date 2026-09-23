import adminImportPlayers from './sub-lottery/admin-import-players.js';
import adminImportSchedule from './sub-lottery/admin-import-schedule.js';
import adminLogin from './sub-lottery/admin-login.js';
import adminOperations from './sub-lottery/admin-operations.js';
import adminReplacement from './sub-lottery/admin-replacement.js';
import adminRetryEmail from './sub-lottery/admin-retry-email.js';
import adminTestEmail from './sub-lottery/admin-test-email.js';
import accessStatus from './sub-lottery/access-status.js';
import availability from './sub-lottery/availability.js';
import cancelRequest from './sub-lottery/cancel-request.js';
import createRequest from './sub-lottery/create-request.js';
import preferences from './sub-lottery/preferences.js';
import publicState from './sub-lottery/public-state.js';
import requestAccessCode from './sub-lottery/request-access-code.js';
import respond from './sub-lottery/respond.js';
import runDraw from './sub-lottery/run-draw.js';
import runDueDraws from './sub-lottery/run-due-draws.js';
import testingRunDraw from './sub-lottery/testing-run-draw.js';
import testingState from './sub-lottery/testing-state.js';
import updateRequest from './sub-lottery/update-request.js';
import verifyAccessCode from './sub-lottery/verify-access-code.js';
import { sendFailure, type SubLotteryServerlessRequest, type SubLotteryServerlessResponse } from '../src/server/sub-lottery/http.js';

type Handler = (req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) => Promise<void> | void;

const handlers: Record<string, Handler> = {
  'access-status': accessStatus,
  'admin-import-players': adminImportPlayers,
  'admin-import-schedule': adminImportSchedule,
  'admin-login': adminLogin,
  'admin-operations': adminOperations,
  'admin-replacement': adminReplacement,
  'admin-retry-email': adminRetryEmail,
  'admin-test-email': adminTestEmail,
  availability,
  'cancel-request': cancelRequest,
  'create-request': createRequest,
  preferences,
  'public-state': publicState,
  'request-access-code': requestAccessCode,
  respond,
  'run-draw': runDraw,
  'run-due-draws': runDueDraws,
  'testing-run-draw': testingRunDraw,
  'testing-state': testingState,
  'update-request': updateRequest,
  'verify-access-code': verifyAccessCode,
};

export default async function handler(req: SubLotteryServerlessRequest, res: SubLotteryServerlessResponse) {
  const route = new URL(req.url ?? '/', 'https://teambuilder.local').searchParams.get('route') ?? '';
  const routeHandler = handlers[route];

  if (!routeHandler) {
    sendFailure(res, 'Sub-lottery route not found.', 404);
    return;
  }

  await routeHandler(req, res);
}
