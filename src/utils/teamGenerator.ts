import { Player, Team, LeagueConfig, TeamGenerationStats, PlayerGroup } from '@/types';

export interface GenerationResult {
  teams: Team[];
  unassignedPlayers: Player[];
  stats: TeamGenerationStats;
}

export function generateBalancedTeams(
  players: Player[],
  config: LeagueConfig,
  playerGroups: PlayerGroup[] = [],
  randomize: boolean = false
): GenerationResult {
  const startTime = Date.now();
  
  // Create player lookup for quick access
  const playerMap = new Map(players.map(p => [p.name.toLowerCase(), p]));
  
  if (randomize) {
    return generateRandomTeams(players, config, playerGroups, startTime, playerMap);
  }

  // Find mutual teammate requests
  const mutualPairs = findMutualTeammateRequests(players, playerMap);
  
  // Create constraint groups (custom groups + mutual pairs + individual players)
  const constraintGroups = createConstraintGroups(players, mutualPairs, playerGroups);
  
  // Calculate number of teams needed
  const targetTeams = config.targetTeams || Math.ceil(players.length / config.maxTeamSize);
  
  // Initialize teams
  const teams: Team[] = [];
  for (let i = 0; i < targetTeams; i++) {
    teams.push(createEmptyTeam(`Team ${i + 1}`));
  }
  
  // Sort groups by constraints (most constrained first)
  const sortedGroups = constraintGroups.sort((a, b) => {
    const aConstraints = a.reduce((sum, p) => sum + p.avoidRequests.length, 0);
    const bConstraints = b.reduce((sum, p) => sum + p.avoidRequests.length, 0);
    return bConstraints - aConstraints;
  });
  
  const assignedPlayerIds = new Set<string>();
  const unassignedPlayers: Player[] = [];
  
  // Assign groups to teams
  for (const group of sortedGroups) {
    if (group.some(p => assignedPlayerIds.has(p.id))) continue;
    
    const bestTeam = findBestTeamForGroup(group, teams, config, playerMap);
    
    if (bestTeam && canAssignGroupToTeam(group, bestTeam, config)) {
      // Check avoid constraints for all players in the group
      const hasViolations = group.some(player => hasAvoidConflict(player, bestTeam, playerMap));
      
      if (!hasViolations) {
        group.forEach(player => {
          player.teamId = bestTeam.id;
          bestTeam.players.push(player);
          assignedPlayerIds.add(player.id);
        });
        updateTeamStats(bestTeam);
      } else {
        unassignedPlayers.push(...group);
      }
    } else {
      unassignedPlayers.push(...group);
    }
  }
  
  // Balance teams by skill after initial assignment, respecting avoid constraints
  balanceTeamsBySkill(teams, playerMap);
  
  const stats = calculateStats(players, teams, unassignedPlayers, mutualPairs, playerGroups, startTime);
  
  return {
    teams: teams.filter(t => t.players.length > 0),
    unassignedPlayers,
    stats
  };
}

function generateRandomTeams(
  players: Player[],
  config: LeagueConfig,
  playerGroups: PlayerGroup[],
  startTime: number,
  playerMap: Map<string, Player>
): GenerationResult {
  // Even in random mode, we need to honor custom groups
  // Create constraint groups but then assign them randomly
  const constraintGroups = createConstraintGroups(players, [], playerGroups); // No mutual pairs in random mode
  const shuffledGroups = [...constraintGroups].sort(() => Math.random() - 0.5);
  
  const targetTeams = config.targetTeams || Math.ceil(players.length / config.maxTeamSize);
  
  const teams: Team[] = [];
  for (let i = 0; i < targetTeams; i++) {
    teams.push(createEmptyTeam(`Team ${i + 1}`));
  }
  
  const unassignedPlayers: Player[] = [];
  
  for (const group of shuffledGroups) {
    const availableTeams = teams.filter(team => {
      // Check if team can accommodate the entire group
      if (team.players.length + group.length > config.maxTeamSize) return false;
      
      // Check gender requirements for all players in the group
      if (!group.every(player => wouldMeetGenderRequirements(team, player, config))) return false;
      
      // Check avoid constraints for all players in the group
      if (group.some(player => hasAvoidConflict(player, team, playerMap))) return false;
      
      return true;
    });
    
    if (availableTeams.length > 0) {
      const randomTeam = availableTeams[Math.floor(Math.random() * availableTeams.length)];
      
      // Assign entire group to the selected team
      for (const player of group) {
        player.teamId = randomTeam.id;
        randomTeam.players.push(player);
      }
      updateTeamStats(randomTeam);
    } else {
      // If group can't be placed together, add all to unassigned
      unassignedPlayers.push(...group);
    }
  }
  
  const stats = calculateStats(players, teams, unassignedPlayers, [], playerGroups, startTime);
  
  return {
    teams: teams.filter(t => t.players.length > 0),
    unassignedPlayers,
    stats
  };
}

