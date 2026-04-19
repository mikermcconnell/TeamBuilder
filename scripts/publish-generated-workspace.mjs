import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import Papa from 'papaparse';
import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const GROUP_COLORS = [
  '#3B82F6',
  '#EF4444',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#F97316',
  '#06B6D4',
  '#84CC16',
  '#EC4899',
  '#6B7280',
  '#14B8A6',
  '#F43F5E',
];

const COMMON_NICKNAMES = {
  alexander: ['alex', 'xander', 'al', 'alec', 'sandy'],
  alexandra: ['alex', 'alexa', 'sandra', 'lexi', 'ally'],
  andrew: ['andy', 'drew', 'anders'],
  anthony: ['tony', 'ant', 'toni'],
  benjamin: ['ben', 'benny', 'benji'],
  catherine: ['cathy', 'kate', 'katie', 'cat'],
  charles: ['charlie', 'chuck', 'chas'],
  christopher: ['chris', 'topher', 'kit'],
  daniel: ['dan', 'danny', 'dani'],
  david: ['dave', 'davey', 'day'],
  edward: ['ed', 'eddie', 'ted', 'ned'],
  elizabeth: ['liz', 'beth', 'betty', 'ellie', 'lisa', 'lizzy', 'libby', 'eli'],
  frederick: ['fred', 'freddy', 'rick'],
  gregory: ['greg', 'gregg', 'gregor'],
  james: ['jim', 'jimmy', 'jamie'],
  jennifer: ['jen', 'jenny', 'jenna'],
  john: ['johnny', 'jack', 'jj'],
  jonathan: ['jon', 'johnny', 'jona', 'nathan'],
  joseph: ['joe', 'joey', 'jos'],
  katherine: ['kate', 'kathy', 'katie', 'kat'],
  kenneth: ['ken', 'kenny', 'kent'],
  margaret: ['maggie', 'meg', 'peggy', 'marge'],
  matthew: ['matt', 'matty', 'thew'],
  michael: ['mike', 'micky', 'mikey', 'mick'],
  nicholas: ['nick', 'nicky', 'nico', 'cole'],
  patricia: ['pat', 'patty', 'tricia', 'trish'],
  patrick: ['pat', 'paddy', 'rick'],
  peter: ['pete', 'petey'],
  rebecca: ['becca', 'becky', 'reba'],
  richard: ['rick', 'dick', 'richie', 'rich'],
  robert: ['rob', 'bob', 'bobby', 'bert'],
  ronald: ['ron', 'ronnie', 'ronny'],
  samantha: ['sam', 'sammy', 'mantha'],
  samuel: ['sam', 'sammy', 'sami'],
  stephanie: ['steph', 'steffi', 'stephy'],
  steven: ['steve', 'stevie', 'stevo'],
  theodore: ['ted', 'teddy', 'theo'],
  thomas: ['tom', 'tommy', 'thom'],
  timothy: ['tim', 'timmy', 'timo'],
  victoria: ['vicky', 'tori', 'vic'],
  william: ['will', 'bill', 'billy', 'liam', 'willy'],
  zachary: ['zach', 'zack', 'zac'],
};

const execFileAsync = promisify(execFile);

function printUsage() {
  console.log(`
Usage:
  node scripts/publish-generated-workspace.mjs \\
    --roster <accepted-registration-csv> \\
    --teams <generated-team-csv> \\
    --project-name <name> \\
    [--project-description <text>] \\
    [--output <backup-json-path>] \\
    [--publish firestore] \\
    [--user-id <firebase-uid> | --user-email <email>] \\
    [--workspace-id <id>]

Examples:
  node scripts/publish-generated-workspace.mjs \\
    --roster "Rosters/Spring Outdoor 2026_event-registrations_2026-04-14_11_23.csv" \\
    --teams "Rosters/Spring Outdoor 2026_generated_teams.csv" \\
    --project-name "Spring Outdoor 2026 Draft"

  node scripts/publish-generated-workspace.mjs \\
    --roster "Rosters/Spring Outdoor 2026_event-registrations_2026-04-14_11_23.csv" \\
    --teams "Rosters/Spring Outdoor 2026_generated_teams.csv" \\
    --project-name "Spring Outdoor 2026 Draft" \\
    --publish firestore \\
    --user-email bulconvenor@gmail.com
`);
}

