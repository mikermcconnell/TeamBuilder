import { ZodError } from 'zod';

import { validateAiTeamDraft } from '../../src/shared/ai-draft';
import { parseRequestBody, allowOnlyPost, sendError, sendSuccess, type ServerlessRequest, type ServerlessResponse } from '../../src/server/ai/http';
import { parseTeamDraftRequest } from '../../src/server/ai/guards';
import { requestTeamDraft } from '../../src/server/ai/openaiService';
import type { LeagueConfig, Player, PlayerGroup } from '../../src/types';

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  if (!allowOnlyPost(req, res)) {
    return;
  }

  try {
    const input = parseTeamDraftRequest(parseRequestBody(req.body));
    const response = await requestTeamDraft(input);
    const players = input.players as Player[];
    const config = input.config as LeagueConfig;
    const playerGroups = input.playerGroups.map(group => ({
      ...group,
      color: '#000000',
      players: group.playerIds
        .map(playerId => players.find(player => player.id === playerId))
        .filter((player): player is Player => Boolean(player)),
    })) as PlayerGroup[];
    const validation = validateAiTeamDraft(response, players, config, playerGroups);

    if (!validation.valid) {
      sendError(res, 'VALIDATION_FAILED', 'The AI returned an invalid team draft.', 422, validation.errors);
      return;
    }

    sendSuccess(res, response);
  } catch (error) {
    if (error instanceof ZodError) {
      sendError(res, 'BAD_REQUEST', 'Invalid request payload for team drafting.', 400, error.issues.map(issue => issue.message));
      return;
    }

    const message = error instanceof Error ? error.message : 'Failed to generate an AI team draft.';
    const statusCode = message.includes('OPENAI_API_KEY') ? 500 : 502;
    sendError(res, 'MODEL_ERROR', message, statusCode);
  }
}
