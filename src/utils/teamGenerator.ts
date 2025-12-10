import { Player, Team, LeagueConfig, TeamGenerationStats, PlayerGroup } from '@/types';
import { fuzzyMatcher } from './fuzzyNameMatcher';

export interface GenerationResult {
  teams: Team[];
  unassignedPlayers: Player[];
  stats: TeamGenerationStats;
}

export function generateBalancedTeams(
  players: Player[],
  config: LeagueConfig,
  playerGroups: PlayerGroup[] = [],
  randomize: boolean = false,
  manualMode: boolean = false
): GenerationResult {
  const startTime = Date.now();

  // Create player lookup for quick access
  const playerMap = new Map(players.map(p => [p.name.toLowerCase(), p]));

  if (manualMode) {
    return generateManualTeams(players, config, playerGroups, startTime, playerMap);
  }

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

      if (randomTeam) {
        // Assign entire group to the selected team
        for (const player of group) {
          player.teamId = randomTeam.id;
          randomTeam.players.push(player);
        }
        updateTeamStats(randomTeam);
      }
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

function generateManualTeams(
  players: Player[],
  config: LeagueConfig,
  playerGroups: PlayerGroup[],
  startTime: number,
  playerMap: Map<string, Player>
): GenerationResult {
  // Create empty teams based on targetTeams configuration
  const targetTeams = config.targetTeams || Math.ceil(players.length / config.maxTeamSize);

  const teams: Team[] = [];
  for (let i = 0; i < targetTeams; i++) {
    teams.push(createEmptyTeam(`Team ${i + 1}`));
  }

  // In manual mode, leave ALL players unassigned for manual assignment
  // Clear any existing team assignments and add all players to unassigned
  const unassignedPlayers: Player[] = [];

  players.forEach(player => {
    player.teamId = undefined; // Clear any existing team assignment
    unassignedPlayers.push(player);
  });

  const stats = calculateStats(players, teams, unassignedPlayers, [], playerGroups, startTime);

  return {
    teams: teams,
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

    // Prefer teams that would have better skill balance and handler balance
    const aNewAvg = calculateNewAverageSkill(a, group);
    const bNewAvg = calculateNewAverageSkill(b, group);
    const targetAvg = calculateOverallAverageSkill(teams);

    const aDiff = Math.abs(aNewAvg - targetAvg);
    const bDiff = Math.abs(bNewAvg - targetAvg);

    // Handler balance check
    const aHandlers = (a.handlerCount || 0) + group.filter(p => p.isHandler).length;
    const bHandlers = (b.handlerCount || 0) + group.filter(p => p.isHandler).length;
    const targetHandlers = 3; // Target 3 handlers per team

    const aHandlerDiff = Math.abs(aHandlers - targetHandlers);
    const bHandlerDiff = Math.abs(bHandlers - targetHandlers);

    // Weight handler balance slightly less than skill balance but significant enough
    return (aDiff + aHandlerDiff * 0.5) - (bDiff + bHandlerDiff * 0.5);
  })[0] ?? null;
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
  const totalSkill = team.players.reduce((sum, p) => sum + (p.execSkillRating !== null ? p.execSkillRating : p.skillRating), 0) +
    newPlayers.reduce((sum, p) => sum + (p.execSkillRating !== null ? p.execSkillRating : p.skillRating), 0);
  const totalPlayers = team.players.length + newPlayers.length;

  return totalPlayers > 0 ? totalSkill / totalPlayers : 0;
}

function calculateOverallAverageSkill(teams: Team[]): number {
  const allPlayers = teams.flatMap(t => t.players);
  const totalSkill = allPlayers.reduce((sum, p) => sum + (p.execSkillRating !== null ? p.execSkillRating : p.skillRating), 0);

  return allPlayers.length > 0 ? totalSkill / allPlayers.length : 0;
}

