import type { Player } from '@/types';

export interface PlayerLabelDisplay {
  key: string;
  shortLabel: string;
  label: string;
  className: string;
}

const PLAYER_LABELS: Record<string, PlayerLabelDisplay> = {
  heart: {
    key: 'heart',
    shortLabel: '💜',
    label: 'Heart',
    className: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  },
};

export function normalizePlayerLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '-');
}

export function getPlayerLabels(player: Pick<Player, 'labels'>): PlayerLabelDisplay[] {
  const labels = player.labels ?? [];
  const seen = new Set<string>();

  return labels
    .map(normalizePlayerLabel)
    .filter(label => {
      if (!label || seen.has(label)) {
        return false;
      }

      seen.add(label);
      return true;
    })
    .map(label => PLAYER_LABELS[label] ?? {
      key: label,
      shortLabel: label,
      label,
      className: 'border-slate-200 bg-slate-50 text-slate-700',
    });
}

