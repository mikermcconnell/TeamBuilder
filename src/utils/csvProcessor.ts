import { Player, CSVValidationResult, CSVRow, Gender, PlayerGroup } from '@/types';
import { processMutualRequests } from './playerGrouping';
import { fuzzyMatcher, FuzzyMatchResult } from './fuzzyNameMatcher';

// CSV format types for automatic detection
type CSVFormat = 'legacy' | 'registration';

interface FormatDetectionResult {
  format: CSVFormat;
  confidence: number;
  detectedColumns: string[];
}

export function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip completely empty lines
    if (!line) continue;

    const values = parseCSVLine(line);
    // Skip rows with only empty/whitespace values
    if (values.every(val => !val.trim())) continue;

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
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map(val => val.trim());
}

/**
 * Detect CSV format by analyzing column headers
 */
function detectCSVFormat(headers: string[]): FormatDetectionResult {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  // Registration format indicators
  const hasFirstName = normalizedHeaders.some(h => h.includes('first') && h.includes('name'));
  const hasLastName = normalizedHeaders.some(h => h.includes('last') && h.includes('name'));
  const hasStatus = normalizedHeaders.some(h => h.includes('status'));
  const hasPlayerRequests = normalizedHeaders.some(h => h.includes('player_request') || h.includes('player request'));
  const hasSkillOnly = normalizedHeaders.some(h => h === 'skill' && !h.includes('rating'));

  // Legacy format indicators
  const hasSingleName = normalizedHeaders.some(h => h === 'name' || (h.includes('name') && !h.includes('first') && !h.includes('last')));
  const hasTeammateRequests = normalizedHeaders.some(h => h.includes('teammate'));
  const hasAvoidRequests = normalizedHeaders.some(h => h.includes('avoid'));

  // Calculate confidence scores
  const registrationScore = (hasFirstName ? 1 : 0) + (hasLastName ? 1 : 0) + (hasStatus ? 1 : 0) + (hasPlayerRequests ? 1 : 0) + (hasSkillOnly ? 0.5 : 0);
  const legacyScore = (hasSingleName ? 1 : 0) + (hasTeammateRequests ? 1 : 0) + (hasAvoidRequests ? 0.5 : 0);

  if (registrationScore > legacyScore && registrationScore >= 2) {
    return {
      format: 'registration',
      confidence: Math.min(registrationScore / 4, 1),
      detectedColumns: normalizedHeaders.filter(h =>
        h.includes('first') || h.includes('last') || h.includes('status') ||
        h.includes('player_request') || h.includes('player request') || h === 'skill'
      )
    };
  } else {
    return {
      format: 'legacy',
      confidence: Math.min(Math.max(legacyScore / 2.5, 0.5), 1), // Minimum confidence for legacy
      detectedColumns: normalizedHeaders.filter(h =>
        h.includes('name') || h.includes('teammate') || h.includes('avoid') ||
        h.includes('skill') || h.includes('gender') || h.includes('email')
      )
    };
  }
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

    // Detect CSV format
    const firstRow = rows[0];
    const headers = Object.keys(firstRow);
    const formatDetection = detectCSVFormat(headers);

    // Add format detection info to warnings (informational)
    result.warnings.push(`Detected ${formatDetection.format} CSV format (confidence: ${Math.round(formatDetection.confidence * 100)}%)`);

    // Process based on detected format
    if (formatDetection.format === 'registration') {
      return processRegistrationFormat(rows, result);
    } else {
      return processLegacyFormat(rows, result);
    }

  } catch (error) {
    result.errors.push(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Process legacy CSV format (existing format)
 */
function processLegacyFormat(rows: CSVRow[], result: CSVValidationResult): CSVValidationResult {
  const headers = Object.keys(rows[0]);

  // Check required columns for legacy format
  const requiredColumns = ['name'];
  const missingRequired = requiredColumns.filter(col =>
    !headers.some(h => h.toLowerCase().includes(col.split(' ')[0]))
  );

  if (missingRequired.length > 0) {
    result.errors.push(`Missing required columns: ${missingRequired.join(', ')}`);
    return result;
  }

  // Find column mappings
  const nameCol = headers.find(h => h.toLowerCase().includes('name')) || '';
  const genderCol = headers.find(h => h.toLowerCase().includes('gender')) || '';
  const skillCol = headers.find(h => h.toLowerCase().includes('skill') && !h.toLowerCase().includes('exec')) || '';
  const execSkillCol = headers.find(h => h.toLowerCase().includes('exec') && h.toLowerCase().includes('skill')) || '';
  const teammateCol = headers.find(h => h.toLowerCase().includes('teammate')) || '';
  const avoidCol = headers.find(h => h.toLowerCase().includes('avoid')) || '';
  const emailCol = headers.find(h => h.toLowerCase().includes('email')) || '';

  const seenNames = new Set<string>();
  const players: Player[] = [];
  let actualRowNumber = 2; // Start from row 2 (after header)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Skip rows that are completely empty or only have whitespace
    const hasAnyContent = Object.values(row).some(val => val && val.trim());
    if (!hasAnyContent) {
      continue;
    }

    // Validate name
    const name = row[nameCol]?.trim();
    if (!name) {
      result.errors.push(`Row ${actualRowNumber}: Missing player name`);
      actualRowNumber++;
      continue;
    }

    if (seenNames.has(name.toLowerCase())) {
      result.errors.push(`Row ${actualRowNumber}: Duplicate player name "${name}"`);
      actualRowNumber++;
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
        result.warnings.push(`Row ${actualRowNumber}: Unknown gender "${genderStr}", defaulting to "Other"`);
      }
    }

    // Handle skill rating (optional)
    let skillRating = 5; // Default to middle value
    if (skillCol) {
      const skillStr = row[skillCol]?.trim();
      if (skillStr) {
        const skill = parseFloat(skillStr);
        if (isNaN(skill)) {
          result.warnings.push(`Row ${actualRowNumber}: Invalid skill rating "${skillStr}", defaulting to 5`);
        } else {
          if (skill < 0 || skill > 10) {
            result.warnings.push(`Row ${actualRowNumber}: Skill rating ${skill} outside typical range (0-10)`);
          }
          skillRating = skill;
        }
      }
    }

    // Handle exec skill rating (optional)
    let execSkillRating: number | null = null; // Default to null (N/A) for new players
    if (execSkillCol) {
      const execSkillStr = row[execSkillCol]?.trim();
      if (execSkillStr && execSkillStr.toLowerCase() !== 'n/a') {
        const execSkill = parseFloat(execSkillStr);
        if (isNaN(execSkill)) {
          result.warnings.push(`Row ${actualRowNumber}: Invalid exec skill rating "${execSkillStr}", setting to N/A`);
          execSkillRating = null;
        } else {
          if (execSkill < 0 || execSkill > 10) {
            result.warnings.push(`Row ${actualRowNumber}: Exec skill rating ${execSkill} outside typical range (0-10)`);
          }
          execSkillRating = execSkill;
        }
      }
    }

    // Parse teammate requests
    const teammateRequests = parsePlayerList(row[teammateCol] || '');
    const avoidRequests = parsePlayerList(row[avoidCol] || '');

    // Handle email (optional)
    let email: string | undefined;
    if (emailCol) {
      const emailStr = row[emailCol]?.trim();
      if (emailStr) {
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(emailStr)) {
          email = emailStr;
        } else {
          result.warnings.push(`Row ${actualRowNumber}: Invalid email format "${emailStr}"`);
        }
      }
    }

    const player: Player = {
      id: generatePlayerId(name),
      name,
      gender,
      skillRating,
      execSkillRating,
      teammateRequests,
      avoidRequests,
      ...(email && { email })
    };

    players.push(player);
    actualRowNumber++;
  }

  return finalizePlayers(players, result);
}

