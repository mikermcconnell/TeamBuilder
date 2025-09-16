import React, { memo, CSSProperties } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Player } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserCheck, UserX, Eye, Edit2, Trash2 } from 'lucide-react';

interface VirtualizedPlayerTableProps {
  players: Player[];
  onView: (player: Player) => void;
  onEdit: (player: Player) => void;
  onRemove?: (playerId: string) => void;
  onSkillEdit: (playerId: string, currentValue: number) => void;
  height: number;
}

interface RowProps {
  index: number;
  style: CSSProperties;
  data: {
    players: Player[];
    onView: (player: Player) => void;
    onEdit: (player: Player) => void;
    onRemove?: (playerId: string) => void;
    onSkillEdit: (playerId: string, currentValue: number) => void;
  };
}

const Row = memo(({ index, style, data }: RowProps) => {
  const player = data.players[index];

  const getGenderBadgeVariant = (gender: string) => {
    switch (gender) {
      case 'M': return 'default';
      case 'F': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div style={style} className="flex items-center border-b border-gray-200 hover:bg-gray-50 px-4">
      <div className="flex-1 grid grid-cols-7 gap-4 items-center py-2">
        <div className="font-medium truncate">{player.name}</div>
        <div>
          <Badge variant={getGenderBadgeVariant(player.gender)}>
            {player.gender}
          </Badge>
        </div>
        <div>
          <span
            className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded inline-block"
            onClick={() => data.onSkillEdit(player.id, player.skillRating)}
          >
            {player.skillRating}
          </span>
        </div>
        <div className="text-sm text-gray-600 truncate">
          {player.email || '-'}
        </div>
        <div className="flex gap-1">
          {player.teammateRequests.length > 0 && (
            <Badge variant="outline" className="text-xs">
              <UserCheck className="h-3 w-3 mr-1" />
              {player.teammateRequests.length}
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          {player.avoidRequests.length > 0 && (
            <Badge variant="outline" className="text-xs text-red-600 border-red-300">
              <UserX className="h-3 w-3 mr-1" />
              {player.avoidRequests.length}
            </Badge>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => data.onView(player)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => data.onEdit(player)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          {data.onRemove && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              onClick={() => data.onRemove(player.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

Row.displayName = 'VirtualizedRow';

export function VirtualizedPlayerTable({
  players,
  onView,
  onEdit,
  onRemove,
  onSkillEdit,
  height
}: VirtualizedPlayerTableProps) {
  const itemData = {
    players,
    onView,
    onEdit,
    onRemove,
    onSkillEdit
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Table Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <div className="grid grid-cols-7 gap-4 text-sm font-medium text-gray-700">
          <div>Name</div>
          <div>Gender</div>
          <div>Skill Rating</div>
          <div>Email</div>
          <div>Teammate Requests</div>
          <div>Avoid Requests</div>
          <div className="text-right">Actions</div>
        </div>
      </div>

      {/* Virtualized List */}
      {players.length > 0 ? (
        <List
          height={height}
          itemCount={players.length}
          itemSize={60}
          width="100%"
          itemData={itemData}
        >
          {Row}
        </List>
      ) : (
        <div className="p-8 text-center text-gray-500">
          No players found
        </div>
      )}
    </div>
  );
}

export default VirtualizedPlayerTable;