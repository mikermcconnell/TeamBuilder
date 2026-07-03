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
    shortLabel: 'A♀',
    label: 'Leader A Female',
    className: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  },
  'leader-a-female': {
    key: 'leader-a-female',
    shortLabel: 'A♀',
    label: 'Leader A Female',
    className: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  },
  'a♂': {
    key: 'a♂',
    shortLabel: 'A♂',
    label: 'Leader A Male',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  'b♂': {
    key: 'b♂',
    shortLabel: 'B♂',
    label: 'Leader B Male',
    className: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  'leader-a-male': {
    key: 'leader-a-male',
    shortLabel: 'A♂',
    label: 'Leader A Male',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  'leader-b-male': {
    key: 'leader-b-male',
    shortLabel: 'B♂',
    label: 'Leader B Male',
    className: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  'leader-b-female': {
    key: 'leader-b-female',
    shortLabel: 'B♀',
    label: 'Leader B Female',
    className: 'border-pink-200 bg-pink-50 text-pink-800',
  },
  'leader-b': {
    key: 'leader-b',
    shortLabel: 'B',
    label: 'Leader B',
    className: 'border-sky-200 bg-sky-50 text-sky-800',
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