export function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

export function normalizeName(name = '') {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeAlphaName(name = '') {
  return normalizeName(name).replace(/[^a-z]/g, '');
}

function cleanUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map(item => cleanUndefinedDeep(item)).filter(item => item !== undefined);
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, innerValue]) => [key, cleanUndefinedDeep(innerValue)])
      .filter(([, innerValue]) => innerValue !== undefined);

    return Object.fromEntries(entries);
  }

  return value === undefined ? undefined : value;
}

export function parseCsv(csvText) {
  const parsed = Papa.parse(csvText.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: header => header.trim(),
  });

  const fatalErrors = parsed.errors.filter(error => error.code !== 'UndetectableDelimiter');
  if (fatalErrors.length > 0) {
    throw new Error(fatalErrors[0]?.message || 'Unable to parse CSV');
  }

  return parsed.data.map(row => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value ?? ''])
  ));
}

function getHeaderKey(row, candidates) {
  for (const candidate of candidates) {
    const key = Object.keys(row).find(header => header.trim().toLowerCase() === candidate);
    if (key) {
      return key;
    }
  }

  return '';
}

function getHeaderValue(row, candidates) {
  const key = getHeaderKey(row, candidates);
  return key ? String(row[key] ?? '').trim() : '';
}

function mergeRegistrationNotes(...values) {
  const notes = values
    .map(value => String(value ?? '').trim())
    .filter(Boolean);

  if (notes.length === 0) {
    return undefined;
  }

  return Array.from(new Set(notes)).join('\n\n');
}

function parseNewPlayerFlag(value) {
  const normalizedValue = String(value ?? '').trim().toLowerCase();

  if (!normalizedValue) {
    return undefined;
  }

  if (['y', 'yes', 'true', '1', 'new'].includes(normalizedValue)) {
    return true;
  }

  if (['n', 'no', 'false', '0', 'returning'].includes(normalizedValue)) {
    return false;
  }

  return undefined;
}

export function calculateRegistrationSkill(row) {
  const componentColumns = [
    'Athletic ability',
    'Throwing',
    'knowledge/leadership',
    'Handling',
    'Quality player',
  ];

  const values = componentColumns
    .map(column => Number.parseFloat(String(row[column] ?? '').trim()))
    .filter(value => Number.isFinite(value));

  if (values.length === 0) {
    return 5;
  }

  return Math.round(((values.reduce((sum, value) => sum + value, 0) / values.length) * 2) * 10) / 10;
}

export function namesMatch(name1, name2) {
  const normalizedName1 = normalizeAlphaName(name1);
  const normalizedName2 = normalizeAlphaName(name2);

  if (!normalizedName1 || !normalizedName2) {
    return false;
  }

  if (normalizedName1 === normalizedName2) {
    return true;
  }

  if (normalizedName1.length >= 3 && normalizedName2.length >= 3) {
    if (normalizedName1.includes(normalizedName2) || normalizedName2.includes(normalizedName1)) {
      return true;
    }
  }

  for (const [fullName, nicknames] of Object.entries(COMMON_NICKNAMES)) {
    const firstMatches = normalizedName1 === fullName || nicknames.includes(normalizedName1);
    const secondMatches = normalizedName2 === fullName || nicknames.includes(normalizedName2);

    if (firstMatches && secondMatches) {
      return true;
    }
  }

  return false;
}

function findPlayerByName(players, targetName) {
  const exactMatch = players.find(player => normalizeName(player.name) === normalizeName(targetName));
  if (exactMatch) {
    return exactMatch;
  }

  return players.find(player => namesMatch(player.name, targetName)) ?? null;
}

function parseTeammateRequests(player, allPlayers) {
  return (player.teammateRequests ?? []).map((name, index) => {
    const matchedPlayer = findPlayerByName(allPlayers, name);
    return {
      name,
      priority: index === 0 ? 'must-have' : 'nice-to-have',
      matchedPlayerId: matchedPlayer?.id,
      status: undefined,
      reason: undefined,
    };
  });
}

