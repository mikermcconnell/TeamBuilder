import React, { useState } from 'react';
import { Player, Team, LeagueConfig, PlayerGroup } from '@/types';
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
}

export function TeamDisplay({ teams, unassignedPlayers, config, onPlayerMove, onTeamNameChange, players, playerGroups }: TeamDisplayProps) {
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
        
        const totalMembers = allGroupMembers.length + 1;
        const destination = targetTeamId ? 'team' : 'unassigned';
        toast.success(`Moved Group ${groupLabel} (${totalMembers} players) to ${destination}`);
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
    if (skill >= 8) return 'text-green-600 bg-green-50';
    if (skill >= 6) return 'text-blue-600 bg-blue-50';
    if (skill >= 4) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getMoveOptions = (player: Player): Array<{ value: string | null; label: string; disabled: boolean }> => {
    const isInGroup = isPlayerInGroup(player);
    const groupLabel = getPlayerGroupLabel(playerGroups, player.id);
    const allGroupMembers = isInGroup ? findAllGroupMembers(player) : [];
    const totalGroupSize = isInGroup ? allGroupMembers.length + 1 : 1;
    
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
        label = `Move Group ${groupLabel} (${totalGroupSize} players) to ${team.name}`;
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

  return (
    <div className="space-y-6">
      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{teams.length}</div>
            <div className="text-sm text-gray-600">Teams Created</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {teams.reduce((sum, team) => sum + team.players.length, 0)}
            </div>
            <div className="text-sm text-gray-600">Players Assigned</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{unassignedPlayers.length}</div>
            <div className="text-sm text-gray-600">Unassigned</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {teams.filter(team => getTeamConstraintViolations(team).violations.length === 0).length}
            </div>
            <div className="text-sm text-gray-600">Valid Teams</div>
          </CardContent>
        </Card>
      </div>

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
        {teams.map((team) => {
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
                      <span>Avg Skill: {team.averageSkill.toFixed(1)}</span>
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

interface PlayerCardProps {
  player: Player;
  moveOptions: Array<{ value: string | null; label: string; disabled: boolean }>;
  onMove: (playerId: string, targetTeamId: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  playerGroups: PlayerGroup[];
}

function PlayerCard({ player, moveOptions, onMove, onDragStart, onDragEnd, playerGroups }: PlayerCardProps) {
  const getSkillLevelColor = (skill: number): string => {
    if (skill >= 8) return 'text-green-600 bg-green-50';
    if (skill >= 6) return 'text-blue-600 bg-blue-50';
    if (skill >= 4) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const playerGroup = getPlayerGroup(playerGroups, player.id);
  const groupColor = getPlayerGroupColor(playerGroups, player.id);
  const groupLabel = getPlayerGroupLabel(playerGroups, player.id);
  const isInGroup = playerGroup !== null;

  return (
    <div
      className="bg-white border rounded-lg p-3 cursor-move hover:shadow-md transition-shadow relative"
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

      <div className="flex items-center justify-between mb-2">
        <div className="font-medium truncate flex items-center gap-1">
          {player.name}
          {isInGroup && (
            <span title={`Group ${groupLabel} - ${playerGroup?.players.length} players`}>
              <Link className="h-3 w-3" style={{ color: groupColor }} />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-xs">{player.gender}</Badge>
          <Badge className={`text-xs ${getSkillLevelColor(player.skillRating)}`}>
            {player.skillRating}
          </Badge>
        </div>
      </div>
      
      {(player.teammateRequests.length > 0 || player.avoidRequests.length > 0 || isInGroup) && (
        <div className="text-xs text-gray-600 mb-2">
          {isInGroup && playerGroup && (
            <div className="font-medium flex items-center gap-1 mb-1" style={{ color: groupColor }}>
              <Link className="h-3 w-3" />
              Group {groupLabel}: {playerGroup.players.map(p => p.name).join(', ')}
            </div>
          )}
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
      
      <div className="flex items-center gap-2">
        <Move className="h-3 w-3 text-gray-400" />
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
    </div>
  );
}
