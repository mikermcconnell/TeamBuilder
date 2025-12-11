export interface Player {
  id: string;
  name: string;
  gender: 'M' | 'F' | 'Other';
  skillRating: number;
  execSkillRating: number | null;  // null indicates "N/A" - no previous rating
  teammateRequests: string[];
  teammateRequestsParsed?: TeammateRequest[]; // Parsed with priority (first = must-have)
  avoidRequests: string[];
  teamId?: string;
  groupId?: string;
  email?: string;
  isHandler?: boolean;
  unfulfilledRequests?: UnfulfilledRequest[];
}

export interface TeamsData {
  id?: string;
  userId: string;
  rosterId?: string; // Link to the roster used
  name: string;
  description?: string;
  teams: Team[];
  unassignedPlayers: Player[];
  config: LeagueConfig;
  generationMethod?: 'balanced' | 'random' | 'manual';
  createdAt?: string | Date; // Allow both for Firestore compatibility
  updatedAt?: string | Date;
  isAutoSaved?: boolean;
}

// Priority for teammate requests - first request is must-have
export type RequestPriority = 'must-have' | 'nice-to-have';

// Parsed teammate request with priority
export interface TeammateRequest {
  name: string;
  priority: RequestPriority;
  status?: 'honored' | 'unfulfilled' | 'conflict';
  matchedPlayerId?: string; // ID of matched player if found
  reason?: string;
}

// Conflict between request and avoid
export interface RequestConflict {
  playerId: string;
  playerName: string;
  requestedPlayerId: string;
  requestedName: string;
  conflictType: 'avoid-vs-request' | 'one-way-request';
  description: string;
}

// Groups that almost formed but couldn't due to constraints
export interface NearMissGroup {
  playerIds: string[];
  playerNames: string[];
  reason: 'group-too-large' | 'would-exceed-team-size' | 'gender-constraints' | 'avoid-conflict';
  potentialSize: number;
}

// History entry for undo/redo
export interface GroupHistoryEntry {
  action: 'create' | 'delete' | 'add-player' | 'remove-player' | 'merge';
  timestamp: number;
  groupId: string;
  playerIds: string[];
  previousState?: PlayerGroup[];
}

export interface UnfulfilledRequest {
  playerId?: string;
  name: string;
  reason: 'non-reciprocal' | 'group-full' | 'conflict' | 'partial';
  priority: RequestPriority;
}

export interface PlayerGroup {
  id: string;
  label: string; // A, B, C, etc.
  color: string; // Color for visual identification
  playerIds: string[];
  players: Player[];
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
  averageSkill: number;
  genderBreakdown: {
    M: number;
    F: number;
    Other: number;
  };
  handlerCount?: number;
  isNameEditable?: boolean;
}

export interface LeagueConfig {
  id: string;
  name: string;
  maxTeamSize: number;
  minFemales: number;
  minMales: number;
  targetTeams?: number;
  allowMixedGender: boolean;
}

export interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  players: Player[];
  playerGroups: PlayerGroup[];
  conflicts?: RequestConflict[];
  nearMissGroups?: NearMissGroup[];
}

export interface TeamGenerationStats {
  totalPlayers: number;
  assignedPlayers: number;
  unassignedPlayers: number;
  mutualRequestsHonored: number;
  mutualRequestsBroken: number;
  mustHaveRequestsHonored: number;
  mustHaveRequestsBroken: number;
  niceToHaveRequestsHonored: number;
  niceToHaveRequestsBroken: number;
  avoidRequestsViolated: number;
  conflictsDetected: number;
  generationTime: number;
}

export interface AppState {
  players: Player[];
  teams: Team[];
  unassignedPlayers: Player[];
  playerGroups: PlayerGroup[];
  config: LeagueConfig;
  execRatingHistory: Record<string, { rating: number; updatedAt: number }>;
  stats?: TeamGenerationStats;
  savedConfigs: LeagueConfig[];
  pendingWarnings?: import('./StructuredWarning').StructuredWarning[]; // Warnings awaiting resolution on Roster page
}

export interface SavedWorkspace {
  id: string; // Firestore ID
  userId: string;
  name: string;
  description?: string;

  // The Data Snapshot
  players: Player[];
  playerGroups: PlayerGroup[];
  config: LeagueConfig;
  teams: Team[];          // Empty if not yet generated
  unassignedPlayers: Player[]; // Empty if not yet generated
  stats?: TeamGenerationStats;

  // Metadata
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  tags?: string[];
  version: number;
}

export type Gender = 'M' | 'F' | 'Other';

export interface CSVRow {
  [key: string]: string;
}

export interface DragItem {
  type: 'player';
  playerId: string;
  sourceTeamId?: string;
}

// Helper function to get the effective skill rating for a player
// When exec skill is available (not null), it overrides the regular skill
export function getEffectiveSkillRating(player: Player): number {
  return player.execSkillRating !== null ? player.execSkillRating : player.skillRating;
}
