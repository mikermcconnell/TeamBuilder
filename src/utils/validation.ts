/**
 * Input validation utilities to prevent XSS and ensure data integrity
 */

import { Player, LeagueConfig, AppState } from '@/types';

/**
 * Sanitizes a string input to prevent XSS attacks
 *
 * @param input The string to sanitize
 * @param maxLength Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength = 100): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags and dangerous characters
  const sanitized = input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>&]/g, (char) => {
      // Escape only truly dangerous characters for XSS prevention
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

/**
 * Validates and sanitizes a player name
 *
 * @param name The player name to validate
 * @returns Sanitized player name
 */
export function validatePlayerName(name: string): string {
  const sanitized = sanitizeString(name, 50);

  if (sanitized.length < 1) {
    throw new Error('Player name cannot be empty');
  }

  return sanitized;
}

/**
 * Validates a skill rating value
 *
 * @param rating The skill rating to validate
 * @returns Valid skill rating between 1 and 10
 */
export function validateSkillRating(rating: number): number {
  const parsed = Number(rating);

  if (isNaN(parsed)) {
    return 5; // Default to middle value
  }

  // Clamp between 1 and 10
  return Math.max(1, Math.min(10, Math.round(parsed)));
}

/**
 * Validates teammate/avoid requests array
 *
 * @param requests Array of player names
 * @returns Sanitized array of requests
 */
export function validateRequests(requests: string[]): string[] {
  if (!Array.isArray(requests)) {
    return [];
  }

  return requests
    .filter(req => typeof req === 'string' && req.trim().length > 0)
    .map(req => sanitizeString(req, 50))
    .slice(0, 10); // Limit to 10 requests
}

/**
 * Validates a complete Player object
 *
 * @param player The player to validate
 * @returns Validated player object
 */
export function validatePlayer(player: any): Player | null {
  try {
    if (!player || typeof player !== 'object') {
      return null;
    }

    return {
      id: player.id || `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: validatePlayerName(player.name),
      gender: ['M', 'F', 'Other'].includes(player.gender) ? player.gender : 'Other',
      skillRating: validateSkillRating(player.skillRating),
      execSkillRating: player.execSkillRating !== undefined && player.execSkillRating !== null
        ? validateSkillRating(player.execSkillRating)
        : null,
      teammateRequests: validateRequests(player.teammateRequests || []),
      avoidRequests: validateRequests(player.avoidRequests || []),
      teamId: player.teamId || undefined,
      groupId: player.groupId || undefined,
      email: player.email || undefined,
      isHandler: typeof player.isHandler === 'boolean' ? player.isHandler : undefined,
    };
  } catch (error) {
    console.error('Player validation failed:', error);
    return null;
  }
}

/**
 * Validates league configuration
 *
 * @param config The configuration to validate
 * @returns Validated configuration
 */
export function validateLeagueConfig(config: any): LeagueConfig {
  const defaults: LeagueConfig = {
    id: 'default',
    name: 'Default League',
    maxTeamSize: 12,
    minFemales: 0,
    minMales: 0,
    allowMixedGender: true,
  };

  if (!config || typeof config !== 'object') {
    return defaults;
  }

  return {
    id: config.id || defaults.id,
    name: sanitizeString(config.name || defaults.name, 50),
    maxTeamSize: Math.max(2, Math.min(30, Number(config.maxTeamSize) || defaults.maxTeamSize)),
    minFemales: Math.max(0, Math.min(15, Number(config.minFemales) || defaults.minFemales)),
    minMales: Math.max(0, Math.min(15, Number(config.minMales) || defaults.minMales)),
    targetTeams: config.targetTeams ? Math.max(2, Math.min(50, Number(config.targetTeams))) : undefined,
    allowMixedGender: Boolean(config.allowMixedGender),
  };
}

/**
 * Validates the complete app state structure
 *
 * @param state The state to validate
 * @returns Whether the state is valid
 */
export function validateAppState(state: any): state is AppState {
  if (!state || typeof state !== 'object') {
    return false;
  }

  const requiredKeys = ['players', 'teams', 'unassignedPlayers', 'config'];

  for (const key of requiredKeys) {
    if (!(key in state)) {
      return false;
    }
  }

  // Validate arrays
  if (!Array.isArray(state.players) ||
    !Array.isArray(state.teams) ||
    !Array.isArray(state.unassignedPlayers)) {
    return false;
  }

  // Validate config
  if (!state.config || typeof state.config !== 'object') {
    return false;
  }

  // Validate execRatingHistory (allow migration from old format)
  if (state.execRatingHistory && typeof state.execRatingHistory !== 'object') {
    return false;
  }

  return true;
}

/**
 * Sanitizes and validates CSV data
 *
 * @param data Raw CSV data
 * @returns Sanitized CSV data
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
    .slice(0, 1024 * 1024); // Limit to 1MB
}

/**
 * Validates team name
 *
 * @param name Team name to validate
 * @returns Sanitized team name
 */
export function validateTeamName(name: string): string {
  return sanitizeString(name, 30);
}