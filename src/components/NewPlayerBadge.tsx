import React from 'react';
import type { Player } from '@/types';
import { Sparkles } from 'lucide-react';
import { getNewPlayerStatus } from '@/utils/newPlayerDetection';

interface NewPlayerBadgeProps {
  player: Player;
  compact?: boolean;
  onStatusChange?: (isNewPlayer: boolean) => void;
}

const DOUBLE_CLICK_DELAY_MS = 220;

export function NewPlayerBadge({
  player,
  compact = false,
  onStatusChange,
}: NewPlayerBadgeProps) {
  const newPlayerStatus = getNewPlayerStatus(player);
  const clickTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const updateStatus = React.useCallback((isNewPlayer: boolean) => {
    if (!onStatusChange || player.isNewPlayer === isNewPlayer) {
      return;
    }

    onStatusChange(isNewPlayer);
  }, [onStatusChange, player.isNewPlayer]);

  const clearPendingClick = React.useCallback(() => {
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
  }, []);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    clearPendingClick();
    clickTimeoutRef.current = window.setTimeout(() => {
      updateStatus(false);
      clickTimeoutRef.current = null;
    }, DOUBLE_CLICK_DELAY_MS);
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    clearPendingClick();
    updateStatus(true);
  };

  const title = newPlayerStatus === 'new'
    ? 'Double-click keeps this player marked as new. Single-click marks them as returning.'
    : newPlayerStatus === 'returning'
      ? 'Single-click keeps this player marked as returning. Double-click marks them as new.'
      : 'Single-click marks this player as returning. Double-click marks them as new.';

  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`
        inline-flex items-center gap-1 rounded-full border font-bold transition-colors
        ${compact ? 'h-4 px-1.5 text-[9px]' : 'h-5 px-2 text-[10px]'}
        ${newPlayerStatus === 'new'
          ? 'border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
          : newPlayerStatus === 'returning'
            ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'}
      `}
      title={title}
      aria-label={`${player.name} new-player status: ${newPlayerStatus}. Single-click for returning, double-click for new.`}
      aria-pressed={newPlayerStatus === 'new'}
    >
      <Sparkles className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {compact
        ? newPlayerStatus === 'new'
          ? 'NEW'
          : newPlayerStatus === 'returning'
            ? 'RET'
            : 'REV'
        : newPlayerStatus === 'new'
          ? 'NEW'
          : newPlayerStatus === 'returning'
            ? 'RETURNING'
            : 'REVIEW'}
    </button>
  );
}
