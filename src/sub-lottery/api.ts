import type {
  AdminImportPlayersRequest,
  AdminImportPlayersResponse,
  AdminImportScheduleRequest,
  AdminImportScheduleResponse,
  ApiResponse,
  CancelSubRequestRequest,
  CancelSubRequestResponse,
  CreateSubRequestRequest,
  CreateSubRequestResponse,
  LoadPublicStateRequest,
  LoadPublicStateResponse,
  LoadTestingWeekRequest,
  LoadTestingWeekResponse,
  MarkAvailabilityRequest,
  MarkAvailabilityResponse,
  RunDrawRequest,
  RunDrawResponse,
  RunTestingDrawRequest,
  RunTestingDrawResponse,
  UpdatePreferencesRequest,
  UpdatePreferencesResponse,
  UpdateSubRequestRequest,
  UpdateSubRequestResponse,
  RespondToAssignmentRequest,
  AdminOperationsResponse,
  AccessStatusRequest,
  RequestAccessCodeRequest,
  VerifyAccessCodeRequest,
} from './apiContracts';

async function postJson<TBody, TData>(url: string, body: TBody): Promise<TData> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  if (!responseText.trim()) {
    throw new Error(`Sub lottery request failed. The server returned no response (${response.status}). Please refresh and try again.`);
  }

  let payload: ApiResponse<TData>;
  try {
    payload = JSON.parse(responseText) as ApiResponse<TData>;
  } catch {
    throw new Error(`Sub lottery request failed. The server returned an unreadable response (${response.status}). Please refresh and try again.`);
  }

  if (!payload.ok) {
    throw new Error(payload.error);
  }

  return payload.data;
}

export function loadSubLotteryState(body: LoadPublicStateRequest = {}): Promise<LoadPublicStateResponse> {
  return postJson<LoadPublicStateRequest, LoadPublicStateResponse>('/api/sub-lottery/public-state', body);
}

export function requestAccessCode(body: RequestAccessCodeRequest): Promise<{ sent: true }> {
  return postJson('/api/sub-lottery/request-access-code', body);
}

export function verifyAccessCode(body: VerifyAccessCodeRequest): Promise<{ verified: true }> {
  return postJson('/api/sub-lottery/verify-access-code', body);
}

export function loadAccessStatus(body: AccessStatusRequest): Promise<{ verified: boolean }> {
  return postJson('/api/sub-lottery/access-status', body);
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

export function loadTestingWeek(body: LoadTestingWeekRequest = {}): Promise<LoadTestingWeekResponse> {
  return postJson<LoadTestingWeekRequest, LoadTestingWeekResponse>('/api/sub-lottery/testing-state', body);
}

export function runTestingDraw(body: RunTestingDrawRequest): Promise<RunTestingDrawResponse> {
  return postJson<RunTestingDrawRequest, RunTestingDrawResponse>('/api/sub-lottery/testing-run-draw', body);
}

export function cancelCaptainRequest(body: CancelSubRequestRequest): Promise<CancelSubRequestResponse> {
  return postJson<CancelSubRequestRequest, CancelSubRequestResponse>('/api/sub-lottery/cancel-request', body);
}

export function adminImportPlayers(body: AdminImportPlayersRequest): Promise<AdminImportPlayersResponse> {
  return postJson<AdminImportPlayersRequest, AdminImportPlayersResponse>('/api/sub-lottery/admin-import-players', body);
}

export function adminImportSchedule(body: AdminImportScheduleRequest): Promise<AdminImportScheduleResponse> {
  return postJson<AdminImportScheduleRequest, AdminImportScheduleResponse>('/api/sub-lottery/admin-import-schedule', body);
}

export function updatePreferences(body: UpdatePreferencesRequest): Promise<UpdatePreferencesResponse> { return postJson('/api/sub-lottery/preferences', body); }
export function updateCaptainRequest(body: UpdateSubRequestRequest): Promise<UpdateSubRequestResponse> { return postJson('/api/sub-lottery/update-request', body); }
export function respondToSelection(body: RespondToAssignmentRequest): Promise<{ status: string; message: string }> { return postJson('/api/sub-lottery/respond', body); }
export function adminLogin(adminPin: string): Promise<{ authenticated: boolean; expiresAt: string }> { return postJson('/api/sub-lottery/admin-login', { adminPin }); }
export function loadAdminOperations(seasonId?: string): Promise<AdminOperationsResponse> { return postJson('/api/sub-lottery/admin-operations', { seasonId }); }
export function adminRunReplacement(assignmentId: string): Promise<void> { return postJson('/api/sub-lottery/admin-replacement', { assignmentId }); }
export function adminRetryEmail(notificationId: string): Promise<void> { return postJson('/api/sub-lottery/admin-retry-email', { notificationId }); }
export function adminSendTestEmail(template: string): Promise<{ to: string }> { return postJson('/api/sub-lottery/admin-test-email', { template }); }