function detectRequestConflicts(players) {
  const conflicts = [];

  for (const player of players) {
    for (const requestedName of player.teammateRequests ?? []) {
      const requestedPlayer = findPlayerByName(players, requestedName);
      if (!requestedPlayer) {
        continue;
      }

      const isAvoided = (requestedPlayer.avoidRequests ?? []).some(avoidName => namesMatch(avoidName, player.name));
      if (isAvoided) {
        conflicts.push({
          playerId: player.id,
          playerName: player.name,
          requestedPlayerId: requestedPlayer.id,
          requestedName: requestedPlayer.name,
          conflictType: 'avoid-vs-request',
          description: `${player.name} requested ${requestedPlayer.name}, but ${requestedPlayer.name} wants to avoid ${player.name}`,
        });
      }
    }
  }

  return conflicts;
}

export function processMutualRequests(players) {
  const cleanedPlayers = players.map(player => ({
    ...player,
    teammateRequests: [],
    teammateRequestsParsed: parseTeammateRequests(player, players),
  }));
  const playerGroups = [];
  const processedPlayerIds = new Set();
  const mutualConnections = {};
  const conflicts = detectRequestConflicts(players);

  for (const player of players) {
    mutualConnections[player.id] = new Set();

    for (const requestedName of player.teammateRequests ?? []) {
      const requestedPlayer = findPlayerByName(players, requestedName);
      if (!requestedPlayer || requestedPlayer.id === player.id) {
        continue;
      }

      const isMutual = (requestedPlayer.teammateRequests ?? []).some(name => namesMatch(name, player.name));
      if (!isMutual) {
        continue;
      }

      mutualConnections[player.id].add(requestedPlayer.id);
      const cleanedPlayer = cleanedPlayers.find(current => current.id === player.id);
      if (cleanedPlayer && !cleanedPlayer.teammateRequests.includes(requestedPlayer.name)) {
        cleanedPlayer.teammateRequests.push(requestedPlayer.name);
      }
    }
  }

  let groupIndex = 0;

  for (const player of players) {
    if (processedPlayerIds.has(player.id)) {
      continue;
    }

    const connections = mutualConnections[player.id];
    if (!connections || connections.size === 0) {
      continue;
    }

    const groupPlayerIds = new Set([player.id]);
    const queue = [player.id];

    while (queue.length > 0) {
      const currentPlayerId = queue.shift();
      const currentConnections = mutualConnections[currentPlayerId];

      if (!currentConnections) {
        continue;
      }

      for (const connectedId of currentConnections) {
        if (!groupPlayerIds.has(connectedId) && !processedPlayerIds.has(connectedId) && groupPlayerIds.size < 4) {
          groupPlayerIds.add(connectedId);
          queue.push(connectedId);
        }
      }
    }

    if (groupPlayerIds.size <= 1) {
      continue;
    }

    const groupPlayers = Array.from(groupPlayerIds)
      .map(playerId => cleanedPlayers.find(candidate => candidate.id === playerId))
      .filter(Boolean);
    const group = {
      id: `group-${groupIndex}`,
      label: String.fromCharCode(65 + groupIndex),
      color: GROUP_COLORS[groupIndex % GROUP_COLORS.length],
      playerIds: Array.from(groupPlayerIds),
      players: groupPlayers,
    };

    playerGroups.push(group);

    for (const playerId of groupPlayerIds) {
      processedPlayerIds.add(playerId);
      const cleanedPlayer = cleanedPlayers.find(candidate => candidate.id === playerId);
      if (cleanedPlayer) {
        cleanedPlayer.groupId = group.id;
      }
    }

    groupIndex += 1;
  }

  for (const player of players) {
    const cleanedPlayer = cleanedPlayers.find(candidate => candidate.id === player.id);
    if (!cleanedPlayer) {
      continue;
    }

    cleanedPlayer.unfulfilledRequests = [];

    for (const [requestIndex, requestedName] of (player.teammateRequests ?? []).entries()) {
      const requestedPlayer = findPlayerByName(players, requestedName);
      if (!requestedPlayer) {
        continue;
      }

      const playerGroup = playerGroups.find(group => group.playerIds.includes(player.id));
      const requestedPlayerGroup = playerGroups.find(group => group.playerIds.includes(requestedPlayer.id));
      const inSameGroup = Boolean(playerGroup && requestedPlayerGroup && playerGroup.id === requestedPlayerGroup.id);

      if (!inSameGroup) {
        const hasConflict = conflicts.some(conflict =>
          conflict.playerId === player.id
          && conflict.requestedPlayerId === requestedPlayer.id
          && conflict.conflictType === 'avoid-vs-request'
        );
        const isMutual = (requestedPlayer.teammateRequests ?? []).some(name => namesMatch(name, player.name));

        cleanedPlayer.unfulfilledRequests.push({
          playerId: requestedPlayer.id,
          name: requestedPlayer.name,
          reason: hasConflict ? 'conflict' : isMutual ? 'group-full' : 'non-reciprocal',
          priority: requestIndex === 0 ? 'must-have' : 'nice-to-have',
        });
      }

      const parsedRequest = cleanedPlayer.teammateRequestsParsed?.find(request => request.name === requestedName);
      if (parsedRequest) {
        parsedRequest.status = inSameGroup
          ? 'honored'
          : conflicts.some(conflict =>
              conflict.playerId === player.id
              && conflict.requestedPlayerId === requestedPlayer.id
              && conflict.conflictType === 'avoid-vs-request'
            )
            ? 'conflict'
            : 'unfulfilled';
      }
    }
  }

  return { cleanedPlayers, playerGroups, conflicts };
}

