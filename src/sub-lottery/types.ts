export type SubLotteryPool = 'open' | 'female';

export interface SubLotteryPlayer {
  id: string;
  name: string;
  email?: string;
  pool: SubLotteryPool;
  seasonSubCount: number;
  active: boolean;
}

export interface SubLotteryScheduleEntry {
  id: string;
  seasonId?: string;
  weekLabel: string;
  gameDate?: string;
  weekStartDate?: string;
  captainName: string;
  captainEmail?: string;
  teamName: string;
  gameLabel: string;
  pool: SubLotteryPool;
  active: boolean;
}

export interface SubLotteryRequest {
  id: string;
  seasonId: string;
  weekStartDate: string;
  captainName: string;
  teamName: string;
  gameLabel: string;
  pool: SubLotteryPool;
  slotsNeeded?: number;
  status: 'open' | 'pending-confirmation' | 'assigned' | 'void';
  openedAt: string;
  closesAt: string;
  availabilityOpensAt?: string;
  availabilityClosesAt?: string;
  drawAt?: string;
  assignedPlayerId?: string;
  assignedPlayerIds?: string[];
  assignedAt?: string;
  cancelledAt?: string;
  updatedAt?: string;
  scheduleEntryId?: string;
  weekLabel?: string;
}

export interface SubLotteryAvailability {
  requestId: string;
  playerId: string;
  enteredAt: string;
  rank?: number;
}

export interface SubLotteryEntry {
  playerId: string;
  weight: number;
}

export interface SubLotteryAssignment {
  id?: string;
  requestId: string;
  playerId: string;
  seasonId?: string;
  captainName?: string;
  teamName?: string;
  gameLabel?: string;
  pool?: SubLotteryPool;
  weekLabel?: string;
  weekStartDate?: string;
  assignedAt: string;
  eligiblePlayerIds: string[];
  status?: 'pending' | 'accepted' | 'declined' | 'expired';
  responseDeadlineAt?: string;
  respondedAt?: string;
  replacementRound?: number;
  countApplied?: boolean;
  responseTokenHash?: string;
}

export interface SubLotteryDrawRecord {
  id: string;
  seasonId: string;
  weekStartDate: string;
  requestId: string;
  algorithmVersion: string;
  seedCommitment: string;
  seedReveal?: string;
  inputHash: string;
  eligiblePlayerIds: string[];
  weights: Record<string, number>;
  ranks: Record<string, number>;
  requestOrder: string[];
  excludedPlayerIds: string[];
  winnerPlayerIds: string[];
  createdAt: string;
  initiator: 'scheduled' | 'admin' | 'testing' | 'replacement';
}

export interface SubLotteryPublicReceipt {
  id: string;
  requestId: string;
  weekStartDate: string;
  algorithmVersion: string;
  seedCommitment: string;
  seedReveal?: string;
  inputHash: string;
  createdAt: string;
}

export interface SubLotteryWinnerEmailNotification {
  id: string;
  seasonId: string;
  requestId: string;
  playerId: string;
  playerName: string;
  playerEmail: string;
  kind?: 'winner' | 'captain-confirmation' | 'winner-confirmation' | 'decline' | 'replacement';
  recipientEmail?: string;
  captainEmail?: string;
  captainContact?: string;
  responseToken?: string;
  responseDeadlineAt?: string;
  test?: boolean;
  teamName?: string;
  gameLabel?: string;
  weekLabel?: string;
  captainName?: string;
  assignedAt: string;
  createdAt: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  attempts: number;
  updatedAt?: string;
  sentAt?: string;
  lastError?: string;
}

export interface SubLotteryPublicState {
  seasonId: string;
  seasonName: string;
  weekStartDate?: string;
  players: SubLotteryPlayer[];
  requests: SubLotteryRequest[];
  availability: SubLotteryAvailability[];
  scheduleEntries: SubLotteryScheduleEntry[];
  assignments: SubLotteryAssignment[];
  receipts?: SubLotteryPublicReceipt[];
}

