/**
 * Application Configuration Constants
 * Centralized source of truth for all application limits, defaults, and configuration.
 */

// --- Validation Limits ---

// Player Limits
export const MAX_PLAYER_NAME_LENGTH = 50;
export const MAX_TEAMMATE_REQUESTS = 10;
export const MAX_AVOID_REQUESTS = 10;

// Team Limits
export const MAX_TEAM_NAME_LENGTH = 30;

// League/Config Limits
export const MAX_LEAGUE_NAME_LENGTH = 50;
export const MAX_TEAM_DESCRIPTION_LENGTH = 200;

// CSV Upload Limits
export const MAX_CSV_SIZE_BYTES = 1024 * 1024; // 1MB

// --- League Defaults & Constraints ---

export const MIN_TEAM_SIZE = 2;
export const MAX_TEAM_SIZE = 30;
export const DEFAULT_MAX_TEAM_SIZE = 12;

export const MIN_GENDER_COUNT = 0;
export const MAX_GENDER_COUNT = 15;
export const DEFAULT_MIN_FEMALES = 0;
export const DEFAULT_MIN_MALES = 0;

export const MIN_TARGET_TEAMS = 2;
export const MAX_TARGET_TEAMS = 50;

// --- AI Configuration ---

export const GEMINI_MODEL = "gemini-3-pro-preview";
export const DEFAULT_AI_MAX_RETRIES = 3;

// --- UI Constants ---

export const TOAST_DURATION = 3000;
export const DEFAULT_DEBOUNCE_MS = 300;
