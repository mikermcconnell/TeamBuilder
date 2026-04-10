import { ZodError } from 'zod';

import {
  parseRequestBody,
  allowOnlyPost,
  ensureAiRequestSecurity,
  sendError,
  sendGuardError,
  sendSuccess,
  RequestGuardError,
  type ServerlessRequest,
  type ServerlessResponse,
} from '../../src/server/ai/http';
import { parseTeamDraftRequest } from '../../src/server/ai/guards';
import { generateTeamDraftWithFallback } from '../../src/server/ai/teamDraftOrchestrator';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (!allowOnlyPost(req, res)) {
    return;
  }

  try {
    await ensureAiRequestSecurity(req);
    const input = parseTeamDraftRequest(parseRequestBody(req.body));
    const response = await generateTeamDraftWithFallback(input);
    sendSuccess(res, response);
  } catch (error) {
    if (error instanceof RequestGuardError) {
      sendGuardError(res, error);
      return;
    }

    if (error instanceof ZodError) {
      sendError(res, 'BAD_REQUEST', 'Invalid request payload for team drafting.', 400, error.issues.map(issue => issue.message));
      return;
    }

    const message = error instanceof Error ? error.message : 'Failed to generate an AI team draft.';
    const statusCode = message.includes('OPENAI_API_KEY') ? 500 : 502;
    sendError(res, 'MODEL_ERROR', message, statusCode);
  }
}