export function parseAcceptedRosterRows(rows) {
  const firstRow = rows[0] ?? {};
  const hasStatusColumn = Boolean(getHeaderKey(firstRow, ['status']));
  const filteredRows = hasStatusColumn
    ? rows.filter(row => getHeaderValue(row, ['status']).toLowerCase() === 'accepted')
    : rows;
  const seenNames = new Set();

  return filteredRows.map((row, index) => {
    const firstName = getHeaderValue(row, ['first_name', 'first name']);
    const lastName = getHeaderValue(row, ['last_name', 'last name']);
    const name = `${firstName} ${lastName}`.trim() || getHeaderValue(row, ['name', 'player', 'player name']);

    if (!name) {
      throw new Error(`Roster row ${index + 2} is missing a player name.`);
    }

    const normalizedRosterName = normalizeName(name);
    if (seenNames.has(normalizedRosterName)) {
      throw new Error(`Duplicate player name found in roster CSV: "${name}".`);
    }
    seenNames.add(normalizedRosterName);

    const genderRaw = getHeaderValue(row, ['gender']).toLowerCase();
    const gender = genderRaw === 'male' || genderRaw === 'm'
      ? 'M'
      : genderRaw === 'female' || genderRaw === 'f'
        ? 'F'
        : 'Other';

    const teammateRequests = Object.entries(row)
      .filter(([key, value]) => key.toLowerCase().includes('player') && key.toLowerCase().includes('request') && String(value).trim())
      .map(([, value]) => String(value).trim());

    const doNotPlayRaw = getHeaderValue(row, ['do_not_play', 'do not play']);
    const avoidRequests = doNotPlayRaw
      && doNotPlayRaw.toLowerCase() !== 'no'
      && !doNotPlayRaw.toLowerCase().startsWith('yes:')
      ? doNotPlayRaw.split(/[,;]/).map(value => value.trim()).filter(Boolean)
      : [];

    const ageValue = getHeaderValue(row, ['age']);
    const parsedAge = ageValue ? Number.parseInt(ageValue, 10) : undefined;
    const age = Number.isFinite(parsedAge) ? parsedAge : undefined;
    const registrationInfo = mergeRegistrationNotes(
      getHeaderValue(row, ['if_applicable,_what', 'if applicable, what', 'if applicable what']),
      getHeaderValue(row, ['other_notes', 'other notes', 'registration info', 'notes']),
    );
    const email = getHeaderValue(row, ['email']);
    const isNewPlayer = parseNewPlayerFlag(getHeaderValue(row, ['new player', 'is new player', 'new', 'rookie']));

    return cleanUndefinedDeep({
      id: `player-${index + 1}-${crypto.randomUUID().slice(0, 8)}`,
      name,
      gender,
      skillRating: calculateRegistrationSkill(row),
      execSkillRating: null,
      teammateRequests,
      avoidRequests,
      ...(email ? { email } : {}),
      ...(isNewPlayer !== undefined ? { isNewPlayer } : {}),
      profile: cleanUndefinedDeep({
        age,
        registrationInfo,
      }),
    });
  });
}

