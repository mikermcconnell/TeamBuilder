import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildSeasonDraftFromRows,
  buildRequestMappingAuditFromRows,
  buildSeasonReport,
  parseCliOptions,
  parseRosterRows,
  parseRequestedNames,
  readWorkbookRows,
  validateWorkbookRowsForDrafting,
} from '../../scripts/build-season-teams';

describe('build-season-teams', () => {
  it('parses numbered and comma-separated request names', () => {
    expect(parseRequestedNames('(1) Sara Shakib, (2) Richmand Hogg (3) Molly Douglas')).toEqual([
      'Sara Shakib',
      'Richmand Hogg',
      'Molly Douglas',
    ]);
    expect(parseRequestedNames('Luke Mackey and Cali Gurr')).toEqual(['Luke Mackey', 'Cali Gurr']);
    expect(parseRequestedNames('Peter Rutkauskas & Kyle Stashuk')).toEqual(['Peter Rutkauskas', 'Kyle Stashuk']);
  });

  it('accepts dashed CLI option names from the documented command', () => {
    expect(parseCliOptions([
      '--workbook',
      'roster.xlsx',
      '--team-count',
      '10',
      '--out-dir',
      'output/summer',
      '--max-team-size',
      '11',
      '--variation-count',
      '4',
    ])).toMatchObject({
      workbook: 'roster.xlsx',
      teamCount: '10',
      outDir: 'output/summer',
      maxTeamSize: '11',
      variationCount: '4',
    });
  });

  it('uses original self rank and preserves explicit drafting metadata', () => {
    const players = parseRosterRows([
      {
        'Full Name': 'Alice Smith',
        gender: 'female',
        age: 20,
        'Self Rank No Division': 4,
        'Self Rank': 8.5,
        'Female Leader': 'yes',
        Handler: 'yes',
        'New/Returning': 'new',
      },
      {
        'Full Name': 'Bob Jones',
        gender: 'male',
        age: 45,
        'Self Rank No Division': 9,
        'Self Rank': 6.25,
        'Male Leader Tier': 'A',
        Handler: 'no',
        'New/Returning': 'returning',
      },
    ]);

    expect(players[0]).toMatchObject({
      name: 'Alice Smith',
      gender: 'F',
      skillRating: 8.5,
      labels: ['leader-a-female'],
      isHandler: true,
      isNewPlayer: true,
    });
    expect(players[1]).toMatchObject({
      name: 'Bob Jones',
      gender: 'M',
      skillRating: 6.25,
      labels: ['leader-a-male'],
      isHandler: false,
      isNewPlayer: false,
    });
  });

  it('adds Captain volunteers as Leader B labels by gender', () => {
    const players = parseRosterRows([
      {
        'Full Name': 'Alice Smith',
        gender: 'female',
        'Self Rank': 7,
        Captain: "I don't mind. If a team is in need, I'd be happy to help.",
      },
      {
        'Full Name': 'Bob Jones',
        gender: 'male',
        'Self Rank': 6,
        Captain: "Yes! I'd love to be a captain!",
      },
      {
        'Full Name': 'Cara Ng',
        gender: 'female',
        'Self Rank': 5,
        Captain: "I'd rather not. In a pinch, I'll help.",
      },
      {
        'Full Name': 'Dan Wu',
        gender: 'male',
        'Self Rank': 4,
        Captain: "I don't feel comfortable being a captain.",
      },
    ]);

    expect(players.find(player => player.name === 'Alice Smith')?.labels).toContain('leader-b-female');
    expect(players.find(player => player.name === 'Bob Jones')?.labels).toContain('leader-b-male');
    expect(players.find(player => player.name === 'Cara Ng')?.labels).not.toContain('leader-b-female');
    expect(players.find(player => player.name === 'Dan Wu')?.labels).not.toContain('leader-b-male');
  });

  it('lets female Leader A supersede female Leader B', () => {
    const players = parseRosterRows([
      {
        'Full Name': 'Alice Smith',
        gender: 'female',
        'Self Rank': 7,
        'Female Leader': 'yes',
        Captain: "Yes! I'd love to be a captain!",
      },
    ]);

    expect(players[0].labels).toContain('leader-a-female');
    expect(players[0].labels).not.toContain('leader-b-female');
  });

  it('still counts legacy heart labels as female leader coverage', () => {
    const result = buildSeasonDraftFromRows({
      rows: [
        playerRow('Alice Smith', 'female', 8, { labels: 'heart' }),
        playerRow('Bob Jones', 'male', 7, { maleLeaderTier: 'A' }),
        playerRow('Cara Ng', 'female', 6, { femaleLeader: 'yes' }),
        playerRow('Dan Wu', 'male', 5, { maleLeaderTier: 'B' }),
      ],
      teamCount: 2,
      seasonName: 'Test Season',
    });

    expect(result.players.find(player => player.name === 'Cara Ng')?.labels).toContain('leader-a-female');
    expect(result.metrics.femaleLeaderTeams).toBe(2);
  });

  it('uses registration skill level and handling columns when explicit draft fields are absent', () => {
    const players = parseRosterRows([
      {
        first_name: 'Alice',
        last_name: 'Smith',
        gender: 'female',
        'Skill Level': '7. Competitive league player',
        Handling: "4. I'm comfortable handling, but I'm usually not the #1 on my team",
      },
      {
        first_name: 'Bob',
        last_name: 'Jones',
        gender: 'male',
        'Skill Level': '5. Intermediate league player',
        Handling: "3. I can move the disc up field, but I'm not picking it up on the line or my endzone",
      },
    ]);

    expect(players[0]).toMatchObject({
      name: 'Alice Smith',
      skillRating: 7,
      isHandler: true,
    });
    expect(players[1]).toMatchObject({
      name: 'Bob Jones',
      skillRating: 5,
      isHandler: false,
    });
  });

  it('requires explicit metadata columns before workbook drafting', () => {
    expect(() => validateWorkbookRowsForDrafting([
      {
        'Full Name': 'Alice Smith',
        gender: 'female',
        'Self Rank': 8,
      },
    ])).toThrow(/missing required metadata columns/i);
  });

  it('accepts existing request columns as the must-play and nice-to-play sources', () => {
    expect(() => validateWorkbookRowsForDrafting([
      {
        'Full Name': 'Alice Smith',
        gender: 'female',
        'Self Rank': 8,
        'Player Requests': 'Bob Jones',
        'Would like to play with': 'Cara Ng',
        'Female Leader': 'yes',
        'Male Leader Tier': '',
        Handler: 'yes',
        'New/Returning': 'returning',
      },
    ])).not.toThrow();
  });

  it('accepts Labels and Handling as existing metadata sources for registration roster drafting', () => {
    expect(() => validateWorkbookRowsForDrafting([
      {
        first_name: 'Alice',
        last_name: 'Smith',
        gender: 'female',
        'Skill Level': '7. Competitive league player',
        'Player Requests': 'Bob Jones',
        'Would like to play with': 'Cara Ng',
        Labels: 'leader-b-female',
        Handling: "4. I'm comfortable handling, but I'm usually not the #1 on my team",
        'New/Returning': 'returning',
      },
    ])).not.toThrow();
  });

  it('reads CSV roster exports using the first sheet when the default workbook sheet is absent', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'team-builder-season-'));
    const csvPath = path.join(tempDir, 'roster.csv');
    fs.writeFileSync(csvPath, [
      'first_name,last_name,gender,Skill Level,Handling',
      'Alice,Smith,female,7. Competitive,4. Comfortable handling',
    ].join('\n'));

    const rows = readWorkbookRows(csvPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      first_name: 'Alice',
      last_name: 'Smith',
    });
  });

  it('keeps only mutual Player Requests as hard groups', () => {
    const result = buildSeasonDraftFromRows({
      rows: [
        playerRow('Alice Smith', 'female', 8, { playerRequests: 'Bob Jones' }),
        playerRow('Bob Jones', 'male', 7, { playerRequests: 'Alice Smith' }),
        playerRow('Cara Ng', 'female', 6, { playerRequests: 'Dan Wu' }),
        playerRow('Dan Wu', 'male', 5),
      ],
      teamCount: 2,
      seasonName: 'Test Season',
    });

    const aliceTeam = result.teams.find(team => team.players.some(player => player.name === 'Alice Smith'));
    const bobTeam = result.teams.find(team => team.players.some(player => player.name === 'Bob Jones'));

    expect(aliceTeam?.id).toBe(bobTeam?.id);
    expect(result.hardGroups.map(group => group.playerNames.sort())).toContainEqual(['Alice Smith', 'Bob Jones']);
    expect(result.hardGroups.map(group => group.playerNames.sort())).not.toContainEqual(['Cara Ng', 'Dan Wu']);
  });

  it('auto-matches clear nickname and spelling variants before grouping', () => {
    const result = buildSeasonDraftFromRows({
      rows: [
        playerRow('Caitlind Lusty', 'female', 8, { playerRequests: 'Matt Lynar' }),
        playerRow('Matthew Lynar', 'male', 7, { playerRequests: 'Caitland lusty' }),
        playerRow('Cara Ng', 'female', 6),
        playerRow('Dan Wu', 'male', 5),
      ],
      teamCount: 2,
      seasonName: 'Test Season',
    });

    expect(result.hardGroups.map(group => group.playerNames.sort())).toContainEqual([
      'Caitlind Lusty',
      'Matthew Lynar',
    ]);
    expect(result.players.find(player => player.name === 'Caitlind Lusty')?.playerRequests).toEqual(['Matthew Lynar']);
    expect(result.players.find(player => player.name === 'Matthew Lynar')?.playerRequests).toEqual(['Caitlind Lusty']);
  });

  it('reports unmatched and auto-matched request names in the mapping audit', () => {
    const audit = buildRequestMappingAuditFromRows([
      playerRow('Alice Smith', 'female', 8, { niceToPlay: 'Bob Jones and Missing Player' }),
      playerRow('Bob Jones', 'male', 7, { niceToPlay: 'Alice Smith' }),
      playerRow('Cara Ng', 'female', 6),
      playerRow('Dan Wu', 'male', 5),
    ]);

    expect(audit.niceToPlayMappings).toContainEqual({
      playerName: 'Alice Smith',
      requestedName: 'Bob Jones',
      sourceColumn: 'Mutual nice-to-play',
    });
    expect(audit.reviewNeededRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({
        playerName: 'Alice Smith',
        inputName: 'Missing Player',
        status: 'unmatched',
      }),
    ]));
  });

  it('counts only mutual nice-to-play requests and ignores one-way nice requests', () => {
    const result = buildSeasonDraftFromRows({
      rows: [
        playerRow('Alice Smith', 'female', 8, { niceToPlay: 'Bob Jones' }),
        playerRow('Bob Jones', 'male', 7, { niceToPlay: 'Alice Smith' }),
        playerRow('Cara Ng', 'female', 6, { niceToPlay: 'Dan Wu' }),
        playerRow('Dan Wu', 'male', 5),
      ],
      teamCount: 2,
      seasonName: 'Test Season',
    });
    const audit = buildRequestMappingAuditFromRows([
      playerRow('Alice Smith', 'female', 8, { niceToPlay: 'Bob Jones' }),
      playerRow('Bob Jones', 'male', 7, { niceToPlay: 'Alice Smith' }),
      playerRow('Cara Ng', 'female', 6, { niceToPlay: 'Dan Wu' }),
      playerRow('Dan Wu', 'male', 5),
    ]);

    expect(result.metrics.niceToPlayHonored + result.metrics.niceToPlayBroken).toBe(1);
    expect(audit.niceToPlayMappings).toHaveLength(1);
    expect(audit.ignoredOneWayNiceRequests).toContainEqual({
      playerName: 'Cara Ng',
      requestedName: 'Dan Wu',
      sourceColumn: 'Would like to play with',
    });
  });

  it('stops when a hard group contains an avoid conflict', () => {
    expect(() => buildSeasonDraftFromRows({
      rows: [
        playerRow('Alice Smith', 'female', 8, { playerRequests: 'Bob Jones', avoidRequests: 'Bob Jones' }),
        playerRow('Bob Jones', 'male', 7, { playerRequests: 'Alice Smith' }),
        playerRow('Cara Ng', 'female', 6),
        playerRow('Dan Wu', 'male', 5),
      ],
      teamCount: 2,
      seasonName: 'Test Season',
    })).toThrow(/avoid conflict/i);
  });

  it('stops when a hard group is larger than the target team size', () => {
    expect(() => buildSeasonDraftFromRows({
      rows: [
        playerRow('Alice Smith', 'female', 8, { mustPlayGroup: 'Group 1' }),
        playerRow('Bob Jones', 'male', 7, { mustPlayGroup: 'Group 1' }),
        playerRow('Cara Ng', 'female', 6, { mustPlayGroup: 'Group 1' }),
        playerRow('Dan Wu', 'male', 5, { mustPlayGroup: 'Group 1' }),
        playerRow('Ella Ray', 'female', 4),
      ],
      teamCount: 2,
      seasonName: 'Test Season',
    })).toThrow(/larger than target team size/i);
  });

  it('reports hard-rule status and balance metrics', () => {
    const result = buildSeasonDraftFromRows({
      rows: [
        playerRow('Alice Smith', 'female', 8, { femaleLeader: 'yes', handler: 'yes' }),
        playerRow('Bob Jones', 'male', 7, { maleLeaderTier: 'A', handler: 'yes' }),
        playerRow('Cara Ng', 'female', 6, { femaleLeader: 'yes' }),
        playerRow('Dan Wu', 'male', 5, { maleLeaderTier: 'B' }),
      ],
      teamCount: 2,
      seasonName: 'Test Season',
    });

    const report = buildSeasonReport(result);

    expect(report).toContain('Hard rules: PASS');
    expect(report).toContain('Skill spread');
    expect(report).toContain('Handler spread');
  });

  it('can build seeded variations while preserving hard rules', () => {
    const rows = [
      playerRow('Alice Smith', 'female', 8, { playerRequests: 'Bob Jones', femaleLeader: 'yes', handler: 'yes' }),
      playerRow('Bob Jones', 'male', 7, { playerRequests: 'Alice Smith', maleLeaderTier: 'A' }),
      playerRow('Cara Ng', 'female', 6, { femaleLeader: 'yes' }),
      playerRow('Dan Wu', 'male', 5, { maleLeaderTier: 'B' }),
      playerRow('Ella Ray', 'female', 7),
      playerRow('Finn Cole', 'male', 6, { maleLeaderTier: 'B' }),
    ];

    const result = buildSeasonDraftFromRows({
      rows,
      teamCount: 3,
      seasonName: 'Test Season',
      draftSeed: 2,
      variationName: 'Variation 2',
    });

    expect(result.variationName).toBe('Variation 2');
    expect(result.hardRulesPassed).toBe(true);
    expect(result.hardGroups.map(group => group.playerNames.sort())).toContainEqual(['Alice Smith', 'Bob Jones']);
  });

  it('backtracks when greedy placement misses a valid exact-gender draft', () => {
    const result = buildSeasonDraftFromRows({
      rows: groupedRows([
        { male: 4, female: 1 },
        { male: 1, female: 2 },
        { male: 5, female: 2 },
        { male: 2, female: 1 },
        { male: 4, female: 0 },
        { male: 3, female: 0 },
        { male: 0, female: 3 },
        { male: 1, female: 0 },
        { male: 0, female: 1 },
      ]),
      teamCount: 4,
      seasonName: 'Synthetic Season',
    });

    expect(result.hardRulesPassed).toBe(true);
    expect(result.metrics.maleSpread).toBe(0);
    expect(result.metrics.femaleSpread).toBe(1);
  });
});