function findMutualTeammateRequests(
  players: Player[],
  playerMap: Map<string, Player>
): [Player, Player][] {
  const pairs: [Player, Player][] = [];
  const processed = new Set<string>();
  
  for (const player of players) {
    if (processed.has(player.id)) continue;
    
    for (const requestedName of player.teammateRequests) {
      const requestedPlayer = playerMap.get(requestedName.toLowerCase());
      
      if (requestedPlayer && 
          !processed.has(requestedPlayer.id) &&
          requestedPlayer.teammateRequests.some(name => 
            name.toLowerCase() === player.name.toLowerCase()
          )) {
        pairs.push([player, requestedPlayer]);
        processed.add(player.id);
        processed.add(requestedPlayer.id);
        break; // Only one mutual pair per player
      }
    }
  }
  
  return pairs;
}

function createConstraintGroups(
  players: Player[],
  mutualPairs: [Player, Player][],
  playerGroups: PlayerGroup[]
): Player[][] {
  const groups: Player[][] = [];
  const assignedToGroup = new Set<string>();
  
  // PRIORITY 1: Add custom player groups first (highest priority)
  for (const customGroup of playerGroups) {
    if (customGroup.players.length > 0) {
      groups.push([...customGroup.players]);
      for (const player of customGroup.players) {
        assignedToGroup.add(player.id);
      }
    }
  }
  
  // PRIORITY 2: Add mutual pairs as groups (only if not already in custom groups)
  for (const [player1, player2] of mutualPairs) {
    if (!assignedToGroup.has(player1.id) && !assignedToGroup.has(player2.id)) {
      groups.push([player1, player2]);
      assignedToGroup.add(player1.id);
      assignedToGroup.add(player2.id);
    }
  }
  
  // PRIORITY 3: Add individual players (only if not already grouped)
  for (const player of players) {
    if (!assignedToGroup.has(player.id)) {
      groups.push([player]);
    }
  }
  
  return groups;
}

function findBestTeamForGroup(
  group: Player[],
  teams: Team[],
  config: LeagueConfig,
  playerMap: Map<string, Player>
): Team | null {
  const availableTeams = teams.filter(team => {
    // Check if team can accommodate the group
    if (!canAssignGroupToTeam(group, team, config)) return false;
    
    // Check avoid constraints for all players in the group
    if (group.some(player => hasAvoidConflict(player, team, playerMap))) return false;
    
    return true;
  });
  
  if (availableTeams.length === 0) return null;
  
  // Sort by current team size (prefer smaller teams) and skill balance
  return availableTeams.sort((a, b) => {
    if (a.players.length !== b.players.length) {
      return a.players.length - b.players.length;
    }
    
    // Prefer teams that would have better skill balance
    const aNewAvg = calculateNewAverageSkill(a, group);
    const bNewAvg = calculateNewAverageSkill(b, group);
    const targetAvg = calculateOverallAverageSkill(teams);
    
    const aDiff = Math.abs(aNewAvg - targetAvg);
    const bDiff = Math.abs(bNewAvg - targetAvg);
    
    return aDiff - bDiff;
  })[0];
}