export function rebuildTeamsFromCsv(players, teamRows) {
  const assignedPlayerIds = new Set();
  const teamsByName = new Map();

  for (const row of teamRows) {
    const teamName = getHeaderValue(row, ['team', 'team name']);
    const playerName = getHeaderValue(row, ['name', 'player', 'player name']);

    if (!teamName || !playerName) {
      continue;
    }

    const player = findPlayerByName(players, playerName);
    if (!player) {
      throw new Error(`Generated teams CSV references "${playerName}", but that player was not found in the roster CSV.`);
    }

    if (assignedPlayerIds.has(player.id)) {
      throw new Error(`Player "${player.name}" appears more than once in the generated teams CSV.`);
    }

    assignedPlayerIds.add(player.id);

    if (!teamsByName.has(teamName)) {
      teamsByName.set(teamName, {
        id: `team-${crypto.randomUUID().slice(0, 8)}`,
        name: teamName,
        players: [],
      });
    }

    const team = teamsByName.get(teamName);
    team.players.push({
      ...player,
      teamId: team.id,
    });
  }

  const teams = Array.from(teamsByName.values()).map(team => {
    const genderBreakdown = { M: 0, F: 0, Other: 0 };
    let handlerCount = 0;
    const totalSkill = team.players.reduce((sum, player) => {
      genderBreakdown[player.gender] += 1;
      if (player.isHandler) {
        handlerCount += 1;
      }
      return sum + (player.execSkillRating ?? player.skillRating);
    }, 0);

    return {
      ...team,
      averageSkill: team.players.length > 0 ? totalSkill / team.players.length : 0,
      genderBreakdown,
      handlerCount,
    };
  });

  const unassignedPlayers = players
    .filter(player => !assignedPlayerIds.has(player.id))
    .map(player => ({ ...player }));

  return { teams, unassignedPlayers };
}

export function buildConfigFromTeams(teams) {
  if (teams.length === 0) {
    throw new Error('Generated teams CSV did not contain any teams.');
  }

  const teamSizes = teams.map(team => team.players.length);
  const femaleCounts = teams.map(team => team.genderBreakdown.F);
  const maleCounts = teams.map(team => team.genderBreakdown.M);

  return {
    id: `imported-config-${crypto.randomUUID().slice(0, 8)}`,
    name: 'Imported Generated Teams',
    maxTeamSize: Math.max(...teamSizes),
    minFemales: Math.min(...femaleCounts),
    minMales: Math.min(...maleCounts),
    targetTeams: teams.length,
    allowMixedGender: true,
    restrictToEvenTeams: false,
  };
}

function buildAssignmentMap(teams, unassignedPlayers) {
  const assignmentMap = new Map();

  for (const team of teams) {
    for (const player of team.players ?? []) {
      assignmentMap.set(player.id, team.id);
    }
  }

  for (const player of unassignedPlayers ?? []) {
    assignmentMap.set(player.id, null);
  }

  return assignmentMap;
}

