import React, { useState } from 'react';
import { Player, Team, LeagueConfig, PlayerGroup, getEffectiveSkillRating } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Move, 
  RotateCcw,
  Trophy,
  Target,
  UserMinus,
  UserPlus,
  ArrowUp,
  ArrowDown,
  Link
} from 'lucide-react';
import { toast } from 'sonner';
import { getPlayerGroup, getPlayerGroupColor, getPlayerGroupLabel, arePlayersInSameGroup, getGroupmates } from '@/utils/playerGrouping';
import { Input } from '@/components/ui/input';

interface TeamDisplayProps {
  teams: Team[];
  unassignedPlayers: Player[];
  config: LeagueConfig;
  onPlayerMove: (playerId: string, targetTeamId: string | null) => void;
  onTeamNameChange: (teamId: string, newName: string) => void;
  players: Player[];
  playerGroups: PlayerGroup[];
  manualMode?: boolean;
}

export function TeamDisplay({ teams, unassignedPlayers, config, onPlayerMove, onTeamNameChange, players, playerGroups, manualMode = false }: TeamDisplayProps) {
  const [draggedPlayer, setDraggedPlayer] = useState<Player | null>(null);
  const [draggedFromTeam, setDraggedFromTeam] = useState<string | null>(null);
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

  // Helper function to find group teammates for a player (all group members regardless of team)
  const findAllGroupMembers = (player: Player): Player[] => {
    return getGroupmates(playerGroups, player.id);
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
    return team.players.length < config.maxTeamSize - 2; // Consider under capacity if 3+ spots available
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

  const handleDragStart = (player: Player, fromTeamId?: string) => {
    setDraggedPlayer(player);
    setDraggedFromTeam(fromTeamId || null);
  };

  const handleDragEnd = () => {
    setDraggedPlayer(null);
    setDraggedFromTeam(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetTeamId: string | null) => {
    e.preventDefault();
    
    if (draggedPlayer) {
      // Check if player is in a group - if so, ALWAYS move entire group
      if (isPlayerInGroup(draggedPlayer)) {
        const allGroupMembers = findAllGroupMembers(draggedPlayer);
        const groupLabel = getPlayerGroupLabel(playerGroups, draggedPlayer.id);
        
        // Check avoid conflicts for dragged player and ALL group members
        if (targetTeamId) {
          const targetTeam = teams.find(t => t.id === targetTeamId);
          if (targetTeam) {
            // Check avoid conflicts for dragged player
            const draggedAvoidCheck = hasAvoidConflict(draggedPlayer, targetTeam);
            if (draggedAvoidCheck.hasConflict) {
              toast.error(`Cannot move Group ${groupLabel}: ${draggedPlayer.name} has avoid conflict with ${draggedAvoidCheck.conflictPlayer}`);
              return;
            }
            
            // Check avoid conflicts for all group members
            for (const teammate of allGroupMembers) {
              const teammateAvoidCheck = hasAvoidConflict(teammate, targetTeam);
              if (teammateAvoidCheck.hasConflict) {
                toast.error(`Cannot move Group ${groupLabel}: ${teammate.name} has avoid conflict with ${teammateAvoidCheck.conflictPlayer}`);
                return;
              }
            }
          }
        }
        
        // Move ALL group members together (mandatory)
        onPlayerMove(draggedPlayer.id, targetTeamId);
        for (const teammate of allGroupMembers) {
          onPlayerMove(teammate.id, targetTeamId);
        }

        const destination = targetTeamId ? 'team' : 'unassigned';
        toast.success(`Moved Group ${groupLabel} to ${destination}`);
        return;
      }

      // Player is NOT in a group - allow single player movement
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

      // Move single player
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
  };

  const canPlayerJoinTeam = (player: Player, team: Team, config: LeagueConfig, allowOversize: boolean = false): boolean => {
    // Check team size (only if not allowing oversize)
    if (!allowOversize && team.players.length >= config.maxTeamSize) {
      return false;
    }

    // Check avoid constraints (always enforced)
    const avoidCheck = hasAvoidConflict(player, team);
    return !avoidCheck.hasConflict;
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
    
    if (team.genderBreakdown.F < config.minFemales) {
      violations.push(`Needs ${config.minFemales - team.genderBreakdown.F} more females`);
    }
    
    if (team.genderBreakdown.M < config.minMales) {
      violations.push(`Needs ${config.minMales - team.genderBreakdown.M} more males`);
    }
    
    // Check avoid request violations
    for (const player of team.players) {
      for (const avoidName of player.avoidRequests) {
        if (team.players.some(p => p.name.toLowerCase() === avoidName.toLowerCase() && p.id !== player.id)) {
          violations.push(`${player.name} wants to avoid ${avoidName}`);
        }
      }
    }
    
    return { violations, sizeIssues };
  };

  const getSkillLevelColor = (skill: number): string => {
    if (skill >= 8) return 'text-white bg-green-800';
    if (skill >= 6) return 'text-white bg-green-600';
    if (skill >= 4) return 'text-black bg-green-200';
    return 'text-black bg-gray-100';
  };

  const getMoveOptions = (player: Player): Array<{ value: string | null; label: string; disabled: boolean }> => {
    const isInGroup = isPlayerInGroup(player);
    const groupLabel = getPlayerGroupLabel(playerGroups, player.id);

    const options = [
      {
        value: null,
        label: isInGroup ? `Move Group ${groupLabel} to Unassigned` : 'Move to Unassigned',
        disabled: false
      }
    ];

    teams.forEach(team => {
      const canJoin = canPlayerJoinTeam(player, team, config, true); // Allow oversize for dropdown too
      const isCurrentTeam = player.teamId === team.id;

      let label = `Move to ${team.name}`;
      if (isInGroup) {
        label = `Move Group ${groupLabel} to ${team.name}`;
      }
      if (team.players.length >= config.maxTeamSize) {
        label += ' (will exceed limit)';
      }

      options.push({
        value: team.id,
        label,
        disabled: !canJoin || isCurrentTeam
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
      .sort((a, b) => getEffectiveSkillRating(b) - getEffectiveSkillRating(a)); // Sort by effective skill rating descending
  };

  // Manual mode layout
  if (manualMode) {
    const femaleNonGroupedPlayers = getSortedPlayersByGender('F');
    const maleNonGroupedPlayers = getSortedPlayersByGender('M');
    const unassignedGroupedPlayers = unassignedPlayers.filter(player => isPlayerInGroup(player));

    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          {/* Left Panel - Female Players and Unassigned Groups */}
          <div className="w-80 flex-shrink-0 space-y-4">
            {/* Female Players Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-pink-600" />
                  Females ({femaleNonGroupedPlayers.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div
                  className="border-2 border-dashed border-pink-200 rounded-lg p-2 min-h-32 space-y-1.5 overflow-y-auto max-h-[300px]"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, null)}
                >
                  {femaleNonGroupedPlayers.map((player) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      moveOptions={getMoveOptions(player)}
                      onMove={onPlayerMove}
                      onDragStart={() => handleDragStart(player)}
                      onDragEnd={handleDragEnd}
                      playerGroups={playerGroups}
                      compact={true}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Unassigned Groups Card */}
            {unassignedGroupedPlayers.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Link className="h-4 w-4 text-purple-600" />
                    Unassigned Groups ({playerGroups.filter(g =>
                      g.playerIds.some(id => unassignedGroupedPlayers.some(p => p.id === id))
                    ).length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div
                    className="border-2 border-dashed border-purple-200 rounded-lg p-2 min-h-32 space-y-1.5 overflow-y-auto max-h-[250px]"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, null)}
                  >
                    {playerGroups
                      .filter(group => group.playerIds.some(id => unassignedGroupedPlayers.some(p => p.id === id)))
                      .map((group) => (
                        <GroupCard
                          key={group.id}
                          group={group}
                          players={group.players.filter(p => unassignedGroupedPlayers.some(up => up.id === p.id))}
                          moveOptions={getMoveOptions(group.players[0])} // Use first player for move options
                          onMove={onPlayerMove}
                          onDragStart={() => handleDragStart(group.players[0])} // Drag first player, which will move whole group
                          onDragEnd={handleDragEnd}
                          playerGroups={playerGroups}
                          compact={true}
                        />
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Center - Teams Grid */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
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
                const isValid = violations.length === 0;
                const isOverCapacity = isTeamOverCapacity(team);
                const isUnderCapacity = isTeamUnderCapacity(team);

                let borderClass = 'border-green-200';
                if (!isValid) borderClass = 'border-orange-200';
                if (isOverCapacity) borderClass = 'border-red-300';

                return (
                  <Card key={team.id} className={borderClass}>
                    <CardHeader className="pb-2 px-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-1 text-xs">
                          {isValid && !isOverCapacity && !isUnderCapacity ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : isOverCapacity ? (
                            <ArrowUp className="h-4 w-4 text-red-600" />
                          ) : isUnderCapacity ? (
                            <ArrowDown className="h-4 w-4 text-blue-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
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
                              className="h-5 w-16 text-xs"
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:bg-gray-100 px-1 rounded text-xs truncate"
                              onClick={() => startEditingTeamName(team.id, team.name)}
                              title="Click to edit team name"
                            >
                              {team.name}
                            </span>
                          )}
                        </CardTitle>
                        <Badge
                          variant={isOverCapacity ? 'destructive' : isUnderCapacity ? 'secondary' : 'default'}
                          className={`text-xs ${isOverCapacity ? 'bg-red-600' : isUnderCapacity ? 'bg-blue-100 text-blue-800' : ''}`}
                        >
                          {team.players.length}/{config.maxTeamSize}
                        </Badge>
                      </div>

                      <div className="text-xs text-gray-600">
                        Skill: {!isNaN(team.averageSkill) ? team.averageSkill.toFixed(1) : '0.0'} | {team.genderBreakdown.M}M / {team.genderBreakdown.F}F / {team.genderBreakdown.Other}O
                      </div>

                      {/* Gender Requirements - Always visible for clarity */}
                      <div className="mt-1 pt-1 border-t border-gray-200 space-y-0.5">
                        {/* Female requirement */}
                        <div className={`text-xs font-semibold ${team.genderBreakdown.F < config.minFemales ? 'text-red-600' : 'text-green-600'}`}>
                          F: {team.genderBreakdown.F}/{config.minFemales}
                          {team.genderBreakdown.F < config.minFemales ? (
                            <span className="ml-1 font-bold">
                              (Need {config.minFemales - team.genderBreakdown.F} more)
                            </span>
                          ) : (
                            <span className="ml-1">✓</span>
                          )}
                        </div>

                        {/* Male requirement */}
                        <div className={`text-xs font-semibold ${team.genderBreakdown.M < config.minMales ? 'text-red-600' : 'text-green-600'}`}>
                          M: {team.genderBreakdown.M}/{config.minMales}
                          {team.genderBreakdown.M < config.minMales ? (
                            <span className="ml-1 font-bold">
                              (Need {config.minMales - team.genderBreakdown.M} more)
                            </span>
                          ) : (
                            <span className="ml-1">✓</span>
                          )}
                        </div>

                        {/* Size status if there are issues */}
                        {sizeIssues.length > 0 && (
                          <div className={`text-xs font-medium ${isOverCapacity ? 'text-red-600' : 'text-blue-600'}`}>
                            {sizeIssues.join(', ')}
                          </div>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 px-3 pb-3">
                      <div
                        className="border-2 border-dashed border-gray-300 rounded-lg p-1 min-h-40 space-y-1"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, team.id)}
                      >
                        {team.players.length === 0 ? (
                          <div className="text-center text-gray-500 text-xs flex items-center justify-center h-36">
                            <div>
                              <UserPlus className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                              Drop players here
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {team.players.map((player) => (
                              <PlayerCard
                                key={player.id}
                                player={player}
                                moveOptions={getMoveOptions(player)}
                                onMove={onPlayerMove}
                                onDragStart={() => handleDragStart(player, team.id)}
                                onDragEnd={handleDragEnd}
                                playerGroups={playerGroups}
                                compact={true}
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
          <div className="w-80 flex-shrink-0">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-blue-600" />
                  Males ({maleNonGroupedPlayers.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div
                  className="border-2 border-dashed border-blue-200 rounded-lg p-2 min-h-32 space-y-2 overflow-y-auto max-h-[600px]"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, null)}
                >
                  {maleNonGroupedPlayers.map((player) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      moveOptions={getMoveOptions(player)}
                      onMove={onPlayerMove}
                      onDragStart={() => handleDragStart(player)}
                      onDragEnd={handleDragEnd}
                      playerGroups={playerGroups}
                      compact={true}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Grouped players in unassigned (if any) */}
        {unassignedPlayers.filter(player => isPlayerInGroup(player)).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserMinus className="h-5 w-5" />
                Unassigned Groups
              </CardTitle>
              <CardDescription>
                Player groups that couldn't be automatically assigned
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {unassignedPlayers
                  .filter(player => isPlayerInGroup(player))
                  .map((player) => (
                    <PlayerCard
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
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Normal mode layout (existing)
  return (
    <div className="space-y-6">
      {/* Unassigned Players */}
      {unassignedPlayers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5" />
              Unassigned Players ({unassignedPlayers.length})
            </CardTitle>
            <CardDescription>
              Players who couldn't be assigned due to constraints or to be moved manually onto a team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-24"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, null)}
            >
              {unassignedPlayers.length === 0 ? (
                <div className="text-center text-gray-500">
                  Drop players here to unassign them
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {/* Unassigned Male Players */}
                  {unassignedPlayers.filter(p => p.gender === 'M').length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-2">Males ({unassignedPlayers.filter(p => p.gender === 'M').length})</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {unassignedPlayers
                          .filter(player => player.gender === 'M')
                          .map((player) => (
                            <PlayerCard
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
                    </div>
                  )}

                  {/* Unassigned Female Players */}
                  {unassignedPlayers.filter(p => p.gender === 'F').length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-2">Females ({unassignedPlayers.filter(p => p.gender === 'F').length})</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {unassignedPlayers
                          .filter(player => player.gender === 'F')
                          .map((player) => (
                            <PlayerCard
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
                    </div>
                  )}

                  {/* Unassigned Other Gender Players */}
                  {unassignedPlayers.filter(p => p.gender === 'Other').length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-2">Other ({unassignedPlayers.filter(p => p.gender === 'Other').length})</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {unassignedPlayers
                          .filter(player => player.gender === 'Other')
                          .map((player) => (
                            <PlayerCard
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teams
          .slice()
          .sort((a, b) => a.averageSkill - b.averageSkill)
          .map((team) => {
          const constraintCheck = getTeamConstraintViolations(team);
          const violations = constraintCheck.violations;
          const sizeIssues = constraintCheck.sizeIssues;
          const isValid = violations.length === 0;
          const isOverCapacity = isTeamOverCapacity(team);
          const isUnderCapacity = isTeamUnderCapacity(team);

          // Determine border color based on team status
          let borderClass = 'border-green-200';
          if (!isValid) borderClass = 'border-orange-200';
          if (isOverCapacity) borderClass = 'border-red-300';

          return (
            <Card 
              key={team.id}
              className={borderClass}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {isValid && !isOverCapacity && !isUnderCapacity ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : isOverCapacity ? (
                      <ArrowUp className="h-5 w-5 text-red-600" />
                    ) : isUnderCapacity ? (
                      <ArrowDown className="h-5 w-5 text-blue-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
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
                         className="h-7 w-32 text-lg font-semibold"
                         autoFocus
                       />
                     ) : (
                       <span 
                         className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                         onClick={() => startEditingTeamName(team.id, team.name)}
                         title="Click to edit team name"
                       >
                         {team.name}
                       </span>
                     )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {/* Size badge with color coding */}
                    <Badge 
                      variant={isOverCapacity ? 'destructive' : isUnderCapacity ? 'secondary' : 'default'}
                      className={isOverCapacity ? 'bg-red-600' : isUnderCapacity ? 'bg-blue-100 text-blue-800' : ''}
                    >
                      {team.players.length}/{config.maxTeamSize}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Trophy className="h-4 w-4 text-yellow-600" />
                      <span>Avg Skill: {!isNaN(team.averageSkill) ? team.averageSkill.toFixed(1) : '0.0'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="h-4 w-4 text-blue-600" />
                      <span>
                        {team.genderBreakdown.M}M / {team.genderBreakdown.F}F / {team.genderBreakdown.Other}O
                      </span>
                    </div>
                  </div>
                  
                  {/* Size Issues Alert */}
                  {sizeIssues.length > 0 && (
                    <Alert variant={isOverCapacity ? "destructive" : "default"} className={isUnderCapacity ? "border-blue-200 bg-blue-50" : ""}>
                      {isOverCapacity ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : (
                        <ArrowDown className="h-4 w-4 text-blue-600" />
                      )}
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {sizeIssues.map((issue, index) => (
                            <li key={index} className="text-xs">{issue}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Constraint Violations Alert */}
                  {violations.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {violations.map((violation, index) => (
                            <li key={index} className="text-xs">{violation}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-32"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, team.id)}
                >
                  {team.players.length === 0 ? (
                    <div className="text-center text-gray-500 h-20 flex items-center justify-center">
                      <div>
                        <UserPlus className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        Drop players here
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6">
                      {/* Male Players */}
                      {team.players.filter(p => p.gender === 'M').length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-gray-600 mb-2">Males ({team.players.filter(p => p.gender === 'M').length})</div>
                          <div className="grid grid-cols-1 gap-3">
                            {team.players
                              .filter(player => player.gender === 'M')
                              .map((player) => (
                                <PlayerCard
                                  key={player.id}
                                  player={player}
                                  moveOptions={getMoveOptions(player)}
                                  onMove={onPlayerMove}
                                  onDragStart={() => handleDragStart(player, team.id)}
                                  onDragEnd={handleDragEnd}
                                  playerGroups={playerGroups}
                                />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Female Players */}
                      {team.players.filter(p => p.gender === 'F').length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-gray-600 mb-2">Females ({team.players.filter(p => p.gender === 'F').length})</div>
                          <div className="grid grid-cols-1 gap-3">
                            {team.players
                              .filter(player => player.gender === 'F')
                              .map((player) => (
                                <PlayerCard
                                  key={player.id}
                                  player={player}
                                  moveOptions={getMoveOptions(player)}
                                  onMove={onPlayerMove}
                                  onDragStart={() => handleDragStart(player, team.id)}
                                  onDragEnd={handleDragEnd}
                                  playerGroups={playerGroups}
                                />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Other Gender Players */}
                      {team.players.filter(p => p.gender === 'Other').length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-gray-600 mb-2">Other ({team.players.filter(p => p.gender === 'Other').length})</div>
                          <div className="grid grid-cols-1 gap-3">
                            {team.players
                              .filter(player => player.gender === 'Other')
                              .map((player) => (
                                <PlayerCard
                                  key={player.id}
                                  player={player}
                                  moveOptions={getMoveOptions(player)}
                                  onMove={onPlayerMove}
                                  onDragStart={() => handleDragStart(player, team.id)}
                                  onDragEnd={handleDragEnd}
                                  playerGroups={playerGroups}
                                />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface GroupCardProps {
  group: PlayerGroup;
  players: Player[];
  moveOptions: Array<{ value: string | null; label: string; disabled: boolean }>;
  onMove: (playerId: string, targetTeamId: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  playerGroups: PlayerGroup[];
  compact?: boolean;
}

interface PlayerCardProps {
  player: Player;
  moveOptions: Array<{ value: string | null; label: string; disabled: boolean }>;
  onMove: (playerId: string, targetTeamId: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  playerGroups: PlayerGroup[];
  compact?: boolean;
}

function GroupCard({ group, players, moveOptions, onMove, onDragStart, onDragEnd, playerGroups, compact = false }: GroupCardProps) {
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
      className={`bg-white border-2 rounded-lg cursor-move hover:shadow-md transition-shadow relative ${compact ? 'p-2' : 'p-3'}`}
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
        className="absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
        style={{ backgroundColor: groupColor }}
      >
        {groupLabel}
      </div>

      <div className={compact ? 'space-y-1' : 'space-y-2'}>
        <div className={`flex items-center justify-between ${compact ? 'gap-1' : 'gap-2'}`}>
          <div className={`font-bold ${compact ? 'text-xs' : 'text-sm'}`} style={{ color: groupColor }}>
            Group {groupLabel} ({players.length} players)
          </div>
          <div className={`flex items-center gap-1 ${compact ? 'text-xs' : 'text-sm'}`}>
            <Badge className={`${compact ? "text-[10px] h-4 px-1" : "text-xs"} ${getSkillLevelColor(averageSkill)}`}>
              Avg: {averageSkill}
            </Badge>
          </div>
        </div>

        {/* List all players in the group */}
        <div className="space-y-1">
          {players.map((player, index) => (
            <div key={player.id} className={`flex items-center justify-between ${compact ? 'text-xs' : 'text-sm'} p-1 rounded`}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="font-medium truncate" title={player.name}>
                  {player.name}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Badge variant="outline" className={compact ? "text-[10px] h-4 px-1" : "text-xs"}>{player.gender}</Badge>
                <Badge className={`${compact ? "text-[10px] h-4 px-1" : "text-xs"} ${getSkillLevelColor(getEffectiveSkillRating(player))}`}>
                  {getEffectiveSkillRating(player)}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {!compact && (
          <div className="flex items-center gap-2 pt-1">
            <Move className="h-3 w-3 text-gray-400 flex-shrink-0" />
            <Select onValueChange={(value) => {
              // Move all players in the group
              players.forEach(player => {
                onMove(player.id, value === 'null' ? null : value);
              });
            }}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Move group to..." />
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
        )}
      </div>
    </div>
  );
}

function PlayerCard({ player, moveOptions, onMove, onDragStart, onDragEnd, playerGroups, compact = false }: PlayerCardProps) {
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
      className={`bg-white border rounded-lg cursor-move hover:shadow-md transition-shadow relative ${compact ? 'p-1.5' : 'p-3'}`}
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
          className="absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
          style={{ backgroundColor: groupColor }}
        >
          {groupLabel}
        </div>
      )}

      <div className={compact ? 'space-y-1' : 'space-y-2'}>
        <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
          <div className={`font-medium ${compact ? 'text-xs truncate flex-1 min-w-0' : 'text-sm truncate'}`} title={player.name}>
            {player.name}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Badge variant="outline" className={compact ? "text-[10px] h-5 px-1" : "text-xs"}>{player.gender}</Badge>
            <Badge className={`${compact ? "text-[10px] h-5 px-1" : "text-xs"} ${getSkillLevelColor(getEffectiveSkillRating(player))}`}>
              {getEffectiveSkillRating(player)}
            </Badge>
          </div>
        </div>

      {!compact && (player.teammateRequests.length > 0 || player.avoidRequests.length > 0) && (
        <div className="text-xs text-gray-600 mb-2">
          {player.teammateRequests.length > 0 && (
            <div className="text-green-600">
              Wants: {player.teammateRequests.join(', ')}
            </div>
          )}
          {player.avoidRequests.length > 0 && (
            <div className="text-red-600">
              Avoid: {player.avoidRequests.join(', ')}
            </div>
          )}
        </div>
      )}

        {!compact && (
          <div className="flex items-center gap-2">
            <Move className="h-3 w-3 text-gray-400 flex-shrink-0" />
            <Select onValueChange={(value) => onMove(player.id, value === 'null' ? null : value)}>
              <SelectTrigger className="h-7 text-xs">
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
        )}
      </div>
    </div>
  );
}