function playerRow(
  name: string,
  gender: 'male' | 'female',
  selfRank: number,
  options: {
    playerRequests?: string;
    niceToPlay?: string;
    avoidRequests?: string;
    mustPlayGroup?: string;
    femaleLeader?: string;
    maleLeaderTier?: string;
    handler?: string;
    labels?: string;
  } = {},
) {
  return {
    'Full Name': name,
    gender,
    age: 30,
    'Self Rank': selfRank,
    'Player Requests': options.playerRequests ?? '',
    'Would like to play with': options.niceToPlay ?? '',
    Do_Not_Play: options.avoidRequests ?? 'No',
    'Must Play Group': options.mustPlayGroup ?? '',
    'Female Leader': options.femaleLeader ?? '',
    'Male Leader Tier': options.maleLeaderTier ?? '',
    Handler: options.handler ?? '',
    Labels: options.labels ?? '',
  };
}

function groupedRows(units: Array<{ male: number; female: number }>) {
  let playerIndex = 1;
  return units.flatMap((unit, groupIndex) => [
    ...Array.from({ length: unit.male }, () => playerRow(`Male ${playerIndex++}`, 'male', 5, { mustPlayGroup: `Group ${groupIndex + 1}` })),
    ...Array.from({ length: unit.female }, () => playerRow(`Female ${playerIndex++}`, 'female', 5, { mustPlayGroup: `Group ${groupIndex + 1}` })),
  ]);
}
