import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  loadLocalEnv,
  resolveWorkspaceRecord,
  saveWorkspaceRecord,
} from '../src/server/workspaces/firebaseWorkspaceAccess.js';
import {
  applyGeneratedDraftsToWorkspace,
  buildWorkspaceWithGeneratedDrafts,
} from '../src/server/workspaces/workspaceDraftBuilder.js';
import type { PlayerGroup, SavedWorkspace } from '../src/types/index.js';

interface CliOptions {
  draftCount?: string | boolean;
  help?: boolean;
  'target-teams'?: string | boolean;
  'user-email'?: string | boolean;
  'user-id'?: string | boolean;
  'workspace-id'?: string | boolean;
  'workspace-name'?: string | boolean;
  write?: boolean;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2) as keyof CliOptions;
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function printUsage(): void {
  console.log(`
Usage:
  pnpm workspace:build -- --workspace-id <id> [--target-teams <count>] [--draft-count <count>] [--write]
  pnpm workspace:build -- --workspace-name "<name>" --user-email <email> [--target-teams <count>] [--draft-count <count>] [--write]

Examples:
  pnpm workspace:build -- --workspace-id workspace-123 --target-teams 3 --write
  pnpm workspace:build -- --workspace-name "Spring league 2026 133" --user-email bulequipment@gmail.com --target-teams 3 --write
`);
}

function readOptionalString(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readPositiveInteger(value: string | boolean | undefined, flagName: string): number | undefined {
  if (value === undefined || value === false) {
    return undefined;
  }

  if (value === true) {
    throw new Error(`${flagName} requires a number.`);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }

  return parsed;
}

function printDraftSummary(result: Awaited<ReturnType<typeof buildWorkspaceWithGeneratedDrafts>>): void {
  console.log(`Workspace: ${result.workspace.name} (${result.workspace.id})`);
  console.log(`Target teams: ${result.workspace.teams.length}`);
  console.log(`Active draft: ${result.activeDraft.iteration.name}`);

  result.generatedDrafts.forEach(candidate => {
    console.log(
      [
        `- ${candidate.iteration.name}`,
        `source=${candidate.iteration.generationSource ?? 'unknown'}`,
        `score=${candidate.insights.score.total}`,
        `skillSpread=${candidate.insights.skillSpread.toFixed(2)}`,
        `handlerSpread=${candidate.insights.handlerSpread}`,
        `unassigned=${candidate.iteration.unassignedPlayers.length}`,
      ].join(' | ')
    );
  });
}

function isConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('stored version')
    || error.message.includes('Workspace revision changed');
}

function serializePlayerShape(workspace: SavedWorkspace): string {
  return JSON.stringify(
    [...workspace.players]
      .map(player => ({
        id: player.id,
        gender: player.gender,
        isHandler: Boolean(player.isHandler),
        skillRating: player.skillRating,
        execSkillRating: player.execSkillRating,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}

function serializeGroupShape(groups: PlayerGroup[]): string {
  return JSON.stringify(
    [...groups]
      .map(group => ({
        id: group.id,
        playerIds: [...group.playerIds].sort(),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}

function serializeConfigShape(workspace: SavedWorkspace): string {
  const { config } = workspace;
  return JSON.stringify({
    maxTeamSize: config.maxTeamSize,
    minFemales: config.minFemales,
    minMales: config.minMales,
    targetTeams: config.targetTeams,
    allowMixedGender: config.allowMixedGender,
    restrictToEvenTeams: config.restrictToEvenTeams,
  });
}

function canRebaseGeneratedDrafts(sourceWorkspace: SavedWorkspace, latestWorkspace: SavedWorkspace): boolean {
  return serializePlayerShape(sourceWorkspace) === serializePlayerShape(latestWorkspace)
    && serializeGroupShape(sourceWorkspace.playerGroups) === serializeGroupShape(latestWorkspace.playerGroups)
    && serializeConfigShape(sourceWorkspace) === serializeConfigShape(latestWorkspace);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);

  if (options.help) {
    printUsage();
    return;
  }

  const workspaceId = readOptionalString(options['workspace-id']);
  const workspaceName = readOptionalString(options['workspace-name']);
  const userEmail = readOptionalString(options['user-email']);
  const userId = readOptionalString(options['user-id']);
  const targetTeams = readPositiveInteger(options['target-teams'], '--target-teams');
  const draftCount = readPositiveInteger(options['draft-count'], '--draft-count') ?? 1;
  const shouldWrite = Boolean(options.write);

  if (!workspaceId && !workspaceName) {
    printUsage();
    throw new Error('Provide --workspace-id or --workspace-name.');
  }

  if (!workspaceId && !userEmail && !userId) {
    printUsage();
    throw new Error('Resolving by workspace name requires --user-email or --user-id.');
  }

  await loadLocalEnv();

  const loadedRecord = await resolveWorkspaceRecord({
    workspaceId,
    workspaceName,
    userEmail,
    userId,
  });

  const buildResult = await buildWorkspaceWithGeneratedDrafts(loadedRecord.workspace, {
    draftCount,
    targetTeams,
  });

  printDraftSummary(buildResult);

  if (!shouldWrite) {
    console.log('Preview only. Re-run with --write to save these teams into Firestore.');
    return;
  }

  try {
    await saveWorkspaceRecord(buildResult.workspace, {
      expectedRevision: loadedRecord.workspace.revision,
      expectedUpdateTime: loadedRecord.updateTime,
    });
  } catch (error) {
    if (!isConflictError(error)) {
      throw error;
    }

    const latestRecord = await resolveWorkspaceRecord({
      workspaceId: loadedRecord.workspace.id,
    });

    if (!canRebaseGeneratedDrafts(loadedRecord.workspace, latestRecord.workspace)) {
      throw new Error(
        'The workspace changed while the drafts were generating. Please close the workspace or pause edits, then try again.'
      );
    }

    const rebasedResult = applyGeneratedDraftsToWorkspace(latestRecord.workspace, buildResult.generatedDrafts);
    await saveWorkspaceRecord(rebasedResult.workspace, {
      expectedRevision: latestRecord.workspace.revision,
      expectedUpdateTime: latestRecord.updateTime,
    });
  }

  console.log(`Saved workspace ${buildResult.workspace.id} to Firestore.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';

if (import.meta.url === invokedPath) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
