import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Player, getEffectiveSkillRating } from '@/types';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Unlink, Users, AlertTriangle } from 'lucide-react';

interface DraggablePlayerCardProps {
  player: Player;
  compact?: boolean;
  groupColor?: string | null; // Group color for visual indicator
  groupLabel?: string | null; // Group label (A, B, C...)
  showSplitWarning?: boolean; // Show warning when player would be separated from group
}

export function DraggablePlayerCard({
  player,
  compact = false,
  groupColor,
  groupLabel,
  showSplitWarning = false
}: DraggablePlayerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id, data: { type: 'player', player } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const effectiveSkill = getEffectiveSkillRating(player);

  const getSkillColor = (skill: number) => {
    const roundedSkill = Math.round(skill);
    if (roundedSkill >= 10) return 'bg-green-900 text-green-50 border-green-800';
    if (roundedSkill === 9) return 'bg-green-800 text-green-50 border-green-700';
    if (roundedSkill === 8) return 'bg-green-700 text-green-50 border-green-600';
    if (roundedSkill === 7) return 'bg-green-600 text-green-50 border-green-500';
    if (roundedSkill === 6) return 'bg-green-500 text-green-50 border-green-400';
    if (roundedSkill === 5) return 'bg-green-400 text-green-900 border-green-300';
    if (roundedSkill === 4) return 'bg-green-300 text-green-900 border-green-200';
    if (roundedSkill === 3) return 'bg-green-200 text-green-900 border-green-200';
    if (roundedSkill === 2) return 'bg-green-100 text-green-800 border-green-200';
    if (roundedSkill === 1) return 'bg-green-50 text-green-800 border-green-100';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`
        relative group flex items-center rounded-xl border-2 border-b-4 bg-white 
        hover:border-primary/50 hover:bg-slate-50 transition-all cursor-grab active:cursor-grabbing
        ${isDragging ? 'ring-2 ring-primary border-primary z-50 shadow-xl scale-105' : 'border-slate-200 shadow-sm'}
        ${compact ? 'p-1.5 gap-2' : 'p-3 gap-3'}
        ${groupColor ? 'border-l-4' : ''}
      `}
      style={{
        ...style,
        borderLeftColor: groupColor || undefined
      }}
    >
      {/* Group Badge Indicator */}
      {groupLabel && groupColor && (
        <div
          className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm z-10"
          style={{ backgroundColor: groupColor }}
          title={`Group ${groupLabel}`}
        >
          {groupLabel}
        </div>
      )}

      {/* Split Warning Indicator */}
      {showSplitWarning && (
        <div
          className="absolute -top-1.5 -right-1.5 z-10"
          title="Moving this player will separate them from their group"
        >
          <AlertTriangle className="h-4 w-4 text-amber-500 fill-amber-100" />
        </div>
      )}

      {/* Drag Handle */}
      <div className="text-gray-400 group-hover:text-gray-600 shrink-0">
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Avatar / Initials */}
      <div className={`
        flex items-center justify-center rounded-full font-bold shrink-0
        ${player.gender === 'F' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}
        ${compact ? 'h-5 w-5 text-[10px]' : 'h-8 w-8 text-xs'}
      `}>
        {player.name.substring(0, 2).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate leading-tight ${compact ? 'text-xs' : 'text-sm'}`}>
          {compact ? (
            <>
              <span className="lg:hidden">
                {(() => {
                  const parts = player.name.trim().split(/\s+/);
                  if (parts.length > 1) {
                    const lastName = parts[parts.length - 1] || '';
                    return `${parts[0]} ${lastName.charAt(0)}.`;
                  }
                  return player.name;
                })()}
              </span>
              <span className="hidden lg:inline">{player.name}</span>
            </>
          ) : player.name}
          {player.isHandler && (
            <span className="ml-1 inline-flex items-center justify-center bg-yellow-100 text-yellow-800 text-[9px] font-bold px-1 rounded h-3.5 align-middle" title="Handler">
              H
            </span>
          )}
        </div>
        {!compact && (
          <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
            <span>{player.gender}</span>
          </div>
        )}
      </div>

      {/* Skill Badge */}
      <div className="flex flex-col gap-1 items-end">
        <Badge
          variant="outline"
          className={`font-mono shrink-0 ${getSkillColor(effectiveSkill)} ${compact ? 'text-[10px] px-1 h-4' : 'text-xs'}`}
        >
          {effectiveSkill.toFixed(1)}
        </Badge>

        {/* Unfulfilled Request Indicators */}
        {player.unfulfilledRequests && player.unfulfilledRequests.length > 0 && !compact && (
          <div className="flex gap-1">
            {/* Non-reciprocal */}
            {player.unfulfilledRequests.some(r => r.reason === 'non-reciprocal') && (
              <div
                className="text-orange-500 cursor-help"
                title={`Non-reciprocal requests: ${player.unfulfilledRequests.filter(r => r.reason === 'non-reciprocal').map(r => r.name).join(', ')}`}
              >
                <Unlink className="h-3.5 w-3.5" />
              </div>
            )}

            {/* Group Full */}
            {player.unfulfilledRequests.some(r => r.reason === 'group-full') && (
              <div
                className="text-red-500 cursor-help"
                title={`Could not groups with (Group Full/Split): ${player.unfulfilledRequests.filter(r => r.reason === 'group-full').map(r => r.name).join(', ')}`}
              >
                <Users className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
