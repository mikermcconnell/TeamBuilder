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
} from '../../src/server/ai/http.js';
import { parseGroupSuggestionsRequest, validateGroupSuggestions } from '../../src/server/ai/guards.js';
import { requestGroupSuggestions } from '../../src/server/ai/openaiService.js';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (!allowOnlyPost(req, res)) {
    return;
  }

  try {
    await ensureAiRequestSecurity(req);
    const input = parseGroupSuggestionsRequest(parseRequestBody(req.body));
    const response = await requestGroupSuggestions(input);
    const suggestions = validateGroupSuggestions(input, response.suggestions);
    sendSuccess(res, suggestions);
  } catch (error) {
    if (error instanceof RequestGuardError) {
      sendGuardError(res, error);
      return;
    }

    if (error instanceof ZodError) {
      sendError(res, 'BAD_REQUEST', 'Invalid request payload for group suggestions.', 400, error.issues.map(issue => issue.message));
      return;
    }

    const message = error instanceof Error ? error.message : 'Failed to generate group suggestions.';
    const statusCode = (
      message.includes('OPENAI_API_KEY')
      || message.includes('GEMMA_MODEL')
    ) ? 500 : 502;
    sendError(res, 'MODEL_ERROR', message, statusCode);
  }
}
