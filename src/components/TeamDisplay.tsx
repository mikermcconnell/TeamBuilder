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
    <div className="space-y-4">
      {/* Unassigned Players Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Unassigned Players ({unassignedPlayers.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Drag players to teams or use the dropdown to assign
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            className="grid grid-cols-3 gap-2"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, null)}
          >
            {unassignedPlayers.map((player) => (
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

      {/* Teams Grid */}
      <div className="grid grid-cols-3 gap-4">
        {teams.map((team) => {
          const { violations, sizeIssues } = getTeamConstraintViolations(team);
          const hasViolations = violations.length > 0;
          const hasSizeIssues = sizeIssues.length > 0;
          
          return (
            <Card 
              key={team.id}
              className={`${hasViolations ? 'border-red-500' : hasSizeIssues ? 'border-yellow-500' : ''}`}
            >
              <CardHeader className="pb-3 space-y-1">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    {editingTeamId === team.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={tempTeamName}
                          onChange={(e) => setTempTeamName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveTeamName(team.id);
                            if (e.key === 'Escape') cancelEditingTeamName();
                          }}
                          className="h-7 text-sm"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => saveTeamName(team.id)}
                          className="h-7 px-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span 
                        className="cursor-pointer hover:underline"
                        onClick={() => startEditingTeamName(team.id, team.name)}
                      >
                        {team.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <Target className="h-4 w-4" />
                    {team.averageSkill.toFixed(1)}
                  </div>
                </CardTitle>
                <CardDescription className="text-xs flex items-center justify-between">
                  <span>Players: {team.players.length}/{config.maxTeamSize}</span>
                  <span>Total Skill: {team.players.reduce((sum, p) => sum + p.skillRating, 0)}</span>
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div 
                  className="space-y-2"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, team.id)}
                >
                  {team.players.map((player) => (
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

                {(hasViolations || hasSizeIssues) && (
                  <div className="mt-3 space-y-2">
                    {violations.map((violation, index) => (
                      <Alert key={index} variant="destructive" className="py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs ml-2">
                          {violation}
                        </AlertDescription>
                      </Alert>
                    ))}
                    {sizeIssues.map((issue, index) => (
                      <Alert key={index} variant="default" className="py-2 border-yellow-500 bg-yellow-50">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs ml-2">
                          {issue}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
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
    if (skill >= 8) return 'bg-green-100 text-green-800';
    if (skill >= 6) return 'bg-blue-100 text-blue-800';
    if (skill >= 4) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const playerGroup = getPlayerGroup(playerGroups, player.id);
  const groupColor = playerGroup ? getPlayerGroupColor(playerGroups, player.id) : null;
  const groupLabel = playerGroup ? getPlayerGroupLabel(playerGroups, player.id) : null;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`
        p-2 rounded-lg border cursor-move
        hover:shadow-md transition-shadow
        ${groupColor ? `border-[${groupColor}30] bg-[${groupColor}08]` : 'border-gray-200 bg-white'}
      `}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {groupLabel && (
              <div 
                className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ backgroundColor: groupColor || undefined }}
              >
                {groupLabel}
              </div>
            )}
            <div className="text-sm font-medium truncate">{player.name}</div>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Badge variant="secondary" className={`text-[10px] px-1 py-0 ${getSkillLevelColor(player.skillRating)}`}>
              Skill: {player.skillRating}
            </Badge>
          </div>
        </div>
        <Select
          value={player.groupId || 'unassigned'}
          onValueChange={(value) => onMove(player.id, value === 'unassigned' ? null : value)}
        >
          <SelectTrigger className="h-6 w-6 px-0">
            <SelectValue>
              <Move className="h-3 w-3" />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {moveOptions.map((option) => (
              <SelectItem
                key={option.value || 'unassigned'}
                value={option.value || 'unassigned'}
                disabled={option.disabled}
                className="text-xs"
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