export function buildStats(players, teams, unassignedPlayers, conflicts = []) {
  const assignmentMap = buildAssignmentMap(teams, unassignedPlayers);
  let mutualRequestsHonored = 0;
  let mutualRequestsBroken = 0;
  let mustHaveRequestsHonored = 0;
  let mustHaveRequestsBroken = 0;
  let niceToHaveRequestsHonored = 0;
  let niceToHaveRequestsBroken = 0;
  let avoidRequestsViolated = 0;

  for (const player of players) {
    const playerTeamId = assignmentMap.get(player.id);

    for (const request of player.teammateRequestsParsed ?? []) {
      if (!request.matchedPlayerId) {
        continue;
      }

      const requestedPlayerTeamId = assignmentMap.get(request.matchedPlayerId);
      const honored = Boolean(playerTeamId && requestedPlayerTeamId && playerTeamId === requestedPlayerTeamId);

      if (request.priority === 'must-have') {
        if (honored) {
          mustHaveRequestsHonored += 1;
        } else {
          mustHaveRequestsBroken += 1;
        }
      } else if (honored) {
        niceToHaveRequestsHonored += 1;
      } else {
        niceToHaveRequestsBroken += 1;
      }

      const matchedPlayer = players.find(candidate => candidate.id === request.matchedPlayerId);
      const isMutual = Boolean(
        matchedPlayer
        && (matchedPlayer.teammateRequestsParsed ?? []).some(candidate => candidate.matchedPlayerId === player.id)
      );

      if (isMutual) {
        if (honored) {
          mutualRequestsHonored += 1;
        } else {
          mutualRequestsBroken += 1;
        }
      }
    }

    for (const avoidName of player.avoidRequests ?? []) {
      const avoidedPlayer = findPlayerByName(players, avoidName);
      if (!avoidedPlayer) {
        continue;
      }

      const avoidedPlayerTeamId = assignmentMap.get(avoidedPlayer.id);
      if (playerTeamId && avoidedPlayerTeamId && playerTeamId === avoidedPlayerTeamId) {
        avoidRequestsViolated += 1;
      }
    }
  }

  return {
    totalPlayers: players.length,
    assignedPlayers: players.length - unassignedPlayers.length,
    unassignedPlayers: unassignedPlayers.length,
    mutualRequestsHonored,
    mutualRequestsBroken,
    mustHaveRequestsHonored,
    mustHaveRequestsBroken,
    niceToHaveRequestsHonored,
    niceToHaveRequestsBroken,
    avoidRequestsViolated,
    conflictsDetected: conflicts.length,
    generationTime: 0,
  };
}

export function buildWorkspacePayload({
  projectName,
  projectDescription,
  userId,
  workspaceId,
  players,
  teams,
  unassignedPlayers,
  playerGroups,
  config,
  stats,
}) {
  const iterationId = `generated-iteration-${crypto.randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  const teamIteration = {
    id: iterationId,
    name: 'AI Draft 1',
    type: 'generated',
    status: 'ready',
    generationSource: 'generated',
    teams,
    unassignedPlayers,
    stats,
    createdAt,
  };

  const data = {
    players,
    teams,
    unassignedPlayers,
    playerGroups,
    config,
    execRatingHistory: {},
    savedConfigs: [],
    stats,
    teamIterations: [teamIteration],
    activeTeamIterationId: iterationId,
    leagueMemory: [],
  };

  const workspace = cleanUndefinedDeep({
    id: workspaceId ?? `workspace-${crypto.randomUUID().slice(0, 8)}`,
    userId,
    name: projectName,
    description: projectDescription,
    players,
    playerGroups,
    config,
    teams,
    unassignedPlayers,
    stats,
    teamIterations: [teamIteration],
    activeTeamIterationId: iterationId,
    leagueMemory: [],
    version: 1,
    createdAt,
    updatedAt: createdAt,
  });

  const backup = {
    format: 'team-builder-project-backup',
    version: 1,
    exportedAt: createdAt,
    project: {
      name: projectName,
      description: projectDescription,
      sourceWorkspaceId: workspace.id,
    },
    data,
  };

  return { workspace, backup };
}

export function createGeneratedWorkspaceFromCsvTexts({
  rosterCsvText,
  teamCsvText,
  projectName,
  projectDescription = '',
  workspaceId,
  userId = 'backup-export',
}) {
  const rosterRows = parseCsv(rosterCsvText);
  const teamRows = parseCsv(teamCsvText);
  const acceptedPlayers = parseAcceptedRosterRows(rosterRows);
  const { cleanedPlayers, playerGroups, conflicts } = processMutualRequests(acceptedPlayers);
  const { teams, unassignedPlayers } = rebuildTeamsFromCsv(cleanedPlayers, teamRows);
  const config = buildConfigFromTeams(teams);
  const stats = buildStats(cleanedPlayers, teams, unassignedPlayers, conflicts);
  const { workspace, backup } = buildWorkspacePayload({
    projectName,
    projectDescription,
    userId,
    workspaceId,
    players: cleanedPlayers,
    teams,
    unassignedPlayers,
    playerGroups,
    config,
    stats,
  });

  return {
    players: cleanedPlayers,
    teams,
    unassignedPlayers,
    playerGroups,
    config,
    stats,
    conflicts,
    workspace,
    backup,
  };
}

async function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');

  try {
    const envContents = await fs.readFile(envPath, 'utf8');
    envContents
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .forEach(line => {
        const separatorIndex = line.indexOf('=');
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

        if (!process.env[key]) {
          process.env[key] = value;
        }
      });
  } catch {
    // Optional file; ignore if absent.
  }
}

async function getServiceAccountCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    return cert(JSON.parse(serviceAccountJson));
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);
    const fileContents = await fs.readFile(resolvedPath, 'utf8');
    return cert(JSON.parse(fileContents));
  }

  return null;
}

function getGoogleApplicationCredentialsPath() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return envPath ? path.resolve(process.cwd(), envPath) : null;
}

function getFirebaseCliConfigPaths() {
  return [
    path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json'),
    path.join(process.env.APPDATA ?? '', 'configstore', 'firebase-tools.json'),
    path.join(process.env.LOCALAPPDATA ?? '', 'configstore', 'firebase-tools.json'),
  ].filter(Boolean);
}

async function refreshFirebaseCliAccessToken() {
  const firebaseBinary = process.platform === 'win32' ? 'firebase.cmd' : 'firebase';

  try {
    await execFileAsync(firebaseBinary, ['projects:list', '--json'], {
      cwd: process.cwd(),
      windowsHide: true,
      timeout: 30_000,
    });
  } catch {
    // Best effort only. If this fails, we still try the last cached token.
  }
}

async function getFirebaseCliAccessToken() {
  await refreshFirebaseCliAccessToken();

  for (const candidatePath of getFirebaseCliConfigPaths()) {
    try {
      const rawConfig = await fs.readFile(candidatePath, 'utf8');
      const parsedConfig = JSON.parse(rawConfig);
      const accessToken = parsedConfig?.tokens?.access_token;

      if (typeof accessToken === 'string' && accessToken.trim()) {
        return accessToken.trim();
      }
    } catch {
      // Keep checking other candidate paths.
    }
  }

  return null;
}

function shouldUseFirebaseCliRestFallback() {
  return !process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    && !process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    && !process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

function buildFirestoreDocumentName(workspaceId) {
  const projectId = getFirebaseProjectId();

  if (!projectId) {
    throw new Error('Missing Firebase project ID. Set FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID.');
  }

  return `projects/${projectId}/databases/(default)/documents/workspaces/${workspaceId}`;
}

export function toFirestoreValue(value) {
  if (value === null) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(item => toFirestoreValue(item)),
      },
    };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot serialize non-finite number to Firestore: ${value}`);
    }

    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }

  if (value && typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .filter(([, innerValue]) => innerValue !== undefined)
            .map(([key, innerValue]) => [key, toFirestoreValue(innerValue)])
        ),
      },
    };
  }

  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

