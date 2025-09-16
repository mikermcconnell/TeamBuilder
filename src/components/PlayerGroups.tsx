import React, { useState } from 'react';
import { PlayerGroup, Player } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  UserCheck,
  AlertTriangle,
  Trophy,
  Target,
  Info,
  UserPlus,
  UserMinus,
  Plus,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';

interface PlayerGroupsProps {
  playerGroups: PlayerGroup[];
  players: Player[];
  onAddPlayerToGroup: (playerId: string, groupId: string) => void;
  onRemovePlayerFromGroup: (playerId: string) => void;
  onCreateNewGroup: (playerIds: string[]) => void;
  onDeleteGroup: (groupId: string) => void;
  onMergeGroups: (sourceGroupId: string, targetGroupId: string) => void;
}

export function PlayerGroups({ 
  playerGroups, 
  players, 
  onAddPlayerToGroup, 
  onRemovePlayerFromGroup, 
  onCreateNewGroup, 
  onDeleteGroup,
  onMergeGroups
}: PlayerGroupsProps) {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isMergingGroup, setIsMergingGroup] = useState(false);
  const [selectedGroupForMerge, setSelectedGroupForMerge] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  
  const ungroupedPlayers = players.filter(p => !p.groupId);

  const getSkillLevelColor = (skill: number): string => {
    if (skill >= 8) return 'text-white bg-green-800';
    if (skill >= 6) return 'text-white bg-green-600';
    if (skill >= 4) return 'text-black bg-green-200';
    return 'text-black bg-gray-100';
  };

  // Helper functions for group management
  const handlePlayerSelect = (playerId: string, selected: boolean) => {
    if (selected) {
      setSelectedPlayers(prev => [...prev, playerId]);
    } else {
      setSelectedPlayers(prev => prev.filter(id => id !== playerId));
    }
  };

  const handleAddToExistingGroup = (playerId: string, groupId: string) => {
    const group = playerGroups.find(g => g.id === groupId);
    if (group && group.players.length >= 4) {
      toast.error('Groups can have a maximum of 4 players');
      return;
    }
    onAddPlayerToGroup(playerId, groupId);
    toast.success('Player added to group');
  };

  const handleCreateNewGroup = () => {
    if (selectedPlayers.length === 0) {
      toast.error('Please select at least one player');
      return;
    }
    if (selectedPlayers.length > 4) {
      toast.error('Groups can have a maximum of 4 players');
      return;
    }
    onCreateNewGroup(selectedPlayers);
    setSelectedPlayers([]);
    setIsCreatingGroup(false);
    setNewGroupName('');
    toast.success(`Created new group with ${selectedPlayers.length} players`);
  };

  const handleRemoveFromGroup = (playerId: string) => {
    onRemovePlayerFromGroup(playerId);
    toast.success('Player removed from group');
  };

  const handleDeleteGroup = (groupId: string) => {
    onDeleteGroup(groupId);
    toast.success('Group deleted');
  };

  const canAddToGroup = (groupId: string): boolean => {
    const group = playerGroups.find(g => g.id === groupId);
    return group ? group.players.length < 4 : false;
  };

  const handleMergeGroups = (sourceGroupId: string, targetGroupId: string) => {
    const sourceGroup = playerGroups.find(g => g.id === sourceGroupId);
    const targetGroup = playerGroups.find(g => g.id === targetGroupId);
    
    if (!sourceGroup || !targetGroup) return;
    
    const totalPlayers = sourceGroup.players.length + targetGroup.players.length;
    if (totalPlayers > 4) {
      toast.error('Merged group would exceed 4 players');
      return;
    }
    
    onMergeGroups(sourceGroupId, targetGroupId);
    setSelectedGroupForMerge(null);
    setIsMergingGroup(false);
    toast.success('Groups merged successfully');
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{playerGroups.length}</div>
            <div className="text-sm text-gray-600">Player Groups</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {playerGroups.reduce((sum, group) => sum + group.players.length, 0)}
            </div>
            <div className="text-sm text-gray-600">Grouped Players</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{ungroupedPlayers.length}</div>
            <div className="text-sm text-gray-600">Individual Players</div>
          </CardContent>
        </Card>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Player groups are formed from mutual teammate requests. Only players who requested each other 
          are grouped together. Groups can contain 2-4 players and will be kept together during team generation.
        </AlertDescription>
      </Alert>

      {/* Player Groups */}
      {playerGroups.length > 0 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Player Groups ({playerGroups.length})
                </div>
                {playerGroups.length > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => setIsMergingGroup(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Merge Groups
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                Groups formed from mutual teammate requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {playerGroups.map((group) => {
                  const avgSkill = group.players.reduce((sum, p) => sum + p.skillRating, 0) / group.players.length;
                  const genderBreakdown = group.players.reduce((acc, p) => {
                    acc[p.gender]++;
                    return acc;
                  }, { M: 0, F: 0, Other: 0 });

                  return (
                    <Card key={group.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <div 
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                              style={{ backgroundColor: group.color }}
                            >
                              {group.label}
                            </div>
                            Group {group.label} ({group.players.length}/4)
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteGroup(group.id)}
                              className="h-8 hover:bg-red-50 hover:border-red-200"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Trophy className="h-4 w-4 text-yellow-600" />
                            <span>Avg: {avgSkill.toFixed(1)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Target className="h-4 w-4 text-blue-600" />
                            <span>
                              {genderBreakdown.M}M / {genderBreakdown.F}F / {genderBreakdown.Other}O
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent>
                        <div className="space-y-2">
                          {group.players.map((player, index) => (
                            <div 
                              key={player.id}
                              className="flex items-center justify-between p-3 rounded-lg border"
                              style={{ 
                                backgroundColor: `${group.color}08`,
                                borderColor: `${group.color}30`
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                                  style={{ backgroundColor: group.color }}
                                >
                                  {group.label}
                                </div>
                                <div className="font-medium">{player.name}</div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {player.gender}
                                </Badge>
                                <Badge className={`text-xs ${getSkillLevelColor(player.skillRating)}`}>
                                  {player.skillRating}
                                </Badge>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveFromGroup(player.id)}
                                  className="h-6 w-6 p-0 hover:bg-red-50 hover:border-red-200"
                                  title="Remove from group"
                                >
                                  <UserMinus className="h-3 w-3 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Show mutual requests within group */}
                        <div className="mt-3 pt-3 border-t">
                          <div className="text-xs text-gray-600">
                            <div className="font-medium text-green-600 mb-1">Mutual Requests:</div>
                            {group.players.map(player => (
                              <div key={player.id} className="mb-1">
                                <span className="font-medium">{player.name}</span>: {
                                  player.teammateRequests.length > 0 
                                    ? player.teammateRequests.join(', ')
                                    : 'None'
                                }
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Group Management Controls */}
      {ungroupedPlayers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Group Management
            </CardTitle>
            <CardDescription>
              Create new groups or add players to existing groups
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create New Group */}
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setIsCreatingGroup(true)}
                disabled={selectedPlayers.length === 0}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create New Group ({selectedPlayers.length} selected)
              </Button>
              
              {selectedPlayers.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setSelectedPlayers([])}
                  className="flex items-center gap-2"
                >
                  Clear Selection
                </Button>
              )}
            </div>

            {/* New Group Creation Dialog */}
            <Dialog open={isCreatingGroup} onOpenChange={setIsCreatingGroup}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Group</DialogTitle>
                  <DialogDescription>
                    Creating a group with {selectedPlayers.length} players
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Selected Players:</label>
                    <div className="mt-2 space-y-1">
                      {selectedPlayers.map(playerId => {
                        const player = players.find(p => p.id === playerId);
                        return player ? (
                          <div key={playerId} className="text-sm text-gray-600">
                            • {player.name} (Skill: {player.skillRating})
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleCreateNewGroup} className="flex-1">
                      Create Group
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsCreatingGroup(false);
                        setNewGroupName('');
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {selectedPlayers.length > 4 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Groups can have a maximum of 4 players. Please deselect {selectedPlayers.length - 4} players.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Individual Players */}
      {ungroupedPlayers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Individual Players ({ungroupedPlayers.length})
            </CardTitle>
            <CardDescription>
              Players without groups - select players to create groups or add to existing ones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ungroupedPlayers.map((player) => (
                <div
                  key={player.id}
                  className={`border rounded-lg p-3 transition-colors ${
                    selectedPlayers.includes(player.id) 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {/* Player selection checkbox */}
                  <div className="flex items-start gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={selectedPlayers.includes(player.id)}
                      onChange={(e) => handlePlayerSelect(player.id, e.target.checked)}
                      className="mt-1 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">{player.name}</div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">{player.gender}</Badge>
                          <Badge className={`text-xs ${getSkillLevelColor(player.skillRating)}`}>
                            {player.skillRating}
                          </Badge>
                        </div>
                      </div>
                      
                      {player.teammateRequests.length > 0 && (
                        <div className="text-xs text-gray-600 mb-2">
                          <div className="text-orange-600">
                            Non-mutual requests: {player.teammateRequests.join(', ')}
                          </div>
                        </div>
                      )}
                      
                      {player.avoidRequests.length > 0 && (
                        <div className="text-xs text-red-600 mb-2">
                          Avoid: {player.avoidRequests.join(', ')}
                        </div>
                      )}

                      {/* Add to existing group dropdown */}
                      {playerGroups.length > 0 && (
                        <div className="mt-2">
                          <Select onValueChange={(groupId) => handleAddToExistingGroup(player.id, groupId)}>
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Add to group..." />
                            </SelectTrigger>
                            <SelectContent>
                              {playerGroups.map((group) => (
                                <SelectItem
                                  key={group.id}
                                  value={group.id}
                                  disabled={!canAddToGroup(group.id)}
                                >
                                  <div className="flex flex-col">
                                    <div>
                                      Group {group.label} ({group.players.length}/4)
                                      {!canAddToGroup(group.id) && ' - Full'}
                                    </div>
                                    {group.players.length > 0 && (
                                      <div className="text-xs text-gray-600">
                                        {group.players.map(p => p.name).join(', ')}
                                      </div>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Groups Message */}
      {playerGroups.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Player Groups Found</h3>
            <p className="text-gray-600">
              No mutual teammate requests were found in your player roster. 
              Players need to request each other to form groups.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Group Merge Dialog */}
      <Dialog open={isMergingGroup} onOpenChange={setIsMergingGroup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Groups</DialogTitle>
            <DialogDescription>
              Select groups to merge. The merged group cannot exceed 4 players.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedGroupForMerge ? (
              <div>
                <label className="text-sm font-medium">Select target group to merge with:</label>
                <div className="mt-2 space-y-2">
                  {playerGroups
                    .filter(g => g.id !== selectedGroupForMerge)
                    .map(group => {
                      const sourceGroup = playerGroups.find(g => g.id === selectedGroupForMerge);
                      const wouldExceedLimit = sourceGroup && (sourceGroup.players.length + group.players.length > 4);
                      
                      return (
                        <Button
                          key={group.id}
                          onClick={() => handleMergeGroups(selectedGroupForMerge, group.id)}
                          disabled={wouldExceedLimit}
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                              style={{ backgroundColor: group.color }}
                            >
                              {group.label}
                            </div>
                            Group {group.label} ({group.players.length}/4)
                            {wouldExceedLimit && (
                              <span className="text-xs text-red-600">Would exceed 4 players</span>
                            )}
                          </div>
                        </Button>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">Select first group to merge:</label>
                <div className="mt-2 space-y-2">
                  {playerGroups.map(group => (
                    <Button
                      key={group.id}
                      onClick={() => setSelectedGroupForMerge(group.id)}
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                          style={{ backgroundColor: group.color }}
                        >
                          {group.label}
                        </div>
                        Group {group.label} ({group.players.length}/4)
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsMergingGroup(false);
                  setSelectedGroupForMerge(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
