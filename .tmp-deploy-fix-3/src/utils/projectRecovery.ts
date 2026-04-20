import { AppState } from '@/types';
import { validateAppState } from '@/utils/validation';

export interface ProjectBackupFile {
  format: 'team-builder-project-backup';
  version: 1;
  exportedAt: string;
  project: {
    name: string;
    description: string;
    sourceWorkspaceId: string | null;
  };
  data: AppState;
}

interface ProjectExportMetadata {
  currentWorkspaceId: string | null;
  workspaceName: string;
  workspaceDescription: string;
}

export function createProjectBackup(
  appState: AppState,
  metadata: ProjectExportMetadata
): ProjectBackupFile {
  return {
    format: 'team-builder-project-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    project: {
      name: metadata.workspaceName.trim() || 'Recovered Project',
      description: metadata.workspaceDescription.trim(),
      sourceWorkspaceId: metadata.currentWorkspaceId,
    },
    data: appState,
  };
}

export function serializeProjectBackup(
  appState: AppState,
  metadata: ProjectExportMetadata
): string {
  return JSON.stringify(createProjectBackup(appState, metadata), null, 2);
}

export function parseProjectBackup(jsonString: string): ProjectBackupFile {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('This backup file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('This backup file is empty or malformed.');
  }

  const backup = parsed as Partial<ProjectBackupFile>;

  if (backup.format !== 'team-builder-project-backup' || backup.version !== 1 || !backup.data) {
    throw new Error('This file is not a supported TeamBuilder project backup.');
  }

  if (!validateAppState(backup.data)) {
    throw new Error('This backup file does not contain a valid project state.');
  }

  return {
    format: 'team-builder-project-backup',
    version: 1,
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : new Date().toISOString(),
    project: {
      name: backup.project?.name?.trim() || 'Recovered Project',
      description: backup.project?.description?.trim() || '',
      sourceWorkspaceId: backup.project?.sourceWorkspaceId ?? null,
    },
    data: backup.data,
  };
}

export function getProjectBackupFilename(workspaceName: string): string {
  const safeName = (workspaceName.trim() || 'team-builder-project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const dateStamp = new Date().toISOString().split('T')[0];
  return `${safeName || 'team-builder-project'}-${dateStamp}.json`;
}