function canAssignGroupToTeam(
  group: Player[],
  team: Team,
  config: LeagueConfig
): boolean {
  // Check team size
  if (team.players.length + group.length > config.maxTeamSize) {
    return false;
  }
  
  // Check gender requirements
  for (const player of group) {
    if (!wouldMeetGenderRequirements(team, player, config)) {
      return false;
    }
  }
  
  return true;
}

function wouldMeetGenderRequirements(
  team: Team,
  newPlayer: Player,
  config: LeagueConfig
): boolean {
  const currentGender = { ...team.genderBreakdown };
  currentGender[newPlayer.gender]++;
  
  const totalPlayers = team.players.length + 1;
  
  // Check if we can still meet minimum requirements
  const remainingSlots = config.maxTeamSize - totalPlayers;
  
  if (currentGender.F + remainingSlots < config.minFemales) return false;
  if (currentGender.M + remainingSlots < config.minMales) return false;
  
  return true;
}

function calculateNewAverageSkill(team: Team, newPlayers: Player[]): number {
  const totalSkill = team.players.reduce((sum, p) => sum + p.skillRating, 0) +
                    newPlayers.reduce((sum, p) => sum + p.skillRating, 0);
  const totalPlayers = team.players.length + newPlayers.length;
  
  return totalPlayers > 0 ? totalSkill / totalPlayers : 0;
}

function calculateOverallAverageSkill(teams: Team[]): number {
  const allPlayers = teams.flatMap(t => t.players);
  const totalSkill = allPlayers.reduce((sum, p) => sum + p.skillRating, 0);
  
  return allPlayers.length > 0 ? totalSkill / allPlayers.length : 0;
}

function balanceTeamsBySkill(teams: Team[], playerMap: Map<string, Player>): void {
  const maxIterations = 10;
  
  for (let i = 0; i < maxIterations; i++) {
    let swapMade = false;
    
    // Sort teams by average skill
    const sortedTeams = [...teams].sort((a, b) => a.averageSkill - b.averageSkill);
    
    for (let j = 0; j < sortedTeams.length - 1; j++) {
      const weakerTeam = sortedTeams[j];
      const strongerTeam = sortedTeams[j + 1];
      
      if (Math.abs(weakerTeam.averageSkill - strongerTeam.averageSkill) < 0.5) break;
      
      // Try to find beneficial swaps
      for (const weakPlayer of weakerTeam.players) {
        for (const strongPlayer of strongerTeam.players) {
          // Check if swap would create avoid conflicts
          const weakTeamAfterSwap = {
            ...weakerTeam,
            players: weakerTeam.players.filter(p => p.id !== weakPlayer.id).concat(strongPlayer)
          };
          const strongTeamAfterSwap = {
            ...strongerTeam,
            players: strongerTeam.players.filter(p => p.id !== strongPlayer.id).concat(weakPlayer)
          };
          
          const wouldCreateConflicts = 
            hasAvoidConflict(weakPlayer, strongTeamAfterSwap, playerMap) ||
            hasAvoidConflict(strongPlayer, weakTeamAfterSwap, playerMap);
          
          if (!wouldCreateConflicts && wouldImproveBalance(weakerTeam, strongerTeam, weakPlayer, strongPlayer)) {
            // Perform swap
            swapPlayers(weakerTeam, strongerTeam, weakPlayer, strongPlayer);
            swapMade = true;
            break;
          }
        }
        if (swapMade) break;
      }
      if (swapMade) break;
    }
    
    if (!swapMade) break;
  }
}

function wouldImproveBalance(
  team1: Team,
  team2: Team,
  player1: Player,
  player2: Player
): boolean {
  const currentDiff = Math.abs(team1.averageSkill - team2.averageSkill);
  
  // Calculate new averages after swap
  const team1NewAvg = (team1.averageSkill * team1.players.length - player1.skillRating + player2.skillRating) / team1.players.length;
  const team2NewAvg = (team2.averageSkill * team2.players.length - player2.skillRating + player1.skillRating) / team2.players.length;
  
  const newDiff = Math.abs(team1NewAvg - team2NewAvg);
  
  return newDiff < currentDiff;
}

