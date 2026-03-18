import React, { useMemo, useState } from 'react';
import { Team, Player, LeagueConfig, TeamGenerationStats, PlayerGroup } from '@/types';
import {
  exportTeamsToCSV,
  exportTeamSummaryToCSV,
  downloadCSV,
  generateTeamReport,
  generateShareSummaryText
} from '@/utils/exportUtils';
import { hexToRgba } from '@/utils/teamBranding';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Eye,
  Copy,
  CheckCircle,
  Printer,
  Share2
} from 'lucide-react';
import { toast } from 'sonner';

interface ExportPanelProps {
  teams: Team[];
  unassignedPlayers: Player[];
  config: LeagueConfig;
  stats?: TeamGenerationStats;
  playerGroups: PlayerGroup[];
}

export function ExportPanel({ teams, unassignedPlayers, config, stats, playerGroups }: ExportPanelProps) {
  const [previewType, setPreviewType] = useState<'detailed' | 'summary' | 'report' | 'share'>('detailed');
  const [reportText, setReportText] = useState<string>('');

  const shareSummary = useMemo(
    () => generateShareSummaryText(teams, config, stats, unassignedPlayers),
    [teams, config, stats, unassignedPlayers]
  );

  const handleExportDetailed = () => {
    const csvContent = exportTeamsToCSV(teams, unassignedPlayers, playerGroups);
    const filename = `team_assignments_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
    toast.success('Detailed team export downloaded');
  };

  const handleExportSummary = () => {
    const csvContent = exportTeamSummaryToCSV(teams, playerGroups, config, stats);
    const filename = `team_summary_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
    toast.success('Team summary export downloaded');
  };

  const handleGenerateReport = () => {
    const report = generateTeamReport(teams, unassignedPlayers, playerGroups, config, stats);
    setReportText(report);
    setPreviewType('report');
  };

  const handleCopyReport = () => {
    if (reportText) {
      navigator.clipboard.writeText(reportText);
      toast.success('Report copied to clipboard');
    }
  };

  const handleCopyShareSummary = () => {
    navigator.clipboard.writeText(shareSummary);
    toast.success('Shareable summary copied to clipboard');
  };

  const handlePrintReport = () => {
    if (reportText) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Team Report</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                pre { white-space: pre-wrap; font-family: Arial, sans-serif; }
              </style>
            </head>
            <body>
              <pre>${reportText}</pre>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const getDetailedPreview = () => {
    const headers = ['Team', 'Color', 'Player', 'Gender', 'Skill', 'Exec Skill', 'Avg Skill', 'Size', 'M', 'F', 'Other'];
    const rows = [headers];

    teams.forEach(team => {
      team.players.forEach((player, index) => {
        rows.push([
          team.name,
          index === 0 ? (team.colorName || '') : '',
          player.name,
          player.gender,
          player.skillRating?.toString() || 'N/A',
          player.execSkillRating !== null ? player.execSkillRating.toString() : 'N/A',
          index === 0 ? team.averageSkill.toFixed(1) : '',
          index === 0 ? team.players.length.toString() : '',
          index === 0 ? team.genderBreakdown.M.toString() : '',
          index === 0 ? team.genderBreakdown.F.toString() : '',
          index === 0 ? team.genderBreakdown.Other.toString() : ''
        ]);
      });
    });

    unassignedPlayers.forEach(player => {
      rows.push([
        'Unassigned',
        '',
        player.name,
        player.gender,
        player.skillRating?.toString() || 'N/A',
        player.execSkillRating !== null ? player.execSkillRating.toString() : 'N/A',
        '',
        '',
        '',
        '',
        ''
      ]);
    });

    return rows;
  };

  const getSummaryPreview = () => {
    return teams.map(team => [
      team.name,
      team.colorName || '',
      team.players.length.toString(),
      team.averageSkill.toFixed(1),
      team.genderBreakdown.M.toString(),
      team.genderBreakdown.F.toString(),
      team.genderBreakdown.Other.toString(),
      team.players.map(p => p.name).join(', ')
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Export Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Detailed Export
            </CardTitle>
            <CardDescription>
              Complete player assignments with team statistics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleExportDetailed} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Export Detailed CSV
            </Button>
            <p className="text-sm text-gray-600">
              Includes all player details, team assignments, and statistics
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Summary Export
            </CardTitle>
            <CardDescription>
              Team overview with key statistics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleExportSummary} className="w-full" variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Summary CSV
            </Button>
            <p className="text-sm text-gray-600">
              Compact format with branded team names and player lists
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Text Report
            </CardTitle>
            <CardDescription>
              Human-readable team report
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleGenerateReport} className="w-full" variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            <p className="text-sm text-gray-600">
              Formatted text report for sharing or printing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Shareable Summary
            </CardTitle>
            <CardDescription>
              Copy a polished summary for chat, email, or announcements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleCopyShareSummary} className="w-full" variant="outline">
              <Copy className="h-4 w-4 mr-2" />
              Copy Share Summary
            </Button>
            <p className="text-sm text-gray-600">
              Includes branded team names, colors, and player lists
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Export Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Export Summary</CardTitle>
          <CardDescription>
            Overview of what will be included in your exports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{teams.length}</div>
              <div className="text-sm text-gray-600">Teams</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {teams.reduce((sum, team) => sum + team.players.length, 0)}
              </div>
              <div className="text-sm text-gray-600">Assigned Players</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{unassignedPlayers.length}</div>
              <div className="text-sm text-gray-600">Unassigned</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{config.maxTeamSize}</div>
              <div className="text-sm text-gray-600">Max Team Size</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Export Preview
            <Tabs value={previewType} onValueChange={(value) => setPreviewType(value as 'detailed' | 'summary' | 'report' | 'share')}>
              <TabsList>
                <TabsTrigger value="detailed">Detailed</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="share">Shareable</TabsTrigger>
                {reportText && <TabsTrigger value="report">Report</TabsTrigger>}
              </TabsList>
            </Tabs>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={previewType} onValueChange={(value) => setPreviewType(value as 'detailed' | 'summary' | 'report' | 'share')}>
            <TabsContent value="detailed" className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Skill</TableHead>
                      <TableHead>Avg Skill</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>M</TableHead>
                      <TableHead>F</TableHead>
                      <TableHead>Other</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getDetailedPreview().slice(0, 10).map((row, index) => (
                      <TableRow key={index}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex} className="text-sm">
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {getDetailedPreview().length > 10 && (
                  <div className="p-3 bg-gray-50 text-center text-sm text-gray-600">
                    And {getDetailedPreview().length - 10} more rows...
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="summary" className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Players</TableHead>
                      <TableHead>Avg Skill</TableHead>
                      <TableHead>M</TableHead>
                      <TableHead>F</TableHead>
                      <TableHead>Other</TableHead>
                      <TableHead>Player Names</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getSummaryPreview().map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{row[0]}</TableCell>
                        <TableCell>{row[1]}</TableCell>
                        <TableCell>{row[2]}</TableCell>
                        <TableCell>{row[3]}</TableCell>
                        <TableCell>{row[4]}</TableCell>
                        <TableCell>{row[5]}</TableCell>
                        <TableCell>{row[6]}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate">
                          {row[7]}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="share" className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button onClick={handleCopyShareSummary} variant="outline" size="sm">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Summary
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((team) => {
                  const teamColor = team.color || '#94A3B8';
                  return (
                    <Card key={team.id} className="overflow-hidden border-2" style={{ borderColor: hexToRgba(teamColor, 0.35) }}>
                      <CardHeader style={{ backgroundColor: hexToRgba(teamColor, 0.12) }}>
                        <CardTitle className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: teamColor }} />
                            {team.name}
                          </span>
                          {team.colorName && <Badge variant="secondary">{team.colorName}</Badge>}
                        </CardTitle>
                        <CardDescription>
                          {team.players.length} players • Avg skill {team.averageSkill.toFixed(1)} • {team.genderBreakdown.F}F / {team.genderBreakdown.M}M / {team.genderBreakdown.Other}O
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="text-sm text-slate-700 leading-6">
                          {team.players.map(player => player.name).join(', ')}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Textarea
                value={shareSummary}
                readOnly
                className="min-h-64 font-mono text-sm"
              />
            </TabsContent>

            {reportText && (
              <TabsContent value="report" className="space-y-4">
                <div className="flex gap-2 mb-4">
                  <Button onClick={handleCopyReport} variant="outline" size="sm">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button onClick={handlePrintReport} variant="outline" size="sm">
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                </div>
                <Textarea
                  value={reportText}
                  readOnly
                  className="min-h-96 font-mono text-sm"
                />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Performance</CardTitle>
            <CardDescription>
              Key metrics from the team generation process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-green-600">
                    {((stats.assignedPlayers / stats.totalPlayers) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="text-sm text-green-600">Assignment Rate</div>
              </div>

              <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="font-semibold text-blue-600">{stats.mutualRequestsHonored}</div>
                <div className="text-sm text-blue-600">Requests Honored</div>
              </div>

              <div className="text-center p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="font-semibold text-orange-600">{stats.avoidRequestsViolated}</div>
                <div className="text-sm text-orange-600">Violations</div>
              </div>

              <div className="text-center p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="font-semibold text-purple-600">{stats.generationTime}ms</div>
                <div className="text-sm text-purple-600">Process Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
