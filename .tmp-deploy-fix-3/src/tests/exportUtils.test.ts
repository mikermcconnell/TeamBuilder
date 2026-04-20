import { describe, expect, it } from 'vitest';

import type { LeagueConfig, Player, PlayerGroup, Team, TeamGenerationStats } from '@/types';
import { exportTeamSummaryToCSV, exportTeamsToCSV, generateLeagueOrganizerSummary, generateTeamReport } from '@/utils/exportUtils';

function createPlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'name' | 'gender'>): Player {
  return {
    skillRating: 5,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
    ...overrides,
  };
}

function createTeam(overrides: Partial<Team> & Pick<Team, 'id' | 'name' | 'players' | 'averageSkill' | 'genderBreakdown'>): Team {
  return {
    ...overrides,
  };
}

describe('exportUtils', () => {
  const playerGroups: PlayerGroup[] = [
    {
      id: 'group-a',
      label: 'A',
      color: '#3B82F6',
      playerIds: ['p1'],
      players: [],
    },
  ];

  const config: LeagueConfig = {
    id: 'league-1',
    name: 'League',
    maxTeamSize: 2,
    minFemales: 0,
    minMales: 0,
    targetTeams: 2,
    allowMixedGender: true,
  };

  const stats: TeamGenerationStats = {
    totalPlayers: 3,
    assignedPlayers: 2,
    unassignedPlayers: 1,
    mutualRequestsHonored: 1,
    mutualRequestsBroken: 0,
    mustHaveRequestsHonored: 1,
    mustHaveRequestsBroken: 0,
    niceToHaveRequestsHonored: 0,
    niceToHaveRequestsBroken: 0,
    avoidRequestsViolated: 0,
    conflictsDetected: 0,
    generationTime: 42,
  };

  it('exports detailed team CSV with exec ratings, groups, and unassigned players', () => {
    const team: Team = createTeam({
      id: 'team-1',
      name: 'Sharks',
      colorName: 'Ocean Blue',
      players: [
        createPlayer({
          id: 'p1',
          name: 'Alice "Ace" Adams',
          gender: 'F',
          skillRating: 7,
          execSkillRating: 8.5,
        }),
        createPlayer({
          id: 'p2',
          name: 'Bob Brown',
          gender: 'M',
          skillRating: 6,
          execSkillRating: null,
        }),
      ],
      averageSkill: 7.25,
      genderBreakdown: { M: 1, F: 1, Other: 0 },
    });

    const unassigned = [
      createPlayer({
        id: 'p3',
        name: 'Charlie Cruz',
        gender: 'Other',
        skillRating: 4,
        execSkillRating: null,
      }),
    ];

    const csv = exportTeamsToCSV([team], unassigned, playerGroups);

    expect(csv).toContain('"Team","Team Color","Player Name","Gender","Skill Rating","Exec Skill Rating","Player Group"');
    expect(csv).toContain('"Sharks","Ocean Blue","Alice ""Ace"" Adams","F","7","8.5","A","7.25","2","1","1","0"');
    expect(csv).toContain('"Sharks","","Bob Brown","M","6","N/A",""');
    expect(csv).toContain('"UNASSIGNED PLAYERS"');
    expect(csv).toContain('"UNASSIGNED","","Charlie Cruz","Other","4","N/A",""');
  });

  it('exports a readable summary CSV with stats and player group labels', () => {
    const team: Team = createTeam({
      id: 'team-1',
      name: 'Sharks',
      colorName: 'Ocean Blue',
      players: [
        createPlayer({ id: 'p1', name: 'Alice Adams', gender: 'F', skillRating: 7, execSkillRating: 8 }),
        createPlayer({ id: 'p2', name: 'Bob Brown', gender: 'M', skillRating: 6, execSkillRating: 6 }),
      ],
      averageSkill: 7,
      genderBreakdown: { M: 1, F: 1, Other: 0 },
    });

    const summaryCsv = exportTeamSummaryToCSV([team], playerGroups, config, stats);

    expect(summaryCsv).toContain('"Team Name","Team Color","Total Players","Average Skill","Males","Females","Other","Player Groups","Skill Variance","Player Names"');
    expect(summaryCsv).toContain('"Sharks","Ocean Blue","2","7.00","1","1","0","A","1.00","Alice Adams; Bob Brown"');
    expect(summaryCsv).toContain('"LEAGUE SUMMARY"');
    expect(summaryCsv).toContain('"Total Players","3"');
    expect(summaryCsv).toContain('"Assigned Players","2"');
    expect(summaryCsv).toContain('"Unassigned Players","1"');
    expect(summaryCsv).toContain('"Mutual Requests Honored","1"');
    expect(summaryCsv).toContain('"Generation Time (ms)","42"');
  });

  it('generates a report that includes team, request, group, and stats sections', () => {
    const team: Team = createTeam({
      id: 'team-1',
      name: 'Sharks',
      players: [
        createPlayer({
          id: 'p1',
          name: 'Alice Adams',
          gender: 'F',
          skillRating: 7,
          execSkillRating: 8,
          teammateRequests: ['Bob Brown'],
          avoidRequests: [],
        }),
        createPlayer({
          id: 'p2',
          name: 'Bob Brown',
          gender: 'M',
          skillRating: 6,
          execSkillRating: null,
          teammateRequests: [],
          avoidRequests: ['Alice Adams'],
        }),
      ],
      averageSkill: 7,
      genderBreakdown: { M: 1, F: 1, Other: 0 },
    });

    const unassignedPlayer = createPlayer({
      id: 'p3',
      name: 'Charlie Cruz',
      gender: 'Other',
      skillRating: 4,
      execSkillRating: null,
      teammateRequests: ['Alice Adams'],
      avoidRequests: ['Bob Brown'],
    });

    const report = generateTeamReport([team], [unassignedPlayer], playerGroups, config, stats);

    expect(report).toContain('TEAM BALANCING REPORT');
    expect(report).toContain('SHARKS');
    expect(report).toContain('Average Skill: 7.00');
    expect(report).toContain('Players:\n  - Alice Adams (F, Skill: 7, Exec: 8)');
    expect(report).toContain('UNASSIGNED PLAYERS');
    expect(report).toContain('- Charlie Cruz (Other, Skill: 4, Exec: N/A)');
    expect(report).toContain('  Teammate Requests: Alice Adams');
    expect(report).toContain('  Avoid Requests: Bob Brown');
    expect(report).toContain('GENERATION STATISTICS');
    expect(report).toContain('Total Players: 3');
    expect(report).toContain('Generation Time: 42ms');
    expect(report).toContain('PLAYER GROUPS');
    expect(report).toContain('Group A:');
  });

  it('generates an organizer summary with explainable scoring and risks', () => {
    const team: Team = createTeam({
      id: 'team-1',
      name: 'Sharks',
      players: [
        createPlayer({ id: 'p1', name: 'Alice Adams', gender: 'F', skillRating: 9, execSkillRating: 9 }),
        createPlayer({ id: 'p2', name: 'Bob Brown', gender: 'M', skillRating: 3, execSkillRating: 3 }),
      ],
      averageSkill: 6,
      genderBreakdown: { M: 1, F: 1, Other: 0 },
      handlerCount: 1,
    });

    const organizerSummary = generateLeagueOrganizerSummary([team], [], config, stats, [], 'Spring Draft Summary');

    expect(organizerSummary).toContain('Spring Draft Summary');
    expect(organizerSummary).toContain('Draft score:');
    expect(organizerSummary).toContain('What is working');
    expect(organizerSummary).toContain('What still needs attention');
    expect(organizerSummary).toContain('Sharks');
  });
});
