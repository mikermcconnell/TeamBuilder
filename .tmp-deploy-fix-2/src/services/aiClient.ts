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
import { auth } from '@/config/firebase';
import { getCurrentUser } from './authService';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser ?? await getCurrentUser();
  if (!currentUser) {
    return {};
  }

  const token = await currentUser.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function postJson<TRequest, TResponse>(url: string, payload: TRequest): Promise<TResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();
  let json: unknown = null;

  if (rawBody) {
    try {
      json = JSON.parse(rawBody) as unknown;
    } catch {
      json = null;
    }
  }

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
    const details = (
      typeof json === 'object'
      && json !== null
      && 'error' in json
      && typeof json.error === 'object'
      && json.error !== null
      && 'details' in json.error
      && Array.isArray(json.error.details)
    )
      ? json.error.details.filter((detail): detail is string => typeof detail === 'string')
      : [];

    throw new Error([
      message || `Request failed with status ${response.status}`,
      ...details,
    ].join(details.length > 0 ? '\n' : ''));
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
