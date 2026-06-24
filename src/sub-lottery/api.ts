import type {
  AdminImportPlayersRequest,
  AdminImportPlayersResponse,
  AdminImportScheduleRequest,
  AdminImportScheduleResponse,
  ApiResponse,
  CreateSubRequestRequest,
  CreateSubRequestResponse,
  LoadPublicStateRequest,
  LoadPublicStateResponse,
  MarkAvailabilityRequest,
  MarkAvailabilityResponse,
  RunDrawRequest,
  RunDrawResponse,
} from './apiContracts';

async function postJson<TBody, TData>(url: string, body: TBody): Promise<TData> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as ApiResponse<TData>;

  if (!payload.ok) {
    throw new Error(payload.error);
  }

  return payload.data;
}

export function loadSubLotteryState(body: LoadPublicStateRequest = {}): Promise<LoadPublicStateResponse> {
  return postJson<LoadPublicStateRequest, LoadPublicStateResponse>('/api/sub-lottery/public-state', body);
}

export function createCaptainRequest(body: CreateSubRequestRequest): Promise<CreateSubRequestResponse> {
  return postJson<CreateSubRequestRequest, CreateSubRequestResponse>('/api/sub-lottery/create-request', body);
}

export function markAvailable(body: MarkAvailabilityRequest): Promise<MarkAvailabilityResponse> {
  return postJson<MarkAvailabilityRequest, MarkAvailabilityResponse>('/api/sub-lottery/availability', body);
}

export function runDraw(body: RunDrawRequest): Promise<RunDrawResponse> {
  return postJson<RunDrawRequest, RunDrawResponse>('/api/sub-lottery/run-draw', body);
}

export function adminImportPlayers(body: AdminImportPlayersRequest): Promise<AdminImportPlayersResponse> {
  return postJson<AdminImportPlayersRequest, AdminImportPlayersResponse>('/api/sub-lottery/admin-import-players', body);
}

export function adminImportSchedule(body: AdminImportScheduleRequest): Promise<AdminImportScheduleResponse> {
  return postJson<AdminImportScheduleRequest, AdminImportScheduleResponse>('/api/sub-lottery/admin-import-schedule', body);
}
