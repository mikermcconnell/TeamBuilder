import { Player } from '@/types';

export const REGISTRATION_INFO_PLACEHOLDER =
  'No registration notes provided.';

export function getPlayerRegistrationInfo(player: Player): string {
  const registrationInfo = player.registrationInfo?.trim();
  const experienceNotes = player.experienceNotes?.trim();

  if (registrationInfo && registrationInfo.length > 0) {
    return registrationInfo;
  }

  if (experienceNotes && experienceNotes.length > 0) {
    return experienceNotes;
  }

  return REGISTRATION_INFO_PLACEHOLDER;
}
