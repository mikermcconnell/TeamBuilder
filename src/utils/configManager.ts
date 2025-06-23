import { LeagueConfig } from '@/types';

const STORAGE_KEY = 'teambuilder-configs';
const DEFAULT_CONFIG_KEY = 'teambuilder-default-config';

export function getDefaultConfig(): LeagueConfig {
  const saved = localStorage.getItem(DEFAULT_CONFIG_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn('Failed to parse saved default config:', error);
    }
  }

  return {
    id: 'default',
    name: 'Default League',
    maxTeamSize: 12,
    minFemales: 2,
    minMales: 0,
    allowMixedGender: true
  };
}

export function saveDefaultConfig(config: LeagueConfig): void {
  try {
    localStorage.setItem(DEFAULT_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save default config:', error);
  }
}

export function loadSavedConfigs(): LeagueConfig[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const configs = JSON.parse(saved);
      return Array.isArray(configs) ? configs : [];
    }
  } catch (error) {
    console.warn('Failed to load saved configs:', error);
  }
  
  return [];
}

export function saveConfigs(configs: LeagueConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch (error) {
    console.error('Failed to save configs:', error);
  }
}

export function saveConfig(config: LeagueConfig): void {
  const configs = loadSavedConfigs();
  const existingIndex = configs.findIndex(c => c.id === config.id);
  
  if (existingIndex >= 0) {
    configs[existingIndex] = config;
  } else {
    configs.push(config);
  }
  
  saveConfigs(configs);
}

export function deleteConfig(configId: string): void {
  const configs = loadSavedConfigs();
  const filtered = configs.filter(c => c.id !== configId);
  saveConfigs(filtered);
}

export function createConfigFromTemplate(name: string, template: LeagueConfig): LeagueConfig {
  return {
    ...template,
    id: generateConfigId(name),
    name
  };
}

export function generateConfigId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
}

export function validateConfig(config: LeagueConfig): string[] {
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

  if (config.targetTeams && config.targetTeams < 1) {
    errors.push('Target teams must be at least 1');
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
        const config: LeagueConfig = {
          id: item.id || generateConfigId(item.name || 'Imported Config'),
          name: item.name || 'Imported Config',
          maxTeamSize: Number(item.maxTeamSize) || 12,
          minFemales: Number(item.minFemales) || 0,
          minMales: Number(item.minMales) || 0,
          targetTeams: item.targetTeams ? Number(item.targetTeams) : undefined,
          allowMixedGender: Boolean(item.allowMixedGender !== false)
        };

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