function balanceTeamsBySkill(teams: Team[], playerMap: Map<string, Player>): void {
  const maxIterations = 5; // Reduced iterations for performance
  const minImprovementThreshold = 0.1; // Stop if improvement is minimal

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let bestSwap: { team1: Team; team2: Team; player1: Player; player2: Player; improvement: number } | null = null;

    // Sort teams by average skill once per iteration
    const sortedTeams = [...teams].sort((a, b) => a.averageSkill - b.averageSkill);

    // Early termination if teams are already balanced
    const skillRange = sortedTeams[sortedTeams.length - 1].averageSkill - sortedTeams[0].averageSkill;
    if (skillRange < 0.5) break;

    // Only check adjacent teams and a few most imbalanced pairs
    const pairsToCheck: [Team, Team][] = [];

    // Add adjacent teams
    for (let i = 0; i < sortedTeams.length - 1; i++) {
      pairsToCheck.push([sortedTeams[i], sortedTeams[i + 1]]);
    }

    // Add most imbalanced pair if not already included
    if (sortedTeams.length > 2) {
      const firstTeam = sortedTeams[0];
      const lastTeam = sortedTeams[sortedTeams.length - 1];
      if (firstTeam && lastTeam) {
        pairsToCheck.push([firstTeam, lastTeam]);
      }
    }

    // Find single best swap across all team pairs
    for (const [weakerTeam, strongerTeam] of pairsToCheck) {
      const currentDiff = Math.abs(weakerTeam.averageSkill - strongerTeam.averageSkill);

      // Skip if already balanced
      if (currentDiff < 0.5) continue;

      // Sample players instead of checking all combinations
      const weakPlayers = samplePlayers(weakerTeam.players, 5); // Check max 5 players
      const strongPlayers = samplePlayers(strongerTeam.players, 5); // Check max 5 players

      for (const weakPlayer of weakPlayers) {
        for (const strongPlayer of strongPlayers) {
          // Quick check: Skip if swap wouldn't help
          const weakSkill = weakPlayer.execSkillRating !== null ? weakPlayer.execSkillRating : weakPlayer.skillRating;
          const strongSkill = strongPlayer.execSkillRating !== null ? strongPlayer.execSkillRating : strongPlayer.skillRating;
          if (weakSkill >= strongSkill) continue;

          // Check if swap would create avoid conflicts
          const wouldCreateConflicts =
            hasAvoidConflict(weakPlayer, strongerTeam, playerMap) ||
            hasAvoidConflict(strongPlayer, weakerTeam, playerMap);

          if (!wouldCreateConflicts) {
            const improvement = calculateSwapImprovement(
              weakerTeam, strongerTeam, weakPlayer, strongPlayer
            );

            if (improvement > minImprovementThreshold &&
              (!bestSwap || improvement > bestSwap.improvement)) {
              bestSwap = {
                team1: weakerTeam,
                team2: strongerTeam,
                player1: weakPlayer,
                player2: strongPlayer,
                improvement
              };
            }
          }
        }
      }
    }

    // Perform the best swap found
    if (bestSwap && bestSwap.improvement > minImprovementThreshold) {
      swapPlayers(bestSwap.team1, bestSwap.team2, bestSwap.player1, bestSwap.player2);
    } else {
      // No meaningful improvement found, stop
      break;
    }
  }
}

// Helper function to sample a subset of players for performance
function samplePlayers(players: Player[], maxSample: number): Player[] {
  if (players.length <= maxSample) return players;

  // Sort by skill rating to get diverse sample
  const sorted = [...players].sort((a, b) => {
    const aSkill = a.execSkillRating !== null ? a.execSkillRating : a.skillRating;
    const bSkill = b.execSkillRating !== null ? b.execSkillRating : b.skillRating;
    return aSkill - bSkill;
  });
  const sample: Player[] = [];
  const step = Math.floor(players.length / maxSample);

  for (let i = 0; i < players.length && sample.length < maxSample; i += step) {
    sample.push(sorted[i]);
  }

  return sample;
}

// Calculate the improvement a swap would make
function calculateSwapImprovement(
  team1: Team,
  team2: Team,
  player1: Player,
  player2: Player
): number {
  // Guard against division by zero with empty teams
  if (team1.players.length === 0 || team2.players.length === 0) {
    return 0; // No improvement possible with empty teams
  }

  const currentDiff = Math.abs(team1.averageSkill - team2.averageSkill);

  // Calculate new averages after swap
  const p1Skill = player1.execSkillRating !== null ? player1.execSkillRating : player1.skillRating;
  const p2Skill = player2.execSkillRating !== null ? player2.execSkillRating : player2.skillRating;
  const team1NewAvg = (team1.averageSkill * team1.players.length - p1Skill + p2Skill) / team1.players.length;
  const team2NewAvg = (team2.averageSkill * team2.players.length - p2Skill + p1Skill) / team2.players.length;

  const newDiff = Math.abs(team1NewAvg - team2NewAvg);

  // Handler balance improvement
  const targetHandlers = 3;
  const t1Handlers = team1.handlerCount || 0;
  const t2Handlers = team2.handlerCount || 0;

  const currentHandlerDiff = Math.abs(t1Handlers - targetHandlers) + Math.abs(t2Handlers - targetHandlers);

  const p1IsHandler = player1.isHandler ? 1 : 0;
  const p2IsHandler = player2.isHandler ? 1 : 0;

  const t1NewHandlers = t1Handlers - p1IsHandler + p2IsHandler;
  const t2NewHandlers = t2Handlers - p2IsHandler + p1IsHandler;

  const newHandlerDiff = Math.abs(t1NewHandlers - targetHandlers) + Math.abs(t2NewHandlers - targetHandlers);

  const skillImprovement = currentDiff - newDiff;
  const handlerImprovement = (currentHandlerDiff - newHandlerDiff) * 0.5; // Weight handler improvement

  return skillImprovement + handlerImprovement; // Positive value means improvement
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
    genderBreakdown: { M: 0, F: 0, Other: 0 },
    handlerCount: 0
  };
}