/**
 * Process new registration CSV format
 */
function processRegistrationFormat(rows: CSVRow[], result: CSVValidationResult): CSVValidationResult {
  const headers = Object.keys(rows[0]);

  // Check required columns for registration format
  const requiredColumns = ['first_name', 'last_name'];
  const missingRequired = requiredColumns.filter(col =>
    !headers.some(h => h.toLowerCase().includes(col.split('_').join(' ')) || h.toLowerCase().includes(col))
  );

  if (missingRequired.length > 0) {
    result.errors.push(`Missing required columns for registration format: ${missingRequired.join(', ')}`);
    return result;
  }

  // Find column mappings for registration format
  const firstNameCol = headers.find(h => h.toLowerCase().includes('first') && h.toLowerCase().includes('name')) || '';
  const lastNameCol = headers.find(h => h.toLowerCase().includes('last') && h.toLowerCase().includes('name')) || '';
  const statusCol = headers.find(h => h.toLowerCase().includes('status')) || '';
  const genderCol = headers.find(h => h.toLowerCase().includes('gender')) || '';
  const skillCol = headers.find(h => h.toLowerCase() === 'skill') || '';
  const execCol = headers.find(h => h.toLowerCase() === 'exec') || '';

  // Find player request columns (Player_Request_#1, Player_Request_#2, Player_Request_#3)
  const playerRequestCols = headers.filter(h =>
    h.toLowerCase().includes('player') &&
    (h.toLowerCase().includes('request') || h.toLowerCase().includes('_request'))
  );

  // Find "Do Not Play" column for avoid requests
  const doNotPlayCol = headers.find(h =>
    h.toLowerCase().includes('do') &&
    h.toLowerCase().includes('not') &&
    h.toLowerCase().includes('play')
  ) || '';

  // Find skill rating component columns (Athletic ability, Throwing, Knowledge/leadership, Handling, Quality player)
  const skillComponentCols = headers.filter(h => {
    const lowerH = h.toLowerCase();
    return lowerH.includes('athletic') ||
      lowerH.includes('throwing') ||
      lowerH.includes('knowledge') ||
      lowerH.includes('leadership') ||
      lowerH.includes('handling') ||
      lowerH.includes('quality');
  });

  const seenNames = new Set<string>();
  const players: Player[] = [];
  let actualRowNumber = 2; // Start from row 2 (after header)
  let filteredOutCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Skip rows that are completely empty or only have whitespace
    const hasAnyContent = Object.values(row).some(val => val && val.trim());
    if (!hasAnyContent) {
      continue;
    }

    // Filter by status if status column exists
    if (statusCol) {
      const status = row[statusCol]?.trim().toLowerCase();
      if (status && status !== 'accepted') {
        filteredOutCount++;
        actualRowNumber++;
        continue;
      }
    }

    // Combine first and last name
    const firstName = row[firstNameCol]?.trim() || '';
    const lastName = row[lastNameCol]?.trim() || '';
    const name = `${firstName} ${lastName}`.trim();

    if (!name || name === ' ') {
      result.errors.push(`Row ${actualRowNumber}: Missing player name (both first_name and last_name are empty)`);
      actualRowNumber++;
      continue;
    }

    if (seenNames.has(name.toLowerCase())) {
      result.errors.push(`Row ${actualRowNumber}: Duplicate player name "${name}"`);
      actualRowNumber++;
      continue;
    }
    seenNames.add(name.toLowerCase());

    // Handle gender - convert from "male"/"female" to "M"/"F"
    let gender: Gender = 'Other';
    if (genderCol) {
      const genderStr = row[genderCol]?.trim().toLowerCase();
      if (genderStr === 'male' || genderStr === 'm') gender = 'M';
      else if (genderStr === 'female' || genderStr === 'f') gender = 'F';
      else if (genderStr && genderStr !== 'other') {
        result.warnings.push(`Row ${actualRowNumber}: Unknown gender "${genderStr}", defaulting to "Other"`);
      }
    }

    // Handle skill rating - calculate from skill component columns if available
    let skillRating = 5; // Default to middle value

    if (skillComponentCols.length > 0) {
      // Calculate skill from component columns (average * 2)
      const skillValues: number[] = [];
      skillComponentCols.forEach(col => {
        const valStr = row[col]?.trim();
        if (valStr) {
          const val = parseFloat(valStr);
          if (!isNaN(val)) {
            skillValues.push(val);
          }
        }
      });

      if (skillValues.length > 0) {
        const average = skillValues.reduce((sum, v) => sum + v, 0) / skillValues.length;
        skillRating = Math.round(average * 2 * 10) / 10; // Round to 1 decimal place

        if (skillRating > 10) {
          result.warnings.push(`Row ${actualRowNumber}: Calculated skill rating ${skillRating} exceeds maximum, capping at 10`);
          skillRating = 10;
        }
      }
    } else if (skillCol) {
      // Fallback to single skill column
      const skillStr = row[skillCol]?.trim();
      if (skillStr) {
        const skill = parseFloat(skillStr);
        if (isNaN(skill)) {
          result.warnings.push(`Row ${actualRowNumber}: Invalid skill rating "${skillStr}", defaulting to 5`);
        } else {
          if (skill < 0 || skill > 10) {
            result.warnings.push(`Row ${actualRowNumber}: Skill rating ${skill} outside typical range (0-10)`);
          }
          skillRating = skill;
        }
      }
    }

    // Handle exec skill rating separately
    let execSkillRating: number | null = null;
    if (execCol) {
      const execStr = row[execCol]?.trim();
      if (execStr) {
        const exec = parseFloat(execStr);
        if (!isNaN(exec) && exec > 0) {
          execSkillRating = exec;
          if (exec < 0 || exec > 10) {
            result.warnings.push(`Row ${actualRowNumber}: Exec rating ${exec} outside typical range (0-10)`);
          }
        }
        // If exec = 0 or invalid, execSkillRating remains null
      }
    }

    // Combine player requests from multiple columns
    const teammateRequests: string[] = [];
    playerRequestCols.forEach(col => {
      const request = row[col]?.trim();
      if (request && request.toLowerCase() !== 'n/a' && request !== '') {
        teammateRequests.push(request);
      }
    });

    // Parse avoid requests from Do Not Play column
    const avoidRequests: string[] = [];
    if (doNotPlayCol) {
      const doNotPlayVal = row[doNotPlayCol]?.trim();
      // Only process if it's not "No" or empty - extract actual player names
      if (doNotPlayVal && doNotPlayVal.toLowerCase() !== 'no' && !doNotPlayVal.toLowerCase().startsWith('yes:')) {
        // Split by common delimiters and add each name
        const names = doNotPlayVal.split(/[,;]/).map(n => n.trim()).filter(n => n.length > 0);
        avoidRequests.push(...names);
      }
    }

    const player: Player = {
      id: generatePlayerId(name),
      name,
      gender,
      skillRating,
      execSkillRating, // Will be set to exec value if exec > 0, otherwise null
      teammateRequests,
      avoidRequests,
      // email not provided in registration format
    };

    players.push(player);
    actualRowNumber++;
  }

  // Add info about filtering
  if (filteredOutCount > 0) {
    result.warnings.push(`Filtered out ${filteredOutCount} players with status other than "accepted"`);
  }

  if (playerRequestCols.length > 0) {
    result.warnings.push(`Combined ${playerRequestCols.length} player request columns into teammate requests`);
  }

  if (skillComponentCols.length > 0) {
    result.warnings.push(`Calculated skill rating from ${skillComponentCols.length} component columns (average × 2)`);
  }

  if (doNotPlayCol) {
    result.warnings.push('Parsed "Do Not Play" column for avoid requests');
  } else {
    result.warnings.push('Registration format detected - email not available');
  }

  return finalizePlayers(players, result);
}

