import type { Player } from '@/types';
import { Badge } from '@/components/ui/badge';
import { getPlayerLabels } from '@/utils/playerLabels';

interface PlayerLabelsProps {
  player: Player;
  compact?: boolean;
}

export function PlayerLabels({ player, compact = false }: PlayerLabelsProps) {
  const labels = getPlayerLabels(player);

  if (labels.length === 0) {
    return null;
  }

  return (
    <>
      {labels.map(label => (
        <Badge
          key={label.key}
          variant="outline"
          className={`${label.className} ${compact ? 'h-4 px-1 text-[10px]' : 'h-5 px-1.5 text-xs'} font-semibold`}
          title={label.label}
        >
          {compact ? label.shortLabel : label.shortLabel}
        </Badge>
      ))}
    </>
  );
}

