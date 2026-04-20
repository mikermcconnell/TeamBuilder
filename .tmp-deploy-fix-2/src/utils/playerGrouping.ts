import { Player, PlayerGroup, TeammateRequest, RequestConflict, NearMissGroup, UnfulfilledRequest } from '@/types';

// Predefined colors for player groups
const GROUP_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#14B8A6', // Teal
  '#F43F5E', // Rose
];

// Function to normalize names for matching (handles nicknames and variations)
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z]/g, '');
}

// Function to check if two names might match (including nicknames)
export function namesMatch(name1: string, name2: string): boolean {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  // Exact match
  if (norm1 === norm2) return true;

  // Check if one is contained in the other (for nicknames)
  if (norm1.length >= 3 && norm2.length >= 3) {
    return norm1.includes(norm2) || norm2.includes(norm1);
  }

  // Common nickname patterns
  const commonNicknames: { [key: string]: string[] } = {
    'alexander': ['alex', 'xander', 'al', 'alec', 'sandy'],
    'alexandra': ['alex', 'alexa', 'sandra', 'lexi', 'ally'],
    'andrew': ['andy', 'drew', 'anders'],
    'anthony': ['tony', 'ant', 'toni'],
    'benjamin': ['ben', 'benny', 'benji'],
    'catherine': ['cathy', 'kate', 'katie', 'cat'],
    'charles': ['charlie', 'chuck', 'chas'],
    'christopher': ['chris', 'topher', 'kit'],
    'daniel': ['dan', 'danny', 'dani'],
    'david': ['dave', 'davey', 'day'],
    'edward': ['ed', 'eddie', 'ted', 'ned'],
    'elizabeth': ['liz', 'beth', 'betty', 'ellie', 'lisa', 'lizzy', 'libby', 'eli'],
    'frederick': ['fred', 'freddy', 'rick'],
    'gregory': ['greg', 'gregg', 'gregor'],
    'james': ['jim', 'jimmy', 'jamie'],
    'jennifer': ['jen', 'jenny', 'jenna'],
    'john': ['johnny', 'jack', 'jj'],
    'jonathan': ['jon', 'johnny', 'jona', 'nathan'],
    'joseph': ['joe', 'joey', 'jos'],
    'katherine': ['kate', 'kathy', 'katie', 'kat'],
    'kenneth': ['ken', 'kenny', 'kent'],
    'margaret': ['maggie', 'meg', 'peggy', 'marge'],
    'matthew': ['matt', 'matty', 'thew'],
    'michael': ['mike', 'micky', 'mikey', 'mick'],
    'nicholas': ['nick', 'nicky', 'nico', 'cole'],
    'patricia': ['pat', 'patty', 'tricia', 'trish'],
    'patrick': ['pat', 'paddy', 'rick'],
    'peter': ['pete', 'petey'],
    'rebecca': ['becca', 'becky', 'reba'],
    'richard': ['rick', 'dick', 'richie', 'rich'],
    'robert': ['rob', 'bob', 'bobby', 'bert'],
    'ronald': ['ron', 'ronnie', 'ronny'],
    'samantha': ['sam', 'sammy', 'mantha'],
    'samuel': ['sam', 'sammy', 'sami'],
    'stephanie': ['steph', 'steffi', 'stephy'],
    'steven': ['steve', 'stevie', 'stevo'],
    'theodore': ['ted', 'teddy', 'theo'],
    'thomas': ['tom', 'tommy', 'thom'],
    'timothy': ['tim', 'timmy', 'timo'],
    'victoria': ['vicky', 'tori', 'vic'],
    'william': ['will', 'bill', 'billy', 'liam', 'willy'],
    'zachary': ['zach', 'zack', 'zac']
  };

  // Check against common nicknames
  for (const [fullName, nicknames] of Object.entries(commonNicknames)) {
    // Check if either name matches the full name or any of its nicknames
    const isName1Match = norm1 === fullName || nicknames.includes(norm1);
    const isName2Match = norm2 === fullName || nicknames.includes(norm2);

    // If both names are related to the same full name
    if (isName1Match && isName2Match) {
      return true;
    }

    // Check if nicknames are directly related
    if (nicknames.includes(norm1) && nicknames.includes(norm2)) {
      return true;
    }
  }

  return false;
}

