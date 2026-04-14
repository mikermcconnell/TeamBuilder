export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'MODEL_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR';

export interface ApiErrorShape {
  code: ApiErrorCode;
  message: string;
  details?: string[];
}

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: ApiErrorShape;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type AIGender = 'M' | 'F' | 'Other';
export type TeamDestinationId = string | 'unassigned';
export type SuggestionType = 'move' | 'swap';
export type SuggestionConfidence = 'high' | 'medium' | 'low';

export interface AIPlayerInput {
  id: string;
  name: string;
  gender: AIGender;
  skillRating: number;
  execSkillRating: number | null;
  isHandler?: boolean;
  teammateRequests: string[];
  avoidRequests: string[];
  teamId?: string;
  groupId?: string;
}

export interface AITeamInput {
  id: string;
  name: string;
  players: Array<{ id: string }>;
  averageSkill: number;
  genderBreakdown: {
    M: number;
    F: number;
    Other: number;
  };
  handlerCount?: number;
}

export interface AILeagueConfigInput {
  id: string;
  name: string;
  maxTeamSize: number;
  minFemales: number;
  minMales: number;
  targetTeams?: number;
  allowMixedGender: boolean;
  restrictToEvenTeams?: boolean;
}

export interface AIPlayerGroupInput {
  id: string;
  label: string;
  playerIds: string[];
}

export interface TeamSuggestionAction {
  playerId: string;
  sourceTeamId: TeamDestinationId;
  targetTeamId: TeamDestinationId;
}

export interface TeamSuggestionDto {
  id: string;
  type: SuggestionType;
  title: string;
  reasoning: string;
  actions: TeamSuggestionAction[];
}

export interface NameMatchDto {
  requested: string;
  matched: string | null;
  confidence: number;
  reasoning: string;
}

export interface SuggestedGroupDto {
  id: string;
  playerIds: string[];
  playerNames: string[];
  avgSkill: number;
  reasoning: string;
  confidence: SuggestionConfidence;
}

export interface TeamSuggestionsRequest {
  prompt: string;
  players: AIPlayerInput[];
  teams: AITeamInput[];
  config: AILeagueConfigInput;
  playerGroups: AIPlayerGroupInput[];
}

export interface NameMatchRequest {
  rosterNames: string[];
  requestedNames: string[];
}

export interface GroupSuggestionsRequest {
  players: AIPlayerInput[];
  existingGroups: AIPlayerGroupInput[];
}

export interface TeamDraftRequest {
  players: AIPlayerInput[];
  config: AILeagueConfigInput;
  playerGroups: AIPlayerGroupInput[];
  variant?: 'primary' | 'alternate';
}

export interface AITeamDraftPayload {
  source?: 'ai' | 'fallback';
  summary?: string;
  requestedModel?: string;
  model?: string;
  responseId?: string;
  responseIds?: string[];
  teams: Array<{
    slot: number;
    playerIds: string[];
  }>;
  unassignedPlayerIds?: string[];
}
