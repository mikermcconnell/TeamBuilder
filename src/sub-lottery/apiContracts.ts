import type { SubLotteryPool, SubLotteryPublicState } from './types';

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
  captainName: string;
  teamName: string;
  gameLabel: string;
  pool: SubLotteryPool;
}

export interface MarkAvailabilityRequest {
  requestId: string;
  playerId: string;
}

export interface RunDrawRequest {
  requestId: string;
}

export interface AdminImportPlayersRequest {
  seasonId?: string;
  seasonName: string;
  adminPin: string;
  csvText: string;
}

export type LoadPublicStateResponse = SubLotteryPublicState;
export type CreateSubRequestResponse = SubLotteryPublicState;
export type MarkAvailabilityResponse = SubLotteryPublicState;
export type RunDrawResponse = SubLotteryPublicState;
export type AdminImportPlayersResponse = SubLotteryPublicState;
