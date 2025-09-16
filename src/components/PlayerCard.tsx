import React, { memo } from 'react';
import { Player, PlayerGroup } from '@/types';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { UserCheck, UserX, Star } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  moveOptions: Array<{ value: string | null; label: string; disabled: boolean }>;
  onMove: (playerId: string, targetTeamId: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  playerGroups: PlayerGroup[];
}

// Memoized PlayerCard component to prevent unnecessary re-renders
export const PlayerCard = memo(function PlayerCard({
  player,
  moveOptions,
  onMove,
  onDragStart,
  onDragEnd,
  playerGroups
}: PlayerCardProps) {
  const getGenderBadgeColor = (gender: 'M' | 'F' | 'Other') => {
    switch (gender) {
      case 'M': return 'bg-blue-100 text-blue-800';
      case 'F': return 'bg-pink-100 text-pink-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSkillBadgeColor = (rating: number) => {
    if (rating >= 8) return 'bg-purple-100 text-purple-800';
    if (rating >= 6) return 'bg-green-100 text-green-800';
    if (rating >= 4) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

  const getPlayerGroupLabel = (groups: PlayerGroup[], playerId: string): string | null => {
    const group = groups.find(g => g.players.some(p => p.id === playerId));
    return group ? group.label : null;
  };

  const getPlayerGroupColor = (groups: PlayerGroup[], playerId: string): string => {
    const group = groups.find(g => g.players.some(p => p.id === playerId));
    return group?.color || '#000000';
  };

  const groupLabel = getPlayerGroupLabel(playerGroups, player.id);
  const groupColor = getPlayerGroupColor(playerGroups, player.id);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-move"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {groupLabel && (
            <Badge
              className="text-xs px-1.5 py-0"
              style={{
                backgroundColor: `${groupColor}20`,
                color: groupColor,
                borderColor: groupColor
              }}
            >
              {groupLabel}
            </Badge>
          )}
          <span className="text-sm font-medium truncate">{player.name}</span>
          <Badge className={`text-xs ${getGenderBadgeColor(player.gender)}`}>
            {player.gender}
          </Badge>
          <Badge className={`text-xs ${getSkillBadgeColor(player.skillRating)}`}>
            <Star className="h-3 w-3 mr-0.5" />
            {player.skillRating}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {player.teammateRequests.length > 0 && (
            <Badge variant="outline" className="text-xs px-1">
              <UserCheck className="h-3 w-3" />
            </Badge>
          )}
          {player.avoidRequests.length > 0 && (
            <Badge variant="outline" className="text-xs px-1 text-red-600 border-red-300">
              <UserX className="h-3 w-3" />
            </Badge>
          )}

          <Select
            value={player.teamId || 'unassigned'}
            onValueChange={(value) => {
              const targetTeamId = value === 'unassigned' ? null : value;
              onMove(player.id, targetTeamId);
            }}
          >
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue />
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
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.player.id === nextProps.player.id &&
    prevProps.player.teamId === nextProps.player.teamId &&
    prevProps.player.name === nextProps.player.name &&
    prevProps.player.skillRating === nextProps.player.skillRating &&
    prevProps.moveOptions.length === nextProps.moveOptions.length &&
    prevProps.playerGroups.length === nextProps.playerGroups.length
  );
});