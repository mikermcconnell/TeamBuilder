export type SubLotteryPool = 'open' | 'female';

export interface SubLotteryPlayer {
  id: string;
  name: string;
  pool: SubLotteryPool;
  seasonSubCount: number;
  active: boolean;
}

export interface SubLotteryRequest {
  id: string;
  seasonId: string;
  captainName: string;
  teamName: string;
  gameLabel: string;
  pool: SubLotteryPool;
  status: 'open' | 'assigned' | 'void';
  openedAt: string;
  closesAt: string;
  assignedPlayerId?: string;
  assignedAt?: string;
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
  assignedAt: string;
  eligiblePlayerIds: string[];
}

export interface SubLotteryPublicState {
  seasonId: string;
  seasonName: string;
  players: SubLotteryPlayer[];
  requests: SubLotteryRequest[];
  availability: SubLotteryAvailability[];
}