function updateTeamStats(team: Team): void {
  const totalSkill = team.players.reduce((sum, p) => sum + (p.execSkillRating !== null ? p.execSkillRating : p.skillRating), 0);
  team.averageSkill = team.players.length > 0 ? totalSkill / team.players.length : 0;

  team.genderBreakdown = { M: 0, F: 0, Other: 0 };
  team.handlerCount = 0;
  team.players.forEach(player => {
    team.genderBreakdown[player.gender]++;
    if (player.isHandler) {
      team.handlerCount = (team.handlerCount || 0) + 1;
    }
  });
}

function generateTeamId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).slice(2, 7);
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
  let mustHaveRequestsHonored = 0;
  let mustHaveRequestsBroken = 0;
  let niceToHaveRequestsHonored = 0;
  let niceToHaveRequestsBroken = 0;
  let conflictsDetected = 0;

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

  // Check for avoid request violations (with fuzzy matching)
  let avoidRequestsViolated = 0;
  for (const team of teams) {
    for (const player of team.players) {
      for (const avoidName of player.avoidRequests) {
        if (team.players.some(p => fuzzyMatcher.isLikelyMatch(avoidName, p.name, 0.8))) {
          avoidRequestsViolated++;
        }
      }
    }
  }

  // Calculate must-have vs nice-to-have stats based on request index
  // First request (index 0) = must-have, rest = nice-to-have
  for (const player of allPlayers) {
    player.teammateRequests.forEach((requestedName, index) => {
      const isMustHave = index === 0;

      // Find if requested player exists
      const requestedPlayer = allPlayers.find(
        p => p.name.toLowerCase() === requestedName.toLowerCase() ||
          fuzzyMatcher.isLikelyMatch(requestedName, p.name, 0.8)
      );

      if (!requestedPlayer) return;

      // Check if request is honored (same team)
      const playerTeam = teams.find(t => t.players.some(p => p.id === player.id));
      const requestedPlayerTeam = teams.find(t => t.players.some(p => p.id === requestedPlayer.id));
      const isHonored = playerTeam && requestedPlayerTeam && playerTeam.id === requestedPlayerTeam.id;

      // Check for avoid conflict
      const hasConflict = requestedPlayer.avoidRequests.some(
        avoidName => fuzzyMatcher.isLikelyMatch(avoidName, player.name, 0.8)
      );

      if (hasConflict) {
        conflictsDetected++;
      }

      if (isMustHave) {
        if (isHonored) {
          mustHaveRequestsHonored++;
        } else {
          mustHaveRequestsBroken++;
        }
      } else {
        if (isHonored) {
          niceToHaveRequestsHonored++;
        } else {
          niceToHaveRequestsBroken++;
        }
      }
    });
  }

  return {
    totalPlayers: allPlayers.length,
    assignedPlayers: assignedPlayers.length,
    unassignedPlayers: unassignedPlayers.length,
    mutualRequestsHonored,
    mutualRequestsBroken,
    mustHaveRequestsHonored,
    mustHaveRequestsBroken,
    niceToHaveRequestsHonored,
    niceToHaveRequestsBroken,
    avoidRequestsViolated,
    conflictsDetected,
    generationTime: Date.now() - startTime
  };
}

function hasAvoidConflict(player: Player, team: Team, playerMap: Map<string, Player>): boolean {
  const teamPlayerNames = team.players.map(p => p.name);

  // Check if player avoids anyone on the team (with fuzzy matching)
  for (const avoidName of player.avoidRequests) {
    for (const teamPlayerName of teamPlayerNames) {
      if (fuzzyMatcher.isLikelyMatch(avoidName, teamPlayerName, 0.8)) {
        return true;
      }
    }
  }

  // Check if anyone on the team avoids this player (with fuzzy matching)
  for (const teamPlayer of team.players) {
    for (const avoidName of teamPlayer.avoidRequests) {
      if (fuzzyMatcher.isLikelyMatch(avoidName, player.name, 0.8)) {
        return true;
      }
    }
  }

  return false;
}