// Function to find a player by name (including nickname matching)
export function findPlayerByName(players: Player[], targetName: string): Player | null {
  // First try exact match
  let found = players.find(p => p.name.toLowerCase() === targetName.toLowerCase());
  if (found) return found;

  // Try nickname matching
  found = players.find(p => namesMatch(p.name, targetName));
  return found || null;
}

// Parse teammate requests with priority (first = must-have)
export function parseTeammateRequests(player: Player, allPlayers: Player[]): TeammateRequest[] {
  return player.teammateRequests.map((name, index) => {
    const matchedPlayer = findPlayerByName(allPlayers, name);
    return {
      name,
      priority: index === 0 ? 'must-have' : 'nice-to-have',
      matchedPlayerId: matchedPlayer?.id,
      status: undefined, // Will be set after team generation
      reason: undefined
    };
  });
}

// Detect conflicts: Player A requests Player B, but Player B avoids Player A
export function detectRequestConflicts(players: Player[]): RequestConflict[] {
  const conflicts: RequestConflict[] = [];

  for (const player of players) {
    for (const requestedName of player.teammateRequests) {
      const requestedPlayer = findPlayerByName(players, requestedName);
      if (!requestedPlayer) continue;

      // Check if requested player avoids this player
      const isAvoided = requestedPlayer.avoidRequests.some(
        avoidName => namesMatch(avoidName, player.name)
      );

      if (isAvoided) {
        conflicts.push({
          playerId: player.id,
          playerName: player.name,
          requestedPlayerId: requestedPlayer.id,
          requestedName: requestedPlayer.name,
          conflictType: 'avoid-vs-request',
          description: `${player.name} requested ${requestedPlayer.name}, but ${requestedPlayer.name} wants to avoid ${player.name}`
        });
      }

      // Check for one-way requests (not mutual) - informational
      const isMutual = requestedPlayer.teammateRequests.some(
        name => namesMatch(name, player.name)
      );

      if (!isMutual && !isAvoided) {
        conflicts.push({
          playerId: player.id,
          playerName: player.name,
          requestedPlayerId: requestedPlayer.id,
          requestedName: requestedPlayer.name,
          conflictType: 'one-way-request',
          description: `${player.name} requested ${requestedPlayer.name}, but ${requestedPlayer.name} did not request ${player.name}`
        });
      }
    }
  }

  return conflicts;
}

// Extended result type with new features
export interface ProcessMutualRequestsResult {
  cleanedPlayers: Player[];
  playerGroups: PlayerGroup[];
  conflicts: RequestConflict[];
  nearMissGroups: NearMissGroup[];
}

