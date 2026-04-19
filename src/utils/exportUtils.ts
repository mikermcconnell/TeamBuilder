import { Team, Player, PlayerGroup, LeagueConfig, TeamGenerationStats, LeagueMemoryEntry } from '@/types';
import { getPlayerGroupLabel } from './playerGrouping';
import { generateShareableSummary } from './teamBranding';
import { buildIterationInsights } from './teamInsights';
import { sanitizeLegacyTeamName } from './groupLabels';

export function exportTeamsToCSV(teams: Team[], unassignedPlayers: Player[], playerGroups: PlayerGroup[] = []): string {
  const headers = ['Team', 'Team Color', 'Player Name', 'Gender', 'Skill Rating', 'Exec Skill Rating', 'Player Group', 'Average Team Skill', 'Team Size', 'Males', 'Females', 'Other'];
  const rows: string[][] = [headers];

  // Add team data
  teams.forEach(team => {
    team.players.forEach((player, index) => {
      const groupLabel = getPlayerGroupLabel(playerGroups, player.id) || '';
      const row = [
        sanitizeLegacyTeamName(team.name),
        index === 0 ? (team.colorName || '') : '',
        player.name,
        player.gender,
        player.skillRating.toString(),
        player.execSkillRating !== null ? player.execSkillRating.toString() : 'N/A',
        groupLabel,
        index === 0 ? team.averageSkill.toFixed(2) : '', // Only show average on first player
        index === 0 ? team.players.length.toString() : '',
        index === 0 ? team.genderBreakdown.M.toString() : '',
        index === 0 ? team.genderBreakdown.F.toString() : '',
        index === 0 ? team.genderBreakdown.Other.toString() : ''
      ];
      rows.push(row);
    });

    // Add empty row between teams
    if (team !== teams[teams.length - 1]) {
      rows.push(new Array(headers.length).fill(''));
    }
  });

  // Add unassigned players section
  if (unassignedPlayers.length > 0) {
    rows.push(new Array(headers.length).fill(''));
    rows.push(['UNASSIGNED PLAYERS', '', '', '', '', '', '', '', '', '', '']);

    unassignedPlayers.forEach(player => {
      const groupLabel = getPlayerGroupLabel(playerGroups, player.id) || '';
      rows.push([
        'UNASSIGNED',
        '',
        player.name,
        player.gender,
        player.skillRating.toString(),
        player.execSkillRating !== null ? player.execSkillRating.toString() : 'N/A',
        groupLabel,
        '',
        '',
        '',
        '',
        ''
      ]);
    });
  }

  return rows.map(row =>
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}

export function exportTeamSummaryToCSV(teams: Team[], playerGroups: PlayerGroup[] = [], config?: LeagueConfig, stats?: TeamGenerationStats): string {
  const headers = ['Team Name', 'Team Color', 'Total Players', 'Average Skill', 'Males', 'Females', 'Other', 'Player Groups', 'Skill Variance', 'Player Names'];
  const rows: string[][] = [headers];

  teams.forEach(team => {
    const playerNames = team.players.map(p => p.name).join('; ');

    // Calculate skill variance using exec skill ratings (or skill rating if exec is N/A)
    const skills = team.players.map(p => p.execSkillRating !== null ? p.execSkillRating : p.skillRating);
    const avgSkill = team.averageSkill;
    const variance = skills.reduce((sum, skill) => sum + Math.pow(skill - avgSkill, 2), 0) / skills.length;

    // Get player groups in this team
    const teamGroups = new Set();
    team.players.forEach(player => {
      const groupLabel = getPlayerGroupLabel(playerGroups, player.id);
      if (groupLabel) {
        teamGroups.add(groupLabel);
      }
    });
    const groupsStr = Array.from(teamGroups).join(', ') || 'None';

    const row = [
      sanitizeLegacyTeamName(team.name),
      team.colorName || '',
      team.players.length.toString(),
      team.averageSkill.toFixed(2),
      team.genderBreakdown.M.toString(),
      team.genderBreakdown.F.toString(),
      team.genderBreakdown.Other.toString(),
      groupsStr,
      variance.toFixed(2),
      playerNames
    ];
    rows.push(row);
  });

  // Add summary statistics if available
  if (stats && config) {
    rows.push(new Array(headers.length).fill(''));
    rows.push(['LEAGUE SUMMARY', '', '', '', '', '', '', '', '']);
    rows.push(['Total Players', stats.totalPlayers.toString(), '', '', '', '', '', '', '']);
    rows.push(['Assigned Players', stats.assignedPlayers.toString(), '', '', '', '', '', '', '']);
    rows.push(['Unassigned Players', stats.unassignedPlayers.toString(), '', '', '', '', '', '', '']);
    rows.push(['Mutual Requests Honored', stats.mutualRequestsHonored.toString(), '', '', '', '', '', '', '']);
    rows.push(['Mutual Requests Broken', stats.mutualRequestsBroken.toString(), '', '', '', '', '', '', '']);
    rows.push(['Must-Have Requests Honored', stats.mustHaveRequestsHonored?.toString() || '0', '', '', '', '', '', '', '']);
    rows.push(['Must-Have Requests Broken', stats.mustHaveRequestsBroken?.toString() || '0', '', '', '', '', '', '', '']);
    rows.push(['Nice-to-Have Requests Honored', stats.niceToHaveRequestsHonored?.toString() || '0', '', '', '', '', '', '', '']);
    rows.push(['Nice-to-Have Requests Broken', stats.niceToHaveRequestsBroken?.toString() || '0', '', '', '', '', '', '', '']);
    rows.push(['Avoid Violations', stats.avoidRequestsViolated.toString(), '', '', '', '', '', '', '']);
    rows.push(['Conflicts Detected', stats.conflictsDetected?.toString() || '0', '', '', '', '', '', '', '']);
    rows.push(['Generation Time (ms)', stats.generationTime.toString(), '', '', '', '', '', '', '']);
    rows.push(['Max Team Size', config.maxTeamSize.toString(), '', '', '', '', '', '', '']);
    rows.push(['Min Females', config.minFemales.toString(), '', '', '', '', '', '', '']);
    rows.push(['Min Males', config.minMales.toString(), '', '', '', '', '', '', '']);
  }

  return rows.map(row =>
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  ).join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export function exportConfigToJSON(configs: LeagueConfig[], filename: string): void {
  const jsonContent = JSON.stringify(configs, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export function generateTeamReport(teams: Team[], unassignedPlayers: Player[], playerGroups: PlayerGroup[] = [], config?: LeagueConfig, stats?: TeamGenerationStats): string {
  let report = 'TEAM BALANCING REPORT\n';
  report += '=====================\n\n';

  report += `Generated on: ${new Date().toLocaleString()}\n`;
  report += `Total Teams: ${teams.length}\n`;
  report += `Total Assigned Players: ${teams.reduce((sum, t) => sum + t.players.length, 0)}\n`;
  report += `Unassigned Players: ${unassignedPlayers.length}\n\n`;

  // Team details
  teams.forEach((team, index) => {
    const teamName = sanitizeLegacyTeamName(team.name);
    report += `${teamName.toUpperCase()}\n`;
    report += '-'.repeat(teamName.length) + '\n';
    if (team.colorName) {
      report += `Brand: ${team.colorName}\n`;
    }
    report += `Players: ${team.players.length}\n`;
    report += `Average Skill: ${team.averageSkill.toFixed(2)}\n`;
    report += `Gender Breakdown: ${team.genderBreakdown.M}M, ${team.genderBreakdown.F}F, ${team.genderBreakdown.Other} Other\n`;

    // Add group information
    const teamGroups = new Set();
    team.players.forEach(player => {
      const groupLabel = getPlayerGroupLabel(playerGroups, player.id);
      if (groupLabel) {
        teamGroups.add(groupLabel);
      }
    });
    if (teamGroups.size > 0) {
      report += `Player Groups: ${Array.from(teamGroups).join(', ')}\n`;
    }

    report += 'Players:\n';

    team.players.forEach(player => {
      const groupLabel = getPlayerGroupLabel(playerGroups, player.id);
      const groupStr = groupLabel ? ` [Group ${groupLabel}]` : '';
      report += `  - ${player.name} (${player.gender}, Skill: ${player.skillRating}, Exec: ${player.execSkillRating !== null ? player.execSkillRating : 'N/A'})${groupStr}\n`;
    });

    if (index < teams.length - 1) {
      report += '\n';
    }
  });

  // Unassigned players
  if (unassignedPlayers.length > 0) {
    report += '\n\nUNASSIGNED PLAYERS\n';
    report += '==================\n';
    unassignedPlayers.forEach(player => {
      const groupLabel = getPlayerGroupLabel(playerGroups, player.id);
      const groupStr = groupLabel ? ` [Group ${groupLabel}]` : '';
      report += `- ${player.name} (${player.gender}, Skill: ${player.skillRating}, Exec: ${player.execSkillRating !== null ? player.execSkillRating : 'N/A'})${groupStr}\n`;
      if (player.teammateRequests.length > 0) {
        report += `  Teammate Requests: ${player.teammateRequests.join(', ')}\n`;
      }
      if (player.avoidRequests.length > 0) {
        report += `  Avoid Requests: ${player.avoidRequests.join(', ')}\n`;
      }
    });
  }

  // Add generation statistics
  if (stats) {
    report += '\n\nGENERATION STATISTICS\n';
    report += '====================\n';
    report += `Total Players: ${stats.totalPlayers}\n`;
    report += `Assigned Players: ${stats.assignedPlayers}\n`;
    report += `Unassigned Players: ${stats.unassignedPlayers}\n`;
    report += `Mutual Requests Honored: ${stats.mutualRequestsHonored}\n`;
    report += `Mutual Requests Broken: ${stats.mutualRequestsBroken}\n`;
    report += '\n';
    report += `★ Must-Have Requests Honored: ${stats.mustHaveRequestsHonored || 0}\n`;
    report += `★ Must-Have Requests Broken: ${stats.mustHaveRequestsBroken || 0}\n`;
    report += `♡ Nice-to-Have Requests Honored: ${stats.niceToHaveRequestsHonored || 0}\n`;
    report += `♡ Nice-to-Have Requests Broken: ${stats.niceToHaveRequestsBroken || 0}\n`;
    report += '\n';
    report += `Avoid Request Violations: ${stats.avoidRequestsViolated}\n`;
    report += `Conflicts Detected: ${stats.conflictsDetected || 0}\n`;
    report += `Generation Time: ${stats.generationTime}ms\n`;
  }

  // Add player groups summary
  if (playerGroups.length > 0) {
    report += '\n\nPLAYER GROUPS\n';
    report += '=============\n';
    playerGroups.forEach(group => {
      report += `Group ${group.label}: ${group.players.map(p => p.name).join(', ')}\n`;
    });
  }

  return report;
}

export function generateShareSummaryText(teams: Team[], config: LeagueConfig, stats?: TeamGenerationStats, unassignedPlayers: Player[] = []): string {
  return generateShareableSummary(teams, config, stats, unassignedPlayers.length);
}

export function generateLeagueOrganizerSummary(
  teams: Team[],
  unassignedPlayers: Player[],
  config: LeagueConfig,
  stats?: TeamGenerationStats,
  leagueMemory: LeagueMemoryEntry[] = [],
  title = 'League Organizer Summary'
): string {
  const insights = buildIterationInsights({
    id: 'organizer-summary',
    name: title,
    teams,
    unassignedPlayers,
    stats,
  }, config, leagueMemory);

  const lines = [
    title,
    '='.repeat(title.length),
    '',
    `Generated: ${new Date().toLocaleString()}`,
    `Draft score: ${insights.score.total}/100`,
    `Balance: ${insights.score.balance}/25`,
    `Chemistry: ${insights.score.chemistry}/25`,
    `Compliance: ${insights.score.compliance}/25`,
    `League memory: ${insights.score.continuity}/25`,
    '',
    'Headline',
    '--------',
    insights.summary,
    '',
    'What is working',
    '---------------',
    ...(insights.strengths.length > 0 ? insights.strengths.map(item => `- ${item}`) : ['- No standout strengths were detected yet.']),
    '',
    'What still needs attention',
    '--------------------------',
    ...(insights.risks.length > 0 ? insights.risks.map(item => `- ${item}`) : ['- No material risks were detected.']),
    '',
    'Key metrics',
    '-----------',
    `- Skill spread between teams: ${insights.skillSpread.toFixed(2)}`,
    `- Size spread between teams: ${insights.sizeSpread}`,
    `- Handler spread between teams: ${insights.handlerSpread}`,
    `- Elite stack flags: ${insights.eliteStackedTeams}`,
    `- Low-band stack flags: ${insights.lowBandStackedTeams}`,
    `- Avoid conflicts: ${insights.avoidViolations}`,
    `- Unassigned players: ${insights.unassignedPlayers}`,
    `- Repeat teammate pairings from league memory: ${insights.repeatedPairings}`,
    `- Request honour rate: ${insights.requestHonourRate === null ? 'No requests logged' : `${insights.requestHonourRate.toFixed(0)}%`}`,
    '',
    'Teams',
    '-----',
    ...teams.flatMap(team => {
      const teamLines = [
        `${sanitizeLegacyTeamName(team.name)} — ${team.players.length} players, avg skill ${team.averageSkill.toFixed(1)}, ${team.genderBreakdown.F}F/${team.genderBreakdown.M}M/${team.genderBreakdown.Other}O`,
        `  Players: ${team.players.map(player => player.name).join(', ')}`,
      ];

      if ((team.handlerCount ?? 0) > 0) {
        teamLines.push(`  Handlers: ${team.handlerCount}`);
      }

      return teamLines;
    }),
  ];

  if (unassignedPlayers.length > 0) {
    lines.push('', 'Unassigned', '----------', `- ${unassignedPlayers.map(player => player.name).join(', ')}`);
  }

  return lines.join('\n');
}
