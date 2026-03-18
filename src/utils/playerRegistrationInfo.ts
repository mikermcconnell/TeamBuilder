import { Player } from '@/types';

export const REGISTRATION_INFO_PLACEHOLDER =
  'Registration notes placeholder. Import mapping will be wired up here.';

export function getPlayerRegistrationInfo(player: Player): string {
  const registrationInfo = player.registrationInfo?.trim();
  return registrationInfo && registrationInfo.length > 0
    ? registrationInfo
    : REGISTRATION_INFO_PLACEHOLDER;
}
