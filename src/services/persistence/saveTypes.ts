export interface SaveTargetResult {
  attempted: boolean;
  saved: boolean;
  error?: unknown;
}

export interface SaveResult {
  type: 'cloud' | 'local' | 'error';
  local: SaveTargetResult;
  cloud: SaveTargetResult;
  error?: unknown;
}

export interface SaveConflict {
  expectedRevision?: number;
  actualRevision: number;
}

export interface WorkspaceSaveResult extends SaveResult {
  id: string;
  revision?: number;
  type: SaveResult['type'] | 'conflict';
  conflict?: SaveConflict;
}
