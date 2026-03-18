import type {
  AITeamDraftPayload,
  ApiResult,
  GroupSuggestionsRequest,
  NameMatchDto,
  NameMatchRequest,
  SuggestedGroupDto,
  TeamDraftRequest,
  TeamSuggestionDto,
  TeamSuggestionsRequest,
} from '@/shared/ai-contracts';

async function postJson<TRequest, TResponse>(url: string, payload: TRequest): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  if (!response.ok) {
    const message = (
      typeof json === 'object'
      && json !== null
      && 'error' in json
      && typeof json.error === 'object'
      && json.error !== null
      && 'message' in json.error
      && typeof json.error.message === 'string'
    )
      ? json.error.message
      : undefined;

    if (response.status === 404) {
      throw new Error('AI routes are not available in Vite-only dev mode. Run "pnpm dev:vercel" to use the server-side AI features locally.');
    }

    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return json as TResponse;
}

function unwrapResult<T>(result: ApiResult<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function fetchTeamSuggestions(payload: TeamSuggestionsRequest): Promise<TeamSuggestionDto[]> {
  const result = await postJson<TeamSuggestionsRequest, ApiResult<TeamSuggestionDto[]>>('/api/ai/team-suggestions', payload);
  return unwrapResult(result);
}

export async function fetchNameMatches(payload: NameMatchRequest): Promise<NameMatchDto[]> {
  const result = await postJson<NameMatchRequest, ApiResult<NameMatchDto[]>>('/api/ai/name-match', payload);
  return unwrapResult(result);
}

export async function fetchGroupSuggestions(payload: GroupSuggestionsRequest): Promise<SuggestedGroupDto[]> {
  const result = await postJson<GroupSuggestionsRequest, ApiResult<SuggestedGroupDto[]>>('/api/ai/group-suggestions', payload);
  return unwrapResult(result);
}

export async function fetchTeamDraft(payload: TeamDraftRequest): Promise<AITeamDraftPayload> {
  const result = await postJson<TeamDraftRequest, ApiResult<AITeamDraftPayload>>('/api/ai/team-draft', payload);
  return unwrapResult(result);
}
