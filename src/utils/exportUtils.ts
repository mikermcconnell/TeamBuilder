import { Team, Player, PlayerGroup, LeagueConfig, TeamGenerationStats } from '@/types';
import { getPlayerGroup, getPlayerGroupLabel } from './playerGrouping';

export function exportTeamsToCSV(teams: Team[], unassignedPlayers: Player[], playerGroups: PlayerGroup[] = []): string {
  const headers = ['Team', 'Player Name', 'Gender', 'Skill Rating', 'Player Group', 'Average Team Skill', 'Team Size', 'Males', 'Females', 'Other'];
  const rows: string[][] = [headers];

  // Add team data
  teams.forEach(team => {
    team.players.forEach((player, index) => {
      const groupLabel = getPlayerGroupLabel(playerGroups, player.id) || '';
      const row = [
        team.name,
        player.name,
        player.gender,
        player.skillRating.toString(),
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
    rows.push(['UNASSIGNED PLAYERS', '', '', '', '', '', '', '', '', '']);
    
    unassignedPlayers.forEach(player => {
      const groupLabel = getPlayerGroupLabel(playerGroups, player.id) || '';
      rows.push([
        'UNASSIGNED',
        player.name,
        player.gender,
        player.skillRating.toString(),
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
  const headers = ['Team Name', 'Total Players', 'Average Skill', 'Males', 'Females', 'Other', 'Player Groups', 'Skill Variance', 'Player Names'];
  const rows: string[][] = [headers];

  teams.forEach(team => {
    const playerNames = team.players.map(p => p.name).join('; ');
    
    // Calculate skill variance
    const skills = team.players.map(p => p.skillRating);
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
      team.name,
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
    rows.push(['Avoid Violations', stats.avoidRequestsViolated.toString(), '', '', '', '', '', '', '']);
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

export function exportConfigToJSON(configs: any[], filename: string): void {
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
    report += `${team.name.toUpperCase()}\n`;
    report += '-'.repeat(team.name.length) + '\n';
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
      report += `  - ${player.name} (${player.gender}, Skill: ${player.skillRating})${groupStr}\n`;
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
      report += `- ${player.name} (${player.gender}, Skill: ${player.skillRating})${groupStr}\n`;
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
    report += `Avoid Request Violations: ${stats.avoidRequestsViolated}\n`;
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
