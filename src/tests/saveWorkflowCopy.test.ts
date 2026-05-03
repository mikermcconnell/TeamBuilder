import { describe, expect, it } from 'vitest';

import {
  buildProjectDeleteConfirmMessage,
  buildRestoreBackupConfirmMessage,
  buildScenarioDeleteConfirmMessage,
  buildScenarioStartOverConfirmMessage,
} from '@/utils/saveWorkflowCopy';

describe('save workflow safety copy', () => {
  it('warns users to download a backup before replacing the current screen', () => {
    expect(buildRestoreBackupConfirmMessage('Spring League 2026')).toContain('Download a backup first');
    expect(buildRestoreBackupConfirmMessage('Spring League 2026')).toContain('replace the project currently open on screen');
  });

  it('explains that deleting a scenario keeps the saved project and roster', () => {
    expect(buildScenarioDeleteConfirmMessage('Manual 2', false)).toBe(
      'Delete scenario "Manual 2"? This removes only this team scenario. Your saved project and roster remain. Download a backup first if you want a safety copy.'
    );
  });

  it('uses stronger copy when deleting the last scenario', () => {
    expect(buildScenarioDeleteConfirmMessage('Manual 1', true)).toContain('last team scenario');
    expect(buildScenarioDeleteConfirmMessage('Manual 1', true)).toContain('Your saved project and roster remain');
  });

  it('warns before deleting all scenarios or a saved project', () => {
    expect(buildScenarioStartOverConfirmMessage()).toContain('Delete all team scenarios');
    expect(buildScenarioStartOverConfirmMessage()).toContain('Download a backup first');
    expect(buildProjectDeleteConfirmMessage('Spring League 2026')).toContain('cannot be undone');
    expect(buildProjectDeleteConfirmMessage('Spring League 2026')).toContain('Download a backup first');
  });
});
