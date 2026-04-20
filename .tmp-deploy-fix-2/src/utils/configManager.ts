import { LeagueConfig, Player } from '@/types';
import { getEffectiveTeamCount, normalizeLeagueConfig } from '@/utils/teamCount';

const STORAGE_KEY = 'teambuilder-configs';
const DEFAULT_CONFIG_KEY = 'teambuilder-default-config';

export const BUILT_IN_LEAGUE_PRESETS: LeagueConfig[] = [
  normalizeLeagueConfig({
    id: 'preset-indoor-5v5',
    name: 'Indoor 5v5',
    maxTeamSize: 5,
    minFemales: 2,
    minMales: 0,
    allowMixedGender: true
  }),
  normalizeLeagueConfig({
    id: 'preset-summer-league',
    name: 'Summer League',
    maxTeamSize: 14,
    minFemales: 3,
    minMales: 0,
    allowMixedGender: true
  }),
  normalizeLeagueConfig({
    id: 'preset-hat-tournament',
    name: 'Hat Tournament',
    maxTeamSize: 7,
    minFemales: 2,
    minMales: 0,
    allowMixedGender: true
  }),
  normalizeLeagueConfig({
    id: 'preset-youth-clinic',
    name: 'Youth Clinic',
    maxTeamSize: 8,
    minFemales: 0,
    minMales: 0,
    allowMixedGender: true
  })
];

export function loadLeaguePresets(): LeagueConfig[] {
  return BUILT_IN_LEAGUE_PRESETS;
}

export function getDefaultConfig(): LeagueConfig {
  const saved = localStorage.getItem(DEFAULT_CONFIG_KEY);
  if (saved) {
    try {
      return normalizeLeagueConfig(JSON.parse(saved));
    } catch (error) {
      console.warn('Failed to parse saved default config:', error);
    }
  }

  return normalizeLeagueConfig({
    id: 'default',
    name: 'Default League',
    maxTeamSize: 12,
    minFemales: 2,
    minMales: 0,
    allowMixedGender: true
  });
}

export function saveDefaultConfig(config: LeagueConfig): void {
  try {
    localStorage.setItem(DEFAULT_CONFIG_KEY, JSON.stringify(normalizeLeagueConfig(config)));
  } catch (error) {
    console.error('Failed to save default config:', error);
  }
}

export function loadSavedConfigs(): LeagueConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const configs = JSON.parse(saved);
      return Array.isArray(configs) ? configs.map(config => normalizeLeagueConfig(config)) : [];
    }
  } catch (error) {
    console.warn('Failed to load saved configs:', error);
  }
  
  return [];
}

export function saveConfigs(configs: LeagueConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs.map(config => normalizeLeagueConfig(config))));
  } catch (error) {
    console.error('Failed to save configs:', error);
  }
}

export function saveConfig(config: LeagueConfig): void {
  const configs = loadSavedConfigs();
  const existingIndex = configs.findIndex(c => c.id === config.id);
  const normalizedConfig = normalizeLeagueConfig(config);
  
  if (existingIndex >= 0) {
    configs[existingIndex] = normalizedConfig;
  } else {
    configs.push(normalizedConfig);
  }
  
  saveConfigs(configs);
}

export function updateConfig(configId: string, updates: Partial<LeagueConfig>): LeagueConfig | null {
  const configs = loadSavedConfigs();
  const existingIndex = configs.findIndex(config => config.id === configId);

  if (existingIndex < 0) {
    return null;
  }

  const updatedConfig = {
    ...configs[existingIndex],
    ...updates,
    id: configs[existingIndex].id,
  };

  configs[existingIndex] = normalizeLeagueConfig(updatedConfig);
  saveConfigs(configs);

  return configs[existingIndex] ?? null;
}

export function deleteConfig(configId: string): void {
  const configs = loadSavedConfigs();
  const filtered = configs.filter(c => c.id !== configId);
  saveConfigs(filtered);
}

export function duplicateConfig(config: LeagueConfig, name: string): LeagueConfig {
  const duplicate = normalizeLeagueConfig({
    ...config,
    id: generateConfigId(name),
    name,
  });

  saveConfig(duplicate);
  return duplicate;
}

export function createConfigFromTemplate(name: string, template: LeagueConfig): LeagueConfig {
  return normalizeLeagueConfig({
    ...template,
    id: generateConfigId(name),
    name
  });
}

