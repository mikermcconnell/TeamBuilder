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
import { parseTeamSuggestionsRequest, validateTeamSuggestions } from '../../src/server/ai/guards';
import { requestTeamSuggestions } from '../../src/server/ai/openaiService';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (!allowOnlyPost(req, res)) {
    return;
  }

  try {
    await ensureAiRequestSecurity(req);
    const input = parseTeamSuggestionsRequest(parseRequestBody(req.body));
    const response = await requestTeamSuggestions(input);
    const suggestions = validateTeamSuggestions(input, response.suggestions);

    if (suggestions.length === 0) {
      sendError(res, 'VALIDATION_FAILED', 'The AI response did not contain any usable team suggestions.', 422);
      return;
    }

    sendSuccess(res, suggestions);
  } catch (error) {
    if (error instanceof RequestGuardError) {
      sendGuardError(res, error);
      return;
    }

    if (error instanceof ZodError) {
      sendError(res, 'BAD_REQUEST', 'Invalid request payload for team suggestions.', 400, error.issues.map(issue => issue.message));
      return;
    }

    const message = error instanceof Error ? error.message : 'Failed to generate team suggestions.';
    const statusCode = (
      message.includes('OPENAI_API_KEY')
      || message.includes('GEMMA_MODEL')
    ) ? 500 : 502;
    sendError(res, 'MODEL_ERROR', message, statusCode);
  }
}
