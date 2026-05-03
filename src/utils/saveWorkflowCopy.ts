export function buildRestoreBackupConfirmMessage(projectName: string): string {
  return `Restore "${projectName}" from backup? This will replace the project currently open on screen. Download a backup first if you want to preserve your current roster, teams, and scenarios.`;
}

export function buildProjectDeleteConfirmMessage(projectName: string): string {
  return `Delete saved project "${projectName}"? This cannot be undone. Download a backup first if you may need this roster, teams, or scenarios later.`;
}

export function buildScenarioDeleteConfirmMessage(scenarioName: string, isLastScenario: boolean): string {
  if (isLastScenario) {
    return `Delete the last team scenario "${scenarioName}"? This removes the final scenario and closes the team workspace. Your saved project and roster remain. Download a backup first if you want a safety copy.`;
  }

  return `Delete scenario "${scenarioName}"? This removes only this team scenario. Your saved project and roster remain. Download a backup first if you want a safety copy.`;
}

export function buildScenarioStartOverConfirmMessage(): string {
  return 'Delete all team scenarios and start over? Your roster and saved project remain. Download a backup first if you want a safety copy of these scenarios.';
}
