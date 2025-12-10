/**
 * Input validation utilities using Zod schemas
 */

import { z } from 'zod';
import { Player, LeagueConfig, AppState, TeamsData } from '@/types';
import {
  MAX_PLAYER_NAME_LENGTH,
  MAX_TEAMMATE_REQUESTS,
  MAX_AVOID_REQUESTS,
  MAX_TEAM_NAME_LENGTH,
  MAX_LEAGUE_NAME_LENGTH,
  MAX_TEAM_DESCRIPTION_LENGTH,
  MIN_TEAM_SIZE,
  MAX_TEAM_SIZE,
  DEFAULT_MAX_TEAM_SIZE,
  MIN_GENDER_COUNT,
  MAX_GENDER_COUNT,
  DEFAULT_MIN_FEMALES,
  DEFAULT_MIN_MALES,
  MIN_TARGET_TEAMS,
  MAX_TARGET_TEAMS,
  MAX_CSV_SIZE_BYTES
} from '@/config/constants';

/**
 * Sanitizes a string input to prevent XSS attacks
 * Used as a transform in Zod schemas
 */
export function sanitizeString(input: string, maxLength = 100): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags and dangerous characters
  const sanitized = input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>&]/g, (char) => {
      const escapeMap: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
      };
      return escapeMap[char] || char;
    })
    .trim()
    .slice(0, maxLength);

  return sanitized;
}

// --- Zod Schemas ---

export const PlayerSchema = z.object({
  id: z.string().default(() => `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
  name: z.string().min(1, "Player name cannot be empty").transform(val => sanitizeString(val, MAX_PLAYER_NAME_LENGTH)),
  gender: z.enum(['M', 'F', 'Other']).default('Other'),
  skillRating: z.number().min(1).max(10).catch(5), // Default to 5 if invalid
  execSkillRating: z.number().min(1).max(10).nullable().default(null),
  teammateRequests: z.array(z.string().transform(val => sanitizeString(val, MAX_PLAYER_NAME_LENGTH)))
    .default([])
    .transform(arr => arr.slice(0, MAX_TEAMMATE_REQUESTS)),
  avoidRequests: z.array(z.string().transform(val => sanitizeString(val, MAX_PLAYER_NAME_LENGTH)))
    .default([])
    .transform(arr => arr.slice(0, MAX_AVOID_REQUESTS)),
  teamId: z.string().optional(),
  groupId: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')).optional(),
  isHandler: z.boolean().optional(),
  unfulfilledRequests: z.array(z.object({
    playerId: z.string().optional(),
    name: z.string(),
    reason: z.enum(['non-reciprocal', 'group-full'])
  })).optional()
});

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string().transform(val => sanitizeString(val, MAX_TEAM_NAME_LENGTH)),
  players: z.array(PlayerSchema),
  averageSkill: z.number().default(0),
  genderBreakdown: z.object({
    M: z.number().default(0),
    F: z.number().default(0),
    Other: z.number().default(0)
  }),
  handlerCount: z.number().optional(),
  isNameEditable: z.boolean().optional()
});

export const LeagueConfigSchema = z.object({
  id: z.string().default('default'),
  name: z.string().default('Default League').transform(val => sanitizeString(val, MAX_LEAGUE_NAME_LENGTH)),
  maxTeamSize: z.number().min(MIN_TEAM_SIZE).max(MAX_TEAM_SIZE).default(DEFAULT_MAX_TEAM_SIZE),
  minFemales: z.number().min(MIN_GENDER_COUNT).max(MAX_GENDER_COUNT).default(DEFAULT_MIN_FEMALES),
  minMales: z.number().min(MIN_GENDER_COUNT).max(MAX_GENDER_COUNT).default(DEFAULT_MIN_MALES),
  targetTeams: z.number().min(MIN_TARGET_TEAMS).max(MAX_TARGET_TEAMS).optional(),
  allowMixedGender: z.boolean().default(true),
});

// AppState validation is complex due to nested structures, 
// but we can define parts of it.
export const AppStateSchema = z.object({
  players: z.array(PlayerSchema),
  teams: z.array(TeamSchema),
  unassignedPlayers: z.array(PlayerSchema),
  config: LeagueConfigSchema,
}).passthrough();

export const TeamsDataSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  rosterId: z.string().optional(),
  name: z.string().transform(val => sanitizeString(val, MAX_LEAGUE_NAME_LENGTH)),
  description: z.string().optional().transform(val => val ? sanitizeString(val, MAX_TEAM_DESCRIPTION_LENGTH) : undefined),
  teams: z.array(TeamSchema),
  unassignedPlayers: z.array(PlayerSchema),
  config: LeagueConfigSchema,
  generationMethod: z.enum(['balanced', 'random', 'manual']).optional(),
  createdAt: z.instanceof(Date).optional(),
  updatedAt: z.instanceof(Date).optional(),
  isAutoSaved: z.boolean().optional(),
});


// --- Exported Validation Functions (Wrappers) ---

/**
 * Validates and sanitizes a player name
 */
export function validatePlayerName(name: string): string {
  try {
    return PlayerSchema.shape.name.parse(name);
  } catch (e) {
    if (e instanceof z.ZodError) throw new Error(e.errors[0].message);
    throw e;
  }
}

/**
 * Validates a skill rating value
 */
export function validateSkillRating(rating: number): number {
  return PlayerSchema.shape.skillRating.parse(rating);
}

/**
 * Validates request arrays
 */
export function validateRequests(requests: string[]): string[] {
  return PlayerSchema.shape.teammateRequests.parse(requests);
}

/**
 * Validates a complete Player object
 */
export function validatePlayer(player: any): Player | null {
  const result = PlayerSchema.safeParse(player);
  if (result.success) {
    return result.data as Player;
  }
  console.error('Player validation failed:', result.error);
  return null;
}

/**
 * Validates league configuration
 */
export function validateLeagueConfig(config: any): LeagueConfig {
  const result = LeagueConfigSchema.safeParse(config);
  if (result.success) {
    return result.data as LeagueConfig;
  }
  console.warn('Invalid league config, using defaults:', result.error);
  return LeagueConfigSchema.parse({}); // Return clean defaults
}

/**
 * Validates the complete app state structure
 */
export function validateAppState(state: any): state is AppState {
  return AppStateSchema.safeParse(state).success;
}

/**
 * Validates team name
 */
export function validateTeamName(name: string): string {
  return TeamSchema.shape.name.parse(name);
}

/**
 * Validates teams data structure
 */
export function validateTeamsData(data: any): TeamsData {
  const result = TeamsDataSchema.safeParse(data);
  if (result.success) {
    // Asserting types because Zod transforms/defaults make exact type matching tricky
    return result.data as unknown as TeamsData;
  }
  throw new Error(`Invalid teams data: ${result.error.message}`);
}

/**
 * Sanitizes and validates CSV data
 * Keeps original simple string replacement as Zod isn't great for streaming/large text blob sanitization logic
 */
export function sanitizeCSVData(data: string): string {
  if (typeof data !== 'string') {
    return '';
  }

  // Remove potentially dangerous content
  return data
    .replace(/=FORMULA/gi, '') // Prevent formula injection
    .replace(/=cmd/gi, '')
    .replace(/=HYPERLINK/gi, '')
    .slice(0, MAX_CSV_SIZE_BYTES);
}
