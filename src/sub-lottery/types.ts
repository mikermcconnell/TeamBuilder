export type SubLotteryPool = 'open' | 'female';

export interface SubLotteryPlayer {
  id: string;
  name: string;
  pool: SubLotteryPool;
  seasonSubCount: number;
  active: boolean;
}

export interface SubLotteryScheduleEntry {
  id: string;
  seasonId?: string;
  weekLabel: string;
  gameDate?: string;
  captainName: string;
  teamName: string;
  gameLabel: string;
  pool: SubLotteryPool;
  active: boolean;
}

export interface SubLotteryRequest {
  id: string;
  seasonId: string;
  captainName: string;
  teamName: string;
  gameLabel: string;
  pool: SubLotteryPool;
  slotsNeeded?: number;
  status: 'open' | 'assigned' | 'void';
  openedAt: string;
  closesAt: string;
  availabilityOpensAt?: string;
  availabilityClosesAt?: string;
  drawAt?: string;
  assignedPlayerId?: string;
  assignedPlayerIds?: string[];
  assignedAt?: string;
  scheduleEntryId?: string;
  weekLabel?: string;
}

export interface SubLotteryAvailability {
  requestId: string;
  playerId: string;
  enteredAt: string;
}

export interface SubLotteryEntry {
  playerId: string;
  weight: number;
}

export interface SubLotteryAssignment {
  requestId: string;
  playerId: string;
  seasonId?: string;
  captainName?: string;
  teamName?: string;
  gameLabel?: string;
  pool?: SubLotteryPool;
  weekLabel?: string;
  assignedAt: string;
  eligiblePlayerIds: string[];
}

export interface SubLotteryPublicState {
  seasonId: string;
  seasonName: string;
  players: SubLotteryPlayer[];
  requests: SubLotteryRequest[];
  availability: SubLotteryAvailability[];
  scheduleEntries: SubLotteryScheduleEntry[];
  assignments: SubLotteryAssignment[];
}

