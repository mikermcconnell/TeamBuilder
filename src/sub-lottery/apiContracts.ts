import type { SubLotteryAssignment, SubLotteryDrawRecord, SubLotteryPool, SubLotteryPublicState, SubLotteryRequest, SubLotteryWinnerEmailNotification } from './types.js';

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface LoadPublicStateRequest {
  seasonId?: string;
}

export interface CreateSubRequestRequest {
  seasonId?: string;
  captainPin: string;
  scheduleEntryId: string;
  pool: SubLotteryPool;
  slotsNeeded: number;
}

export interface MarkAvailabilityRequest {
  requestId: string;
  playerId: string;
}

export interface RunDrawRequest {
  requestId: string;
}

export interface UpdatePreferencesRequest {
  playerId: string;
  requestIds: string[];
}

export interface UpdateSubRequestRequest {
  requestId: string;
  captainPin: string;
  pool: SubLotteryPool;
  slotsNeeded: number;
  confirmMerge?: boolean;
}

export interface RespondToAssignmentRequest {
  token: string;
  response: 'accept' | 'decline';
}

export interface AdminLoginRequest { adminPin: string }
export interface AdminSessionResponse { authenticated: boolean; expiresAt: string }
export interface AdminOperationsRequest { seasonId?: string; weekStartDate?: string }
export interface AdminReplacementRequest { assignmentId: string }
export interface AdminRetryEmailRequest { notificationId: string }
export interface AdminTestEmailRequest {
  template: 'winner' | 'captain-unfilled' | 'winner-confirmation' | 'captain-confirmation' | 'decline' | 'replacement';
}
export interface AdminOperationsResponse {
  state: SubLotteryPublicState;
  seasons: Array<Record<string, unknown> & { id: string; name?: string }>;
  weeks: string[];
  historicalRequests: SubLotteryRequest[];
  assignments: SubLotteryAssignment[];
  emails: SubLotteryWinnerEmailNotification[];
  draws: SubLotteryDrawRecord[];
  audit: Array<Record<string, unknown> & { id: string; action?: string; actor?: string; createdAt?: string }>;
  emailConfigured: boolean;
}

export interface LoadTestingWeekRequest {
  reset?: boolean;
}

export interface RunTestingDrawRequest {
  seasonId: string;
}

export interface CancelSubRequestRequest {
  requestId: string;
  captainPin: string;
}

export interface AdminImportPlayersRequest {
  seasonId?: string;
  seasonName: string;
  adminPin: string;
  csvText: string;
}

export interface AdminImportScheduleRequest {
  seasonId?: string;
  seasonName: string;
  adminPin: string;
  csvText: string;
}

export type LoadPublicStateResponse = SubLotteryPublicState;
export type CreateSubRequestResponse = SubLotteryPublicState;
export type MarkAvailabilityResponse = SubLotteryPublicState;
export type UpdatePreferencesResponse = SubLotteryPublicState;
export type UpdateSubRequestResponse = SubLotteryPublicState;
export type RunDrawResponse = SubLotteryPublicState;
export type LoadTestingWeekResponse = SubLotteryPublicState;
export type RunTestingDrawResponse = SubLotteryPublicState;
export type CancelSubRequestResponse = SubLotteryPublicState;
export type AdminImportPlayersResponse = SubLotteryPublicState;
export type AdminImportScheduleResponse = SubLotteryPublicState;
