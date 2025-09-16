import React, { useState } from 'react';
import { Player, Team, LeagueConfig, PlayerGroup, getEffectiveSkillRating } from '@/types';
import { Button } from '@/components/ui/button';
import { SavedTeamsManager } from '@/components/SavedTeamsManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Users,
  AlertTriangle,
  CheckCircle,
  Move,
  UserPlus,
  ArrowUp,
  ArrowDown,
  Link,
  ArrowLeft,
  Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import { getPlayerGroup, getPlayerGroupColor, getPlayerGroupLabel } from '@/utils/playerGrouping';

interface FullScreenTeamBuilderProps {
  teams: Team[];
  unassignedPlayers: Player[];
  config: LeagueConfig;
  onPlayerMove: (playerId: string, targetTeamId: string | null) => void;
  onTeamNameChange: (teamId: string, newName: string) => void;
  players: Player[];
  playerGroups: PlayerGroup[];
  onExitFullScreen: () => void;
  onLoadTeams?: (teams: Team[], unassignedPlayers: Player[], config: LeagueConfig) => void;
}

export function FullScreenTeamBuilder({
  teams,
  unassignedPlayers,
  config,
  onPlayerMove,
  onTeamNameChange,
  players,
  playerGroups,
  onExitFullScreen,
  onLoadTeams
}: FullScreenTeamBuilderProps) {
  const [draggedPlayer, setDraggedPlayer] = useState<Player | null>(null);
  const [draggedGroup, setDraggedGroup] = useState<PlayerGroup | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [tempTeamName, setTempTeamName] = useState<string>('');

  // Team name editing functions
  const startEditingTeamName = (teamId: string, currentName: string) => {
    setEditingTeamId(teamId);
    setTempTeamName(currentName);
  };

  const saveTeamName = (teamId: string) => {
    if (tempTeamName.trim()) {
      onTeamNameChange(teamId, tempTeamName.trim());
      setEditingTeamId(null);
      setTempTeamName('');
    }
  };

  const cancelEditingTeamName = () => {
    setEditingTeamId(null);
    setTempTeamName('');
  };

  // Helper function to check if player is in a group
  const isPlayerInGroup = (player: Player): boolean => {
    const group = getPlayerGroup(playerGroups, player.id);
    return group !== null;
  };

  // Helper function to check if a team exceeds max size
  const isTeamOverCapacity = (team: Team): boolean => {
    return team.players.length > config.maxTeamSize;
  };

  // Helper function to check if a team is under minimum size
  const isTeamUnderCapacity = (team: Team): boolean => {
    return team.players.length < config.maxTeamSize - 2;
  };

  // Helper function to check avoid conflicts
  const hasAvoidConflict = (player: Player, targetTeam: Team): { hasConflict: boolean; conflictPlayer?: string } => {
    // Check if player avoids anyone on target team
    for (const avoidName of player.avoidRequests) {
      const conflictPlayer = targetTeam.players.find(p =>
        p.name.toLowerCase() === avoidName.toLowerCase()
      );
      if (conflictPlayer) {
        return { hasConflict: true, conflictPlayer: conflictPlayer.name };
      }
    }

    // Check if anyone on target team avoids this player
    for (const teamPlayer of targetTeam.players) {
      if (teamPlayer.avoidRequests.some(avoidName =>
        avoidName.toLowerCase() === player.name.toLowerCase()
      )) {
        return { hasConflict: true, conflictPlayer: teamPlayer.name };
      }
    }

    return { hasConflict: false };
  };

  const handleDragStart = (player: Player) => {
    setDraggedPlayer(player);
    setDraggedGroup(null);
  };

  const handleGroupDragStart = (group: PlayerGroup) => {
    setDraggedGroup(group);
    setDraggedPlayer(null);
  };

  const handleDragEnd = () => {
    setDraggedPlayer(null);
    setDraggedGroup(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetTeamId: string | null) => {
    e.preventDefault();

    if (draggedPlayer) {
      // Check if the player is part of a group
      const playerGroup = getPlayerGroup(playerGroups, draggedPlayer.id);

      if (playerGroup) {
        // Player is in a group - move the entire group
        const groupPlayers = playerGroup.players.filter(p =>
          unassignedPlayers.some(up => up.id === p.id) ||
          teams.some(t => t.players.some(tp => tp.id === p.id))
        );

        // Check avoid conflicts for all players in the group
        if (targetTeamId) {
          const targetTeam = teams.find(t => t.id === targetTeamId);
          if (targetTeam) {
            for (const player of groupPlayers) {
              const avoidCheck = hasAvoidConflict(player, targetTeam);
              if (avoidCheck.hasConflict) {
                toast.error(`Cannot move group: ${player.name} has avoid conflict with ${avoidCheck.conflictPlayer}`);
                return;
              }
            }
          }
        }

        // Move all players in the group
        groupPlayers.forEach(player => {
          onPlayerMove(player.id, targetTeamId);
        });

        // Show appropriate message
        const groupLabel = getPlayerGroupLabel(playerGroups, draggedPlayer.id);
        if (targetTeamId) {
          const targetTeam = teams.find(t => t.id === targetTeamId);
          const willExceedCapacity = targetTeam && (targetTeam.players.length + groupPlayers.length) > config.maxTeamSize;

          if (willExceedCapacity) {
            toast.warning(`Moved Group ${groupLabel} (${groupPlayers.length} players) - Team now exceeds size limit`);
          } else {
            toast.success(`Moved Group ${groupLabel} (${groupPlayers.length} players) to team`);
          }
        } else {
          toast.success(`Moved Group ${groupLabel} (${groupPlayers.length} players) to unassigned`);
        }
      } else {
        // Player is not in a group - move individual player
        // Check avoid conflicts
        if (targetTeamId) {
          const targetTeam = teams.find(t => t.id === targetTeamId);
          if (targetTeam) {
            const avoidCheck = hasAvoidConflict(draggedPlayer, targetTeam);
            if (avoidCheck.hasConflict) {
              toast.error(`Cannot move ${draggedPlayer.name}: avoid conflict with ${avoidCheck.conflictPlayer}`);
              return;
            }
          }
        }

        // Move player
        onPlayerMove(draggedPlayer.id, targetTeamId);

        // Show appropriate message
        if (targetTeamId) {
          const targetTeam = teams.find(t => t.id === targetTeamId);
          if (targetTeam && isTeamOverCapacity({...targetTeam, players: [...targetTeam.players, draggedPlayer]})) {
            toast.warning(`Moved ${draggedPlayer.name} - Team now exceeds size limit`);
          } else {
            toast.success(`Moved ${draggedPlayer.name} to team`);
          }
        } else {
          toast.success(`Moved ${draggedPlayer.name} to unassigned`);
        }
      }
    } else if (draggedGroup) {
      // Handle group movement
      const groupPlayers = draggedGroup.players.filter(p =>
        unassignedPlayers.some(up => up.id === p.id) ||
        teams.some(t => t.players.some(tp => tp.id === p.id))
      );

      // Check avoid conflicts for all players in the group
      if (targetTeamId) {
        const targetTeam = teams.find(t => t.id === targetTeamId);
        if (targetTeam) {
          for (const player of groupPlayers) {
            const avoidCheck = hasAvoidConflict(player, targetTeam);
            if (avoidCheck.hasConflict) {
              toast.error(`Cannot move group: ${player.name} has avoid conflict with ${avoidCheck.conflictPlayer}`);
              return;
            }
          }
        }
      }

      // Move all players in the group
      groupPlayers.forEach(player => {
        onPlayerMove(player.id, targetTeamId);
      });

      // Show appropriate message
      const groupLabel = getPlayerGroupLabel(playerGroups, groupPlayers[0]?.id);
      if (targetTeamId) {
        const targetTeam = teams.find(t => t.id === targetTeamId);
        const willExceedCapacity = targetTeam && (targetTeam.players.length + groupPlayers.length) > config.maxTeamSize;

        if (willExceedCapacity) {
          toast.warning(`Moved Group ${groupLabel} (${groupPlayers.length} players) - Team now exceeds size limit`);
        } else {
          toast.success(`Moved Group ${groupLabel} (${groupPlayers.length} players) to team`);
        }
      } else {
        toast.success(`Moved Group ${groupLabel} (${groupPlayers.length} players) to unassigned`);
      }
    }
  };

  const getTeamConstraintViolations = (team: Team): { violations: string[]; sizeIssues: string[] } => {
    const violations: string[] = [];
    const sizeIssues: string[] = [];

    // Check team size issues
    if (team.players.length > config.maxTeamSize) {
      sizeIssues.push(`${team.players.length - config.maxTeamSize} over capacity`);
    } else if (team.players.length < config.maxTeamSize - 2) {
      sizeIssues.push(`${config.maxTeamSize - team.players.length} spots available`);
    }

    // Check avoid request violations (gender requirements now displayed separately)
    for (const player of team.players) {
      for (const avoidName of player.avoidRequests) {
        if (team.players.some(p => p.name.toLowerCase() === avoidName.toLowerCase() && p.id !== player.id)) {
          violations.push(`${player.name} wants to avoid ${avoidName}`);
        }
      }
    }

    return { violations, sizeIssues };
  };

  const getMoveOptions = (player: Player): Array<{ value: string | null; label: string; disabled: boolean }> => {
    const options = [
      {
        value: null,
        label: 'Move to Unassigned',
        disabled: false
      }
    ];

    teams.forEach(team => {
      const isCurrentTeam = player.teamId === team.id;
      const avoidCheck = hasAvoidConflict(player, team);

      let label = `Move to ${team.name}`;
      if (team.players.length >= config.maxTeamSize) {
        label += ' (will exceed limit)';
      }

      options.push({
        value: team.id,
        label,
        disabled: avoidCheck.hasConflict || isCurrentTeam
      });
    });

    return options;
  };

  // Helper functions for manual mode
  const getNonGroupedPlayers = (): Player[] => {
    return unassignedPlayers.filter(player => !isPlayerInGroup(player));
  };

  const getSortedPlayersByGender = (gender: 'M' | 'F'): Player[] => {
    return getNonGroupedPlayers()
      .filter(player => player.gender === gender)
      .sort((a, b) => b.skillRating - a.skillRating);
  };

  const femaleNonGroupedPlayers = getSortedPlayersByGender('F');
  const maleNonGroupedPlayers = getSortedPlayersByGender('M');
  const unassignedGroupedPlayers = unassignedPlayers.filter(player => isPlayerInGroup(player));

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col">
      {/* Header with back button */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={onExitFullScreen}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Normal View
            </Button>
            <div className="flex items-center gap-2">
              <Maximize2 className="h-5 w-5 text-blue-600" />
              <h1 className="text-xl font-semibold">Full Screen Team Builder</h1>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Drag players between panels to build your teams
          </div>
        </div>
        {onLoadTeams && (
          <div className="border-t pt-3">
            <SavedTeamsManager
              teams={teams}
              unassignedPlayers={unassignedPlayers}
              config={config}
              onLoadTeams={onLoadTeams}
            />
          </div>
        )}
      </div>

      {/* Main content - scrollable */}
      <div className="flex-1 overflow-auto flex flex-col">
        <div className="flex-1 p-6 pb-0">
          <div className="grid grid-cols-12 gap-6 h-full">
            {/* Left Panel - Female Players Only */}
            <div className="col-span-2 sticky top-0 h-[calc(100vh-160px)]">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3 flex-shrink-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-pink-600" />
                    Females ({femaleNonGroupedPlayers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex-1 overflow-hidden">
                  <div
                    className="border-2 border-dashed border-pink-200 rounded-lg p-3 h-full space-y-2 overflow-y-auto"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, null)}
                  >
                    {femaleNonGroupedPlayers.map((player) => (
                      <FullScreenPlayerCard
                        key={player.id}
                        player={player}
                        moveOptions={getMoveOptions(player)}
                        onMove={onPlayerMove}
                        onDragStart={() => handleDragStart(player)}
                        onDragEnd={handleDragEnd}
                        playerGroups={playerGroups}
                      />
                    ))}
                    {femaleNonGroupedPlayers.length === 0 && (
                      <div className="text-center text-gray-500 text-sm mt-20">
                        No unassigned female players
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Center - Teams Grid */}
            <div className="col-span-8">
            <div className="grid grid-cols-5 gap-3">
              {teams
                .slice()
                .sort((a, b) => {
                  const aSkill = isNaN(a.averageSkill) ? 0 : a.averageSkill;
                  const bSkill = isNaN(b.averageSkill) ? 0 : b.averageSkill;
                  return aSkill - bSkill;
                })
                .map((team) => {
                const constraintCheck = getTeamConstraintViolations(team);
                const violations = constraintCheck.violations;
                const sizeIssues = constraintCheck.sizeIssues;
                // Calculate reasonable max gender limits based on team size and mins
                const maxFemales = config.maxTeamSize - config.minMales;
                const maxMales = config.maxTeamSize - config.minFemales;

                const hasGenderIssues =
                  team.genderBreakdown.F < config.minFemales ||
                  team.genderBreakdown.M < config.minMales ||
                  team.genderBreakdown.F > maxFemales ||
                  team.genderBreakdown.M > maxMales;
                const isValid = violations.length === 0 && !hasGenderIssues;
                const isOverCapacity = isTeamOverCapacity(team);
                const isUnderCapacity = isTeamUnderCapacity(team);

                let borderClass = 'border-green-200';
                if (!isValid) borderClass = 'border-orange-200';
                if (isOverCapacity) borderClass = 'border-red-300';

                return (
                  <Card key={team.id} className={`${borderClass} flex flex-col`}>
                    <CardHeader className="pb-3 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {isValid && !isOverCapacity && !isUnderCapacity ? (
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : isOverCapacity ? (
                            <ArrowUp className="h-4 w-4 text-red-600 flex-shrink-0" />
                          ) : isUnderCapacity ? (
                            <ArrowDown className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0" />
                          )}
                          {editingTeamId === team.id ? (
                            <Input
                              value={tempTeamName}
                              onChange={(e) => setTempTeamName(e.target.value)}
                              onBlur={() => saveTeamName(team.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveTeamName(team.id);
                                } else if (e.key === 'Escape') {
                                  cancelEditingTeamName();
                                }
                              }}
                              className="h-6 text-sm font-medium min-w-0"
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded text-sm font-medium truncate min-w-0"
                              onClick={() => startEditingTeamName(team.id, team.name)}
                              title="Click to edit team name"
                            >
                              {team.name}
                            </span>
                          )}
                        </div>
                        <Badge
                          variant={isOverCapacity ? 'destructive' : isUnderCapacity ? 'secondary' : 'default'}
                          className={`text-xs flex-shrink-0 ${isOverCapacity ? 'bg-red-600' : isUnderCapacity ? 'bg-blue-100 text-blue-800' : ''}`}
                        >
                          {team.players.length}/{config.maxTeamSize}
                        </Badge>
                      </div>

                      <div className="text-xs text-gray-600">
                        <span className="font-semibold text-sm">Avg: {team.players.length > 0 && !isNaN(team.averageSkill) ? team.averageSkill.toFixed(1) : '0.0'}</span>
                      </div>

                      {/* Gender requirements display */}
                      <div className="text-xs mt-1 space-y-0.5">
                        {/* Female requirement */}
                        <div className="flex items-center gap-1">
                          {team.genderBreakdown.F < config.minFemales ? (
                            <span className="text-red-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              F: {team.genderBreakdown.F}/{config.minFemales} (Need {config.minFemales - team.genderBreakdown.F})
                            </span>
                          ) : team.genderBreakdown.F > maxFemales ? (
                            <span className="text-orange-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              F: {team.genderBreakdown.F} (Max {maxFemales})
                            </span>
                          ) : (
                            <span className="text-gray-600">
                              F: {team.genderBreakdown.F}/{config.minFemales}+
                            </span>
                          )}
                        </div>

                        {/* Male requirement */}
                        <div className="flex items-center gap-1">
                          {team.genderBreakdown.M < config.minMales ? (
                            <span className="text-red-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              M: {team.genderBreakdown.M}/{config.minMales} (Need {config.minMales - team.genderBreakdown.M})
                            </span>
                          ) : team.genderBreakdown.M > maxMales ? (
                            <span className="text-orange-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              M: {team.genderBreakdown.M} (Max {maxMales})
                            </span>
                          ) : (
                            <span className="text-gray-600">
                              M: {team.genderBreakdown.M}/{config.minMales}+
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Constraint violations */}
                      {(sizeIssues.length > 0 || violations.length > 0) && (
                        <div className="text-xs">
                          {sizeIssues.length > 0 && (
                            <div className={`text-xs ${isOverCapacity ? 'text-red-600' : 'text-blue-600'}`}>
                              {sizeIssues.join(', ')}
                            </div>
                          )}
                          {violations.length > 0 && (
                            <div className="text-xs text-orange-600">
                              {violations.slice(0, 1).join(', ')}{violations.length > 1 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="pt-0">
                      <div
                        className="border-2 border-dashed border-gray-300 rounded-lg p-2 min-h-[200px] max-h-[250px] space-y-1 overflow-y-auto"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, team.id)}
                      >
                        {team.players.length === 0 ? (
                          <div className="text-center text-gray-500 text-xs flex items-center justify-center h-full">
                            <div>
                              <UserPlus className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                              Drop players here
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {team.players.map((player) => (
                              <FullScreenPlayerCard
                                key={player.id}
                                player={player}
                                moveOptions={getMoveOptions(player)}
                                onMove={onPlayerMove}
                                onDragStart={() => handleDragStart(player)}
                                onDragEnd={handleDragEnd}
                                playerGroups={playerGroups}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

            {/* Right Panel - Male Players */}
            <div className="col-span-2 sticky top-0 h-[calc(100vh-160px)]">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-3 flex-shrink-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                    Males ({maleNonGroupedPlayers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex-1 overflow-hidden">
                  <div
                    className="border-2 border-dashed border-blue-200 rounded-lg p-3 h-full space-y-2 overflow-y-auto"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, null)}
                  >
                    {maleNonGroupedPlayers.map((player) => (
                      <FullScreenPlayerCard
                        key={player.id}
                        player={player}
                        moveOptions={getMoveOptions(player)}
                        onMove={onPlayerMove}
                        onDragStart={() => handleDragStart(player)}
                        onDragEnd={handleDragEnd}
                        playerGroups={playerGroups}
                      />
                    ))}
                    {maleNonGroupedPlayers.length === 0 && (
                      <div className="text-center text-gray-500 text-sm mt-20">
                        No unassigned male players
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Bottom Panel - Unassigned Groups */}
        {unassignedGroupedPlayers.length > 0 && (
          <div className="border-t border-gray-200 bg-white p-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Link className="h-5 w-5 text-purple-600" />
                  Groups ({playerGroups.filter(g =>
                    g.playerIds.some(id => unassignedGroupedPlayers.some(p => p.id === id))
                  ).length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div
                  className="border-2 border-dashed border-purple-200 rounded-lg p-4 min-h-[160px] max-h-[280px] overflow-y-auto"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, null)}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {playerGroups
                      .filter(group => group.playerIds.some(id => unassignedGroupedPlayers.some(p => p.id === id)))
                      .map((group) => (
                        <FullScreenGroupCard
                          key={group.id}
                          group={group}
                          players={group.players.filter(p => unassignedGroupedPlayers.some(up => up.id === p.id))}
                          moveOptions={getMoveOptions(group.players[0])} // Use first player for move options
                          onMove={onPlayerMove}
                          onDragStart={() => handleGroupDragStart(group)} // Drag the entire group
                          onDragEnd={handleDragEnd}
                          playerGroups={playerGroups}
                        />
                      ))}
                  </div>
                  {playerGroups.filter(g => g.playerIds.some(id => unassignedGroupedPlayers.some(p => p.id === id))).length === 0 && (
                    <div className="text-center text-gray-500 text-sm py-12">
                      No unassigned player groups
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

interface FullScreenGroupCardProps {
  group: PlayerGroup;
  players: Player[];
  moveOptions: Array<{ value: string | null; label: string; disabled: boolean }>;
  onMove: (playerId: string, targetTeamId: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  playerGroups: PlayerGroup[];
}

interface FullScreenPlayerCardProps {
  player: Player;
  moveOptions: Array<{ value: string | null; label: string; disabled: boolean }>;
  onMove: (playerId: string, targetTeamId: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  playerGroups: PlayerGroup[];
}

function FullScreenGroupCard({ group, players, moveOptions, onMove, onDragStart, onDragEnd, playerGroups }: FullScreenGroupCardProps) {
  const groupLabel = getPlayerGroupLabel(playerGroups, players[0]?.id);
  const groupColor = getPlayerGroupColor(playerGroups, players[0]?.id);

  const getSkillLevelColor = (skill: number): string => {
    if (skill >= 8) return 'text-white bg-green-800';
    if (skill >= 6) return 'text-white bg-green-600';
    if (skill >= 4) return 'text-black bg-green-200';
    return 'text-black bg-gray-100';
  };

  // Calculate average skill rating for the group
  const calculateAverageSkill = (): number => {
    if (players.length === 0) return 0;
    const totalSkill = players.reduce((sum, player) => sum + getEffectiveSkillRating(player), 0);
    return Math.round((totalSkill / players.length) * 10) / 10; // Round to 1 decimal place
  };

  const averageSkill = calculateAverageSkill();

  return (
    <div
      className="bg-white border-2 rounded-lg cursor-move hover:shadow-md transition-shadow relative p-2"
      style={{
        borderColor: groupColor,
        backgroundColor: `${groupColor}08`
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      {/* Group label in top corner */}
      <div
        className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-xs"
        style={{ backgroundColor: groupColor }}
      >
        {groupLabel}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="font-bold text-xs" style={{ color: groupColor }}>
            Group {groupLabel} ({players.length})
          </div>
          <Badge className={`text-xs ${getSkillLevelColor(averageSkill)}`}>
            {averageSkill}
          </Badge>
        </div>

        {/* Condensed player list */}
        <div className="text-xs text-gray-600">
          {players.slice(0, 3).map((player, index) => (
            <div key={player.id} className="flex items-center justify-between py-0.5">
              <span className="truncate flex-1 pr-1" title={player.name}>
                {player.name}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs">{player.gender}</span>
                <span className="text-xs font-medium">{getEffectiveSkillRating(player)}</span>
              </div>
            </div>
          ))}
          {players.length > 3 && (
            <div className="text-xs text-gray-500 py-0.5">
              +{players.length - 3} more...
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 pt-0.5">
          <Move className="h-3 w-3 text-gray-400 flex-shrink-0" />
          <Select onValueChange={(value) => {
            // Move all players in the group
            players.forEach(player => {
              onMove(player.id, value === 'null' ? null : value);
            });
          }}>
            <SelectTrigger className="h-6 text-xs">
              <SelectValue placeholder="Move..." />
            </SelectTrigger>
            <SelectContent>
              {moveOptions.map((option, index) => (
                <SelectItem
                  key={index}
                  value={option.value || 'null'}
                  disabled={option.disabled}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function FullScreenPlayerCard({ player, moveOptions, onMove, onDragStart, onDragEnd, playerGroups }: FullScreenPlayerCardProps) {
  const getSkillLevelColor = (skill: number): string => {
    if (skill >= 8) return 'text-white bg-green-800';
    if (skill >= 6) return 'text-white bg-green-600';
    if (skill >= 4) return 'text-black bg-green-200';
    return 'text-black bg-gray-100';
  };

  const playerGroup = getPlayerGroup(playerGroups, player.id);
  const groupColor = getPlayerGroupColor(playerGroups, player.id);
  const groupLabel = getPlayerGroupLabel(playerGroups, player.id);
  const isInGroup = playerGroup !== null;

  return (
    <div
      className="bg-white border rounded-lg cursor-move hover:shadow-md transition-shadow relative p-1.5"
      style={isInGroup ? {
        borderColor: groupColor,
        borderWidth: '2px',
        backgroundColor: `${groupColor}08`
      } : {}}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      {/* Group label in top corner */}
      {isInGroup && groupLabel && (
        <div
          className="absolute -top-2 -left-2 w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-xs"
          style={{ backgroundColor: groupColor }}
        >
          {groupLabel}
        </div>
      )}

      <div className="flex items-center justify-between mb-0.5">
        <div className="font-medium flex items-center gap-1 text-xs break-words min-w-0 flex-1 pr-1">
          {player.name}
          {isInGroup && (
            <span title={`Group ${groupLabel} - ${playerGroup?.players.length} players`}>
              <Link className="h-3 w-3 flex-shrink-0" style={{ color: groupColor }} />
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Badge variant="outline" className="text-xs px-1 py-0">{player.gender}</Badge>
          <Badge className={`text-xs px-1 py-0 ${getSkillLevelColor(player.skillRating)}`}>
            {player.skillRating}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <Move className="h-2.5 w-2.5 text-gray-400 flex-shrink-0" />
        <Select onValueChange={(value) => {
          const playerGroup = getPlayerGroup(playerGroups, player.id);
          if (playerGroup) {
            // Move entire group
            playerGroup.players.forEach(groupPlayer => {
              onMove(groupPlayer.id, value === 'null' ? null : value);
            });
          } else {
            // Move individual player
            onMove(player.id, value === 'null' ? null : value);
          }
        }}>
          <SelectTrigger className="h-5 text-xs px-1">
            <SelectValue placeholder="Move to..." />
          </SelectTrigger>
          <SelectContent>
            {moveOptions.map((option, index) => (
              <SelectItem
                key={index}
                value={option.value || 'null'}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}