/**
 * Shared logic for finalizing player processing
 */
function finalizePlayers(players: Player[], result: CSVValidationResult): CSVValidationResult {
  // Validate teammate/avoid requests with fuzzy matching
  const playerNames = players.map(p => p.name);

  players.forEach(player => {
    // Process teammate requests with fuzzy matching
    const resolvedTeammateRequests: string[] = [];
    player.teammateRequests.forEach(requestedName => {
      const matches = fuzzyMatcher.match(requestedName, playerNames, 0.6);

      if (matches.length > 0) {
        const bestMatch = matches[0];

        if (bestMatch.confidence === 'exact' || bestMatch.confidence === 'high') {
          // Auto-accept high confidence matches
          resolvedTeammateRequests.push(bestMatch.match);
          // Only add a warning if there's a meaningful difference (not just capitalization)
          const isCaseOnlyDiff = requestedName.toLowerCase() === bestMatch.match.toLowerCase();
          const isHighConfidence = bestMatch.score >= 0.95;
          if (bestMatch.match !== requestedName && !isCaseOnlyDiff && !isHighConfidence) {
            result.warnings.push(
              `Player "${player.name}": Teammate request "${requestedName}" matched to "${bestMatch.match}" (${bestMatch.reason})`
            );
          }
        } else if (bestMatch.confidence === 'medium') {
          // Medium confidence - add with warning
          resolvedTeammateRequests.push(bestMatch.match);
          result.warnings.push(
            `Player "${player.name}": Teammate request "${requestedName}" matched to "${bestMatch.match}" (${bestMatch.reason}) - please verify`
          );
        } else {
          // Low confidence - suggest but don't auto-match
          result.warnings.push(
            `Player "${player.name}": Teammate request "${requestedName}" not found. Did you mean "${bestMatch.match}"?`
          );
        }
      } else {
        result.warnings.push(`Player "${player.name}": Teammate request "${requestedName}" not found in roster`);
      }
    });

    // Process avoid requests with fuzzy matching
    const resolvedAvoidRequests: string[] = [];
    player.avoidRequests.forEach(requestedName => {
      const matches = fuzzyMatcher.match(requestedName, playerNames, 0.6);

      if (matches.length > 0) {
        const bestMatch = matches[0];

        if (bestMatch.confidence === 'exact' || bestMatch.confidence === 'high') {
          // Auto-accept high confidence matches
          resolvedAvoidRequests.push(bestMatch.match);
          // Only add a warning if there's a meaningful difference (not just capitalization)
          const isCaseOnlyDiff = requestedName.toLowerCase() === bestMatch.match.toLowerCase();
          const isHighConfidence = bestMatch.score >= 0.95;
          if (bestMatch.match !== requestedName && !isCaseOnlyDiff && !isHighConfidence) {
            result.warnings.push(
              `Player "${player.name}": Avoid request "${requestedName}" matched to "${bestMatch.match}" (${bestMatch.reason})`
            );
          }
        } else if (bestMatch.confidence === 'medium') {
          // Medium confidence - add with warning
          resolvedAvoidRequests.push(bestMatch.match);
          result.warnings.push(
            `Player "${player.name}": Avoid request "${requestedName}" matched to "${bestMatch.match}" (${bestMatch.reason}) - please verify`
          );
        } else {
          // Low confidence - suggest but don't auto-match
          result.warnings.push(
            `Player "${player.name}": Avoid request "${requestedName}" not found. Did you mean "${bestMatch.match}"?`
          );
        }
      } else {
        result.warnings.push(`Player "${player.name}": Avoid request "${requestedName}" not found in roster`);
      }
    });

    // Update player with resolved requests
    player.teammateRequests = resolvedTeammateRequests;
    player.avoidRequests = resolvedAvoidRequests;
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
  if (groupedPlayerCount > 0 && !result.warnings.some(w => w.includes('player groups'))) {
    result.warnings.push(`Found ${playerGroups.length} player groups with ${groupedPlayerCount} players. Non-mutual requests have been removed.`);
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
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).slice(2, 7);
}

export function generateSampleCSV(): string {
  const headers = ['Name', 'Gender (Optional)', 'Skill Rating (Optional)', 'Exec Skill Rating (Optional)', 'Teammate Requests', 'Avoid Requests', 'Email (Optional)'];

  const sampleData = [
    ['Alice Johnson', 'F', '8', '7.5', 'Bob Smith', '', 'alice.johnson@email.com'],
    ['Bob Smith', 'M', '7', '7', 'Alice Johnson', 'Charlie Brown', 'bob.smith@email.com'],
    ['Charlie Brown', 'M', '6', '5.5', '', 'Bob Smith', ''],
    ['Diana Prince', 'F', '', '', '', '', 'diana.prince@email.com'],
    ['Eve Adams', '', '5', '5', 'Frank Miller', '', ''],
    ['Frank Miller', 'M', '7', '6.5', 'Eve Adams', '', 'frank.miller@email.com'],
    ['Grace Lee', '', '', '', '', '', 'grace.lee@email.com'],
    ['Henry Wilson', 'M', '6', '6', '', '', ''],
    ['Iris Chen', 'F', '7', '7', '', '', 'iris.chen@email.com'],
    ['Jack Davis', 'M', '8', '8.5', '', '', 'jack.davis@email.com'],
    ['Karen Taylor', 'F', '6', '6', '', '', ''],
    ['Luke Martinez', 'M', '9', '8', '', '', 'luke.martinez@email.com']
  ];

  return [headers.join(',')].concat(sampleData.map(row => row.join(','))).join('\n');
}
