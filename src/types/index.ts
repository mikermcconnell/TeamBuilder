export interface Player {
  id: string;
  name: string;
  gender: 'M' | 'F' | 'Other';
  skillRating: number;
  execSkillRating: number | null;  // null indicates "N/A" - no previous rating
  teammateRequests: string[];
  avoidRequests: string[];
  teamId?: string;
  groupId?: string;
  email?: string;
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
}

export interface TeamGenerationStats {
  totalPlayers: number;
  assignedPlayers: number;
  unassignedPlayers: number;
  mutualRequestsHonored: number;
  mutualRequestsBroken: number;
  avoidRequestsViolated: number;
  generationTime: number;
}

export interface AppState {
  players: Player[];
  teams: Team[];
  unassignedPlayers: Player[];
  playerGroups: PlayerGroup[];
  config: LeagueConfig;
  stats?: TeamGenerationStats;
  savedConfigs: LeagueConfig[];
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
