import { Player, CSVValidationResult, CSVRow, Gender, PlayerGroup } from '@/types';
import { processMutualRequests } from './playerGrouping';

export function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export function validateAndProcessCSV(csvText: string): CSVValidationResult {
  const result: CSVValidationResult = {
    isValid: false,
    errors: [],
    warnings: [],
    players: [],
    playerGroups: []
  };

  try {
    const rows = parseCSV(csvText);
    
    if (rows.length === 0) {
      result.errors.push('CSV file is empty or contains no data rows');
      return result;
    }

    // Check required columns
    const firstRow = rows[0];
    const headers = Object.keys(firstRow);
    
    const requiredColumns = ['name'];
    const optionalColumns = ['gender', 'skill rating', 'teammate requests', 'avoid requests'];
    
    const missingRequired = requiredColumns.filter(col => 
      !headers.some(h => h.includes(col.split(' ')[0]))
    );
    
    if (missingRequired.length > 0) {
      result.errors.push(`Missing required columns: ${missingRequired.join(', ')}`);
      return result;
    }

    // Find column mappings
    const nameCol = headers.find(h => h.includes('name')) || '';
    const genderCol = headers.find(h => h.includes('gender')) || '';
    const skillCol = headers.find(h => h.includes('skill')) || '';
    const teammateCol = headers.find(h => h.includes('teammate')) || '';
    const avoidCol = headers.find(h => h.includes('avoid')) || '';

    const seenNames = new Set<string>();
    const players: Player[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 for header row and 0-based index

      // Validate name
      const name = row[nameCol]?.trim();
      if (!name) {
        result.errors.push(`Row ${rowNum}: Missing player name`);
        continue;
      }

      if (seenNames.has(name.toLowerCase())) {
        result.errors.push(`Row ${rowNum}: Duplicate player name "${name}"`);
        continue;
      }
      seenNames.add(name.toLowerCase());

      // Handle gender (optional)
      let gender: Gender = 'Other';
      if (genderCol) {
        const genderStr = row[genderCol]?.trim().toUpperCase();
        if (genderStr === 'M' || genderStr === 'MALE') gender = 'M';
        else if (genderStr === 'F' || genderStr === 'FEMALE') gender = 'F';
        else if (genderStr && genderStr !== 'OTHER') {
          result.warnings.push(`Row ${rowNum}: Unknown gender "${genderStr}", defaulting to "Other"`);
        }
      } else {
        result.warnings.push(`Gender column not found, defaulting to "Other" for all players`);
      }

      // Handle skill rating (optional)
      let skillRating = 5; // Default to middle value
      if (skillCol) {
        const skillStr = row[skillCol]?.trim();
        if (skillStr) {
          const skill = parseFloat(skillStr);
          if (isNaN(skill)) {
            result.warnings.push(`Row ${rowNum}: Invalid skill rating "${skillStr}", defaulting to 5`);
          } else {
            if (skill < 0 || skill > 10) {
              result.warnings.push(`Row ${rowNum}: Skill rating ${skill} outside typical range (0-10)`);
            }
            skillRating = skill;
          }
        }
      } else {
        result.warnings.push(`Skill rating column not found, defaulting to 5 for all players`);
      }

      // Parse teammate requests
      const teammateRequests = parsePlayerList(row[teammateCol] || '');
      const avoidRequests = parsePlayerList(row[avoidCol] || '');

      const player: Player = {
        id: generatePlayerId(name),
        name,
        gender,
        skillRating,
        teammateRequests,
        avoidRequests
      };

      players.push(player);
    }

    // Validate teammate/avoid requests reference existing players
    const playerNames = new Set(players.map(p => p.name.toLowerCase()));
    
    players.forEach(player => {
      player.teammateRequests = player.teammateRequests.filter(name => {
        const exists = playerNames.has(name.toLowerCase());
        if (!exists) {
          result.warnings.push(`Player "${player.name}": Teammate request "${name}" not found in roster`);
        }
        return exists;
      });

      player.avoidRequests = player.avoidRequests.filter(name => {
        const exists = playerNames.has(name.toLowerCase());
        if (!exists) {
          result.warnings.push(`Player "${player.name}": Avoid request "${name}" not found in roster`);
        }
        return exists;
      });
    });

    // Process mutual requests and create player groups
    const { cleanedPlayers, playerGroups } = processMutualRequests(players);
    
    result.players = cleanedPlayers;
    result.playerGroups = playerGroups;
    result.isValid = result.errors.length === 0;

    if (result.isValid && cleanedPlayers.length === 0) {
      result.errors.push('No valid players found in CSV');
      result.isValid = false;
    }

    // Add info about mutual requests processing
    const groupedPlayerCount = playerGroups.reduce((sum, group) => sum + group.players.length, 0);
    if (groupedPlayerCount > 0) {
      result.warnings.push(`Found ${playerGroups.length} player groups with ${groupedPlayerCount} players. Non-mutual requests have been removed.`);
    }

  } catch (error) {
    result.errors.push(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

function parsePlayerList(str: string): string[] {
  if (!str) return [];
  
  return str
    .split(/[,;]/)
    .map(name => name.trim())
    .filter(name => name.length > 0);
}

function generatePlayerId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substr(2, 5);
}

export function generateSampleCSV(): string {
  const headers = ['Name', 'Gender (Optional)', 'Skill Rating (Optional)', 'Teammate Requests', 'Avoid Requests'];
  
  const sampleData = [
    ['Alice Johnson', 'F', '8', 'Bob Smith', ''],
    ['Bob Smith', 'M', '7', 'Alice Johnson', 'Charlie Brown'],
    ['Charlie Brown', 'M', '6', '', 'Bob Smith'],
    ['Diana Prince', 'F', '', '', ''],
    ['Eve Adams', '', '5', 'Frank Miller', ''],
    ['Frank Miller', 'M', '7', 'Eve Adams', ''],
    ['Grace Lee', '', '', '', ''],
    ['Henry Wilson', 'M', '6', '', ''],
    ['Iris Chen', 'F', '7', '', ''],
    ['Jack Davis', 'M', '8', '', ''],
    ['Karen Taylor', 'F', '6', '', ''],
    ['Luke Martinez', 'M', '9', '', '']
  ];

  return [headers.join(',')].concat(sampleData.map(row => row.join(','))).join('\n');
}
