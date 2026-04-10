import { Player } from '@/types';
import { getPlayerDisplayRegistrationInfo } from './playerProfile';

export const REGISTRATION_INFO_PLACEHOLDER =
  'No registration notes provided.';

export function getPlayerRegistrationInfo(player: Player): string {
  const registrationInfo = getPlayerDisplayRegistrationInfo(player)?.trim();

  if (registrationInfo && registrationInfo.length > 0) {
    return registrationInfo;
  }

  return REGISTRATION_INFO_PLACEHOLDER;
}