// Function to process mutual requests and create groups
export function processMutualRequests(players: Player[]): ProcessMutualRequestsResult {
  const cleanedPlayers = players.map(p => ({
    ...p,
    teammateRequests: [] as string[],
    teammateRequestsParsed: parseTeammateRequests(p, players)
  }));
  const playerGroups: PlayerGroup[] = [];
  const nearMissGroups: NearMissGroup[] = [];
  const processedPlayerIds = new Set<string>();

  // Detect conflicts first
  const conflicts = detectRequestConflicts(players);

  // Find all mutual connections
  const mutualConnections: { [playerId: string]: Set<string> } = {};
  const allConnections: { [playerId: string]: Set<string> } = {}; // For near-miss detection

  for (const player of players) {
    mutualConnections[player.id] = new Set();
    allConnections[player.id] = new Set();

    for (const requestedName of player.teammateRequests) {
      const requestedPlayer = findPlayerByName(players, requestedName);

      if (requestedPlayer && requestedPlayer.id !== player.id) {
        allConnections[player.id]?.add(requestedPlayer.id);

        // Check if the request is mutual
        const isMutual = requestedPlayer.teammateRequests.some(name =>
          namesMatch(name, player.name)
        );

        if (isMutual) {
          mutualConnections[player.id]?.add(requestedPlayer.id);
          // Update cleaned player to only include mutual requests
          const cleanedPlayer = cleanedPlayers.find(p => p.id === player.id);
          if (cleanedPlayer && !cleanedPlayer.teammateRequests.includes(requestedPlayer.name)) {
            cleanedPlayer.teammateRequests.push(requestedPlayer.name);
          }
        }
      }
    }
  }

  // Form groups from mutual connections
  let groupIndex = 0;

  for (const player of players) {
    if (processedPlayerIds.has(player.id)) continue;

    const connections = mutualConnections[player.id];
    if (!connections || connections.size === 0) continue;

    // Build a group using BFS to find all connected players
    const groupPlayerIds = new Set<string>([player.id]);
    const queue = [player.id];
    const overflowPlayers: string[] = []; // Track players that couldn't fit

    while (queue.length > 0) {
      const currentPlayerId = queue.shift()!;
      const currentConnections = mutualConnections[currentPlayerId];

      // Safety check
      if (!currentConnections) continue;

      for (const connectedId of currentConnections) {
        if (!groupPlayerIds.has(connectedId) && !processedPlayerIds.has(connectedId)) {
          if (groupPlayerIds.size < 4) {
            groupPlayerIds.add(connectedId);
            queue.push(connectedId);
          } else {
            // Track overflow for near-miss detection
            overflowPlayers.push(connectedId);
          }
        }
      }
    }

    // Create group if it has more than 1 player
    if (groupPlayerIds.size > 1) {
      const groupPlayers = Array.from(groupPlayerIds).map(id =>
        players.find(p => p.id === id)!
      );

      const group: PlayerGroup = {
        id: `group-${groupIndex}`,
        label: String.fromCharCode(65 + groupIndex), // A, B, C, etc.
        color: GROUP_COLORS[groupIndex % GROUP_COLORS.length] || GROUP_COLORS[0],
        playerIds: Array.from(groupPlayerIds),
        players: groupPlayers,
      };

      playerGroups.push(group);

      // Track near-miss if players overflowed
      if (overflowPlayers.length > 0) {
        const allIds = [...Array.from(groupPlayerIds), ...overflowPlayers];
        const allNames = allIds.map(id => players.find(p => p.id === id)?.name || 'Unknown');
        nearMissGroups.push({
          playerIds: allIds,
          playerNames: allNames,
          reason: 'group-too-large',
          potentialSize: allIds.length
        });
      }

      // Mark players as processed and assign group ID
      for (const playerId of groupPlayerIds) {
        processedPlayerIds.add(playerId);
        const cleanedPlayer = cleanedPlayers.find(p => p.id === playerId);
        if (cleanedPlayer) {
          cleanedPlayer.groupId = group.id;
        }
      }

      groupIndex++;
    }
  }

  // Calculate unfulfilled requests with priority
  for (const player of players) {
    const cleanedPlayer = cleanedPlayers.find(p => p.id === player.id);
    if (!cleanedPlayer) continue;

    cleanedPlayer.unfulfilledRequests = [];

    player.teammateRequests.forEach((requestedName, index) => {
      const requestedPlayer = findPlayerByName(players, requestedName);
      const priority = index === 0 ? 'must-have' : 'nice-to-have';

      // If player wasn't found, skip
      if (!requestedPlayer) return;

      // Check if they ended up in the same group
      const inSameGroup = arePlayersInSameGroup(playerGroups, player.id, requestedPlayer.id);

      if (!inSameGroup) {
        // Check if there's a conflict
        const hasConflict = conflicts.some(
          c => c.playerId === player.id && c.requestedPlayerId === requestedPlayer.id && c.conflictType === 'avoid-vs-request'
        );

        // Check if it was mutual
        const isMutual = requestedPlayer.teammateRequests.some(name =>
          namesMatch(name, player.name)
        );

        let reason: UnfulfilledRequest['reason'];
        if (hasConflict) {
          reason = 'conflict';
        } else if (isMutual) {
          reason = 'group-full';
        } else {
          reason = 'non-reciprocal';
        }

        cleanedPlayer.unfulfilledRequests?.push({
          playerId: requestedPlayer.id,
          name: requestedPlayer.name,
          reason,
          priority
        });
      }

      // Update parsed request status
      const parsedRequest = cleanedPlayer.teammateRequestsParsed?.find(r => r.name === requestedName);
      if (parsedRequest) {
        parsedRequest.status = inSameGroup ? 'honored' : (
          conflicts.some(c => c.playerId === player.id && c.requestedPlayerId === requestedPlayer.id && c.conflictType === 'avoid-vs-request')
            ? 'conflict'
            : 'unfulfilled'
        );
      }
    });
  }

  return { cleanedPlayers, playerGroups, conflicts, nearMissGroups };
}

