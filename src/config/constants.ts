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

// Age highlighting thresholds
export const YOUNG_PLAYER_MAX_AGE = 21; // under 22
export const WISE_PLAYER_MIN_AGE = 44; // over 43

// --- AI Configuration ---

export const OPENAI_MODEL = 'gpt-5.4';
export const DEFAULT_AI_MAX_RETRIES = 3;
export const MAX_AI_REQUEST_BYTES = 512 * 1024; // 512 KB

// --- UI Constants ---

export const TOAST_DURATION = 3000;
export const DEFAULT_DEBOUNCE_MS = 300;
