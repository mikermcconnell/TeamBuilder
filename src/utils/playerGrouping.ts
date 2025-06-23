import { Player, PlayerGroup } from '@/types';

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
function namesMatch(name1: string, name2: string): boolean {
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
function findPlayerByName(players: Player[], targetName: string): Player | null {
  // First try exact match
  let found = players.find(p => p.name.toLowerCase() === targetName.toLowerCase());
  if (found) return found;
  
  // Try nickname matching
  found = players.find(p => namesMatch(p.name, targetName));
  return found || null;
}

// Function to process mutual requests and create groups
export function processMutualRequests(players: Player[]): {
  cleanedPlayers: Player[];
  playerGroups: PlayerGroup[];
} {
  const cleanedPlayers = players.map(p => ({ ...p, teammateRequests: [] }));
  const playerGroups: PlayerGroup[] = [];
  const processedPlayerIds = new Set<string>();
  
  // Find all mutual connections
  const mutualConnections: { [playerId: string]: Set<string> } = {};
  
  for (const player of players) {
    mutualConnections[player.id] = new Set();
    
    for (const requestedName of player.teammateRequests) {
      const requestedPlayer = findPlayerByName(players, requestedName);
      
      if (requestedPlayer && requestedPlayer.id !== player.id) {
        // Check if the request is mutual
        const isMutual = requestedPlayer.teammateRequests.some(name => 
          namesMatch(name, player.name)
        );
        
        if (isMutual) {
          mutualConnections[player.id].add(requestedPlayer.id);
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
    if (connections.size === 0) continue;
    
    // Build a group using BFS to find all connected players
    const groupPlayerIds = new Set<string>([player.id]);
    const queue = [player.id];
    
    while (queue.length > 0 && groupPlayerIds.size < 4) {
      const currentPlayerId = queue.shift()!;
      const currentConnections = mutualConnections[currentPlayerId];
      
      for (const connectedId of currentConnections) {
        if (!groupPlayerIds.has(connectedId) && !processedPlayerIds.has(connectedId) && groupPlayerIds.size < 4) {
          groupPlayerIds.add(connectedId);
          queue.push(connectedId);
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
        color: GROUP_COLORS[groupIndex % GROUP_COLORS.length],
        playerIds: Array.from(groupPlayerIds),
        players: groupPlayers,
      };
      
      playerGroups.push(group);
      
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
  
  return { cleanedPlayers, playerGroups };
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
