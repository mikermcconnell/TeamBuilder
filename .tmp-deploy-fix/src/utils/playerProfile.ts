import { Player, getPlayerAge, getPlayerRegistrationNotes } from '@/types';

export function getPlayerDisplayAge(player: Player): number | undefined {
  return getPlayerAge(player);
}

export function getPlayerDisplayRegistrationInfo(player: Player): string | undefined {
  return getPlayerRegistrationNotes(player);
}