async function fetchJsonWithFirebaseCliAccessToken(url, options = {}) {
  const accessToken = await getFirebaseCliAccessToken();

  if (!accessToken) {
    throw new Error(
      'No Firebase CLI access token found. Run "pnpm firebase:whoami" or "firebase login" on this machine first.'
    );
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const responseText = await response.text();
  const parsedResponse = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw new Error(parsedResponse?.error?.message ?? `Firebase API request failed with status ${response.status}`);
  }

  return parsedResponse;
}

async function resolveUserIdViaFirebaseCli({ userId, userEmail }) {
  if (userId) {
    return userId;
  }

  if (!userEmail) {
    throw new Error('Publishing to Firestore requires --user-id or --user-email.');
  }

  const projectId = getFirebaseProjectId();
  if (!projectId) {
    throw new Error('Missing Firebase project ID. Set FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID.');
  }

  const response = await fetchJsonWithFirebaseCliAccessToken(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
    {
      method: 'POST',
      body: JSON.stringify({ email: [userEmail] }),
    }
  );

  const matchedUser = response?.users?.[0];
  if (!matchedUser?.localId) {
    throw new Error(`No Firebase Auth user found for email ${userEmail}.`);
  }

  return matchedUser.localId;
}

async function publishWorkspaceToFirestoreViaFirebaseCli(workspace) {
  const documentName = buildFirestoreDocumentName(workspace.id);

  await fetchJsonWithFirebaseCliAccessToken(
    `https://firestore.googleapis.com/v1/projects/${getFirebaseProjectId()}/databases/(default)/documents:commit`,
    {
      method: 'POST',
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: documentName,
              fields: toFirestoreValue(workspace).mapValue.fields,
            },
          },
        ],
      }),
    }
  );
}