// Validate groups against league config BEFORE team generation
export function validateGroupsForGeneration(
  playerGroups: PlayerGroup[],
  maxTeamSize: number
): { valid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const group of playerGroups) {
    if (group.players.length > maxTeamSize) {
      errors.push(
        `Group ${group.label} has ${group.players.length} players, but max team size is ${maxTeamSize}. ` +
        `This group cannot be placed on any team together.`
      );
    } else if (group.players.length === maxTeamSize) {
      warnings.push(
        `Group ${group.label} has ${group.players.length} players, which fills an entire team. ` +
        `No other players can join this team.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
}

// Function to get group by player ID
export function getPlayerGroup(playerGroups: PlayerGroup[], playerId: string): PlayerGroup | null {
  return playerGroups.find(group => group.playerIds.includes(playerId)) || null;
}

// Function to get all players in the same group
export function getGroupmates(playerGroups: PlayerGroup[], playerId: string): Player[] {
  const group = getPlayerGroup(playerGroups, playerId);
  return group ? group.players.filter(p => p.id !== playerId) : [];
}

// Function to check if players are in the same group
export function arePlayersInSameGroup(playerGroups: PlayerGroup[], playerId1: string, playerId2: string): boolean {
  const group1 = getPlayerGroup(playerGroups, playerId1);
  const group2 = getPlayerGroup(playerGroups, playerId2);
  return group1 !== null && group1.id === group2?.id;
}

// Function to get group color by player ID
export function getPlayerGroupColor(playerGroups: PlayerGroup[], playerId: string): string | null {
  const group = getPlayerGroup(playerGroups, playerId);
  return group ? group.color : null;
}

// Function to get group label by player ID
export function getPlayerGroupLabel(playerGroups: PlayerGroup[], playerId: string): string | null {
  const group = getPlayerGroup(playerGroups, playerId);
  return group ? group.label : null;
}

// Get request statistics for export/display
export function getRequestStatistics(players: Player[], playerGroups: PlayerGroup[]): {
  totalRequests: number;
  mustHaveTotal: number;
  mustHaveHonored: number;
  mustHaveBroken: number;
  niceToHaveTotal: number;
  niceToHaveHonored: number;
  niceToHaveBroken: number;
  conflictsCount: number;
} {
  let totalRequests = 0;
  let mustHaveTotal = 0;
  let mustHaveHonored = 0;
  let niceToHaveTotal = 0;
  let niceToHaveHonored = 0;
  let conflictsCount = 0;

  const conflicts = detectRequestConflicts(players);
  conflictsCount = conflicts.filter(c => c.conflictType === 'avoid-vs-request').length;

  for (const player of players) {
    player.teammateRequests.forEach((requestedName, index) => {
      totalRequests++;
      const isMustHave = index === 0;

      if (isMustHave) {
        mustHaveTotal++;
      } else {
        niceToHaveTotal++;
      }

      const requestedPlayer = findPlayerByName(players, requestedName);
      if (requestedPlayer) {
        const inSameGroup = arePlayersInSameGroup(playerGroups, player.id, requestedPlayer.id);
        if (inSameGroup) {
          if (isMustHave) {
            mustHaveHonored++;
          } else {
            niceToHaveHonored++;
          }
        }
      }
    });
  }

  return {
    totalRequests,
    mustHaveTotal,
    mustHaveHonored,
    mustHaveBroken: mustHaveTotal - mustHaveHonored,
    niceToHaveTotal,
    niceToHaveHonored,
    niceToHaveBroken: niceToHaveTotal - niceToHaveHonored,
    conflictsCount
  };
}