export function generateConfigId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
}

export function getConfiguredTeamCount(
  playerCount: number,
  config: Pick<LeagueConfig, 'maxTeamSize' | 'targetTeams' | 'restrictToEvenTeams'>
): number {
  return getEffectiveTeamCount(playerCount, config);
}

export function getRosterFeasibilityWarnings(
  players: Pick<Player, 'gender'>[],
  config: Pick<LeagueConfig, 'maxTeamSize' | 'targetTeams' | 'minFemales' | 'minMales' | 'restrictToEvenTeams'>
): string[] {
  const configuredTeamCount = getConfiguredTeamCount(players.length, config);

  if (configuredTeamCount <= 0) {
    return [];
  }

  const genderCounts = players.reduce((totals, player) => {
    totals[player.gender] += 1;
    return totals;
  }, { M: 0, F: 0, Other: 0 });

  const warnings: string[] = [];
  const requiredFemales = config.minFemales * configuredTeamCount;
  const requiredMales = config.minMales * configuredTeamCount;

  if (genderCounts.F < requiredFemales) {
    warnings.push(
      `Current setup needs ${requiredFemales} female players across ${configuredTeamCount} teams, but the roster only has ${genderCounts.F}. Team generation will continue, but some teams may miss the female minimum.`
    );
  }

  if (genderCounts.M < requiredMales) {
    warnings.push(
      `Current setup needs ${requiredMales} male players across ${configuredTeamCount} teams, but the roster only has ${genderCounts.M}. Team generation will continue, but some teams may miss the male minimum.`
    );
  }

  return warnings;
}

export function validateConfig(config: LeagueConfig, playerCount = 0): string[] {
  const errors: string[] = [];

  if (!config.name?.trim()) {
    errors.push('Config name is required');
  }

  if (config.maxTeamSize < 1) {
    errors.push('Max team size must be at least 1');
  }

  if (config.maxTeamSize > 50) {
    errors.push('Max team size cannot exceed 50');
  }

  if (config.minFemales < 0) {
    errors.push('Minimum females cannot be negative');
  }

  if (config.minMales < 0) {
    errors.push('Minimum males cannot be negative');
  }

  if (config.minFemales + config.minMales > config.maxTeamSize) {
    errors.push('Minimum gender requirements exceed max team size');
  }

  if (!config.allowMixedGender && config.minFemales > 0 && config.minMales > 0) {
    errors.push('Mixed gender teams are disabled, so you cannot require both male and female minimums on the same team');
  }

  if (config.targetTeams && config.targetTeams < 1) {
    errors.push('Target teams must be at least 1');
  }

  if (playerCount > 0) {
    const configuredTeamCount = getConfiguredTeamCount(playerCount, config);
    const totalCapacity = configuredTeamCount * config.maxTeamSize;

    if (totalCapacity < playerCount) {
      errors.push(
        `Current setup can only fit ${totalCapacity} players across ${configuredTeamCount} teams, but the roster has ${playerCount} players`
      );
    }
  }

  return errors;
}

export function importConfigsFromJSON(jsonString: string): LeagueConfig[] {
  try {
    const data = JSON.parse(jsonString);
    
    if (!Array.isArray(data)) {
      throw new Error('JSON must contain an array of configurations');
    }

    const configs: LeagueConfig[] = [];
    
    for (const item of data) {
      if (typeof item === 'object' && item !== null) {
        const config: LeagueConfig = normalizeLeagueConfig({
          id: item.id || generateConfigId(item.name || 'Imported Config'),
          name: item.name || 'Imported Config',
          maxTeamSize: Number(item.maxTeamSize) || 12,
          minFemales: Number(item.minFemales) || 0,
          minMales: Number(item.minMales) || 0,
          targetTeams: item.targetTeams ? Number(item.targetTeams) : undefined,
          allowMixedGender: Boolean(item.allowMixedGender !== false),
          restrictToEvenTeams: item.restrictToEvenTeams !== false,
        });

        const errors = validateConfig(config);
        if (errors.length === 0) {
          configs.push(config);
        }
      }
    }

    return configs;
  } catch (error) {
    throw new Error(`Failed to import configs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function exportConfigsToJSON(configs: LeagueConfig[]): string {
  return JSON.stringify(configs, null, 2);
}