function getFirebaseProjectId() {
  return process.env.FIREBASE_PROJECT_ID
    ?? process.env.VITE_FIREBASE_PROJECT_ID
    ?? process.env.GCLOUD_PROJECT
    ?? null;
}

async function getFirebaseAdminApp() {
  const existingApp = getApps().length > 0 ? getApp() : null;
  if (existingApp) {
    return existingApp;
  }

  const projectId = getFirebaseProjectId();
  const credential = await getServiceAccountCredential();
  const googleApplicationCredentialsPath = getGoogleApplicationCredentialsPath();

  if (credential) {
    return initializeApp({
      projectId: projectId ?? undefined,
      credential,
    });
  }

  if (googleApplicationCredentialsPath) {
    return initializeApp({
      projectId: projectId ?? undefined,
      credential: applicationDefault(),
    });
  }

  return initializeApp({
    projectId: projectId ?? undefined,
    credential: applicationDefault(),
  });
}

async function resolveUserId({ userId, userEmail }) {
  if (shouldUseFirebaseCliRestFallback()) {
    return resolveUserIdViaFirebaseCli({ userId, userEmail });
  }

  if (userId) {
    return userId;
  }

  if (!userEmail) {
    throw new Error('Publishing to Firestore requires --user-id or --user-email.');
  }

  const auth = getAuth(await getFirebaseAdminApp());
  const userRecord = await auth.getUserByEmail(userEmail);
  return userRecord.uid;
}

async function publishWorkspaceToFirestore(workspace) {
  if (shouldUseFirebaseCliRestFallback()) {
    await publishWorkspaceToFirestoreViaFirebaseCli(workspace);
    return;
  }

  const firestore = getFirestore(await getFirebaseAdminApp());
  await firestore.collection('workspaces').doc(workspace.id).set(workspace, { merge: true });
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);

  if (options.help || !options.roster || !options.teams || !options['project-name']) {
    printUsage();
    process.exit(options.help ? 0 : 1);
  }

  await loadLocalEnv();

  const rosterPath = path.resolve(process.cwd(), String(options.roster));
  const teamsPath = path.resolve(process.cwd(), String(options.teams));
  const projectName = String(options['project-name']).trim();
  const projectDescription = String(options['project-description'] ?? '').trim();
  const outputPath = path.resolve(
    process.cwd(),
    String(options.output ?? `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-backup.json`)
  );

  const rosterText = await fs.readFile(rosterPath, 'utf8');
  const teamsText = await fs.readFile(teamsPath, 'utf8');

  let resolvedUserId = String(options['user-id'] ?? '').trim() || undefined;

  if (String(options.publish ?? '').toLowerCase() === 'firestore') {
    resolvedUserId = await resolveUserId({
      userId: resolvedUserId,
      userEmail: String(options['user-email'] ?? '').trim() || undefined,
    });
  }

  const result = createGeneratedWorkspaceFromCsvTexts({
    rosterCsvText: rosterText,
    teamCsvText: teamsText,
    projectName,
    projectDescription,
    workspaceId: String(options['workspace-id'] ?? '').trim() || undefined,
    userId: resolvedUserId ?? 'backup-export',
  });

  await fs.writeFile(outputPath, `${JSON.stringify(result.backup, null, 2)}\n`, 'utf8');

  console.log(`Created backup: ${path.relative(process.cwd(), outputPath)}`);
  console.log(`Accepted players: ${result.players.length}`);
  console.log(`Teams: ${result.teams.length}`);
  console.log(`Unassigned players: ${result.unassignedPlayers.length}`);
  console.log(`Request groups: ${result.playerGroups.length}`);
  console.log(`Team sizes: ${result.teams.map(team => team.players.length).join(', ')}`);

  if (String(options.publish ?? '').toLowerCase() === 'firestore') {
    await publishWorkspaceToFirestore(result.workspace);
    console.log(`Published workspace ${result.workspace.id} to Firestore for user ${result.workspace.userId}`);
  } else {
    console.log('Skipping Firestore publish. Use --publish firestore to write directly into the app.');
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';

if (import.meta.url === invokedPath) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