function swapPlayers(team1: Team, team2: Team, player1: Player, player2: Player): void {
  // Remove players from current teams
  team1.players = team1.players.filter(p => p.id !== player1.id);
  team2.players = team2.players.filter(p => p.id !== player2.id);
  
  // Add players to new teams
  team1.players.push(player2);
  team2.players.push(player1);
  
  // Update team IDs
  player1.teamId = team2.id;
  player2.teamId = team1.id;
  
  // Update team stats
  updateTeamStats(team1);
  updateTeamStats(team2);
}

function createEmptyTeam(name: string): Team {
  return {
    id: generateTeamId(name),
    name,
    players: [],
    averageSkill: 0,
    genderBreakdown: { M: 0, F: 0, Other: 0 }
  };
}

function updateTeamStats(team: Team): void {
  const totalSkill = team.players.reduce((sum, p) => sum + p.skillRating, 0);
  team.averageSkill = team.players.length > 0 ? totalSkill / team.players.length : 0;
  
  team.genderBreakdown = { M: 0, F: 0, Other: 0 };
  team.players.forEach(player => {
    team.genderBreakdown[player.gender]++;
  });
}

function generateTeamId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substr(2, 5);
}

function calculateStats(
  allPlayers: Player[],
  teams: Team[],
  unassignedPlayers: Player[],
  mutualPairs: [Player, Player][],
  playerGroups: PlayerGroup[],
  startTime: number
): TeamGenerationStats {
  const assignedPlayers = teams.flatMap(t => t.players);
  
  let mutualRequestsHonored = 0;
  let mutualRequestsBroken = 0;
  
  // Count custom player groups (highest priority requests)
  for (const group of playerGroups) {
    if (group.players.length <= 1) continue; // Skip single-player groups
    
    // Check if all players in the group are on the same team
    const teamIds = group.players.map(p => p.teamId).filter(id => id !== undefined);
    const uniqueTeamIds = new Set(teamIds);
    
    if (uniqueTeamIds.size === 1 && teamIds.length === group.players.length) {
      // All group members are on the same team
      mutualRequestsHonored++;
    } else if (teamIds.length > 0) {
      // Group members are split across teams or some are unassigned
      mutualRequestsBroken++;
    }
  }
  
  // Count traditional mutual teammate requests (only if not already in custom groups)
  for (const [player1, player2] of mutualPairs) {
    // Skip if either player is in a custom group (already counted above)
    const player1InGroup = playerGroups.some(g => g.players.some(p => p.id === player1.id));
    const player2InGroup = playerGroups.some(g => g.players.some(p => p.id === player2.id));
    
    if (!player1InGroup && !player2InGroup) {
      if (player1.teamId === player2.teamId && player1.teamId) {
        mutualRequestsHonored++;
      } else {
        mutualRequestsBroken++;
      }
    }
  }
  
  // Check for avoid request violations
  let avoidRequestsViolated = 0;
  for (const team of teams) {
    for (const player of team.players) {
      for (const avoidName of player.avoidRequests) {
        if (team.players.some(p => p.name.toLowerCase() === avoidName.toLowerCase())) {
          avoidRequestsViolated++;
        }
      }
    }
  }
  
  return {
    totalPlayers: allPlayers.length,
    assignedPlayers: assignedPlayers.length,
    unassignedPlayers: unassignedPlayers.length,
    mutualRequestsHonored,
    mutualRequestsBroken,
    avoidRequestsViolated,
    generationTime: Date.now() - startTime
  };
}

function hasAvoidConflict(player: Player, team: Team, playerMap: Map<string, Player>): boolean {
  // Check if player avoids anyone on the team
  for (const avoidName of player.avoidRequests) {
    if (team.players.some(p => p.name.toLowerCase() === avoidName.toLowerCase())) {
      return true;
    }
  }

  // Check if anyone on the team avoids this player
  for (const teamPlayer of team.players) {
    if (teamPlayer.avoidRequests.some(avoidName => 
      avoidName.toLowerCase() === player.name.toLowerCase()
    )) {
      return true;
    }
  }

  return false;
}
