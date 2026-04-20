import React, { useState, useCallback, useEffect, useRef, ChangeEvent, useMemo } from 'react';


import { AppState, getEffectiveSkillRating } from '@/types';
import { getDefaultConfig, getRosterFeasibilityWarnings, validateConfig } from '@/utils/configManager';
import { getProjectBackupFilename, parseProjectBackup, serializeProjectBackup } from '@/utils/projectRecovery';
import { validateGroupsForGeneration } from '@/utils/playerGrouping';
import { serializePlayersToCSV } from '@/utils/csvProcessor';
import { mergeWorkspaceStateForConflict } from '@/services/persistence/workspaceMerge';
import {
  applyTeamIterationToState,
  createAiTeamIteration,
  createCopiedTeamIteration,
  createManualTeamIteration,
  createPendingTeamIteration,
  syncActiveTeamIterationToState,
} from '@/utils/teamIterations';

import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAppPersistence } from '@/hooks/useAppPersistence';
import { useTeamBuilderActions } from '@/hooks/useTeamBuilderActions';
import { ProjectWorkspaceControls } from '@/components/ProjectWorkspaceControls';

// Removed legacy imports
// Removed rosterService imports
import { CSVUploader } from '@/components/CSVUploader';
import { ConfigurationPanel } from '@/components/ConfigurationPanel';
import { PlayerRoster } from '@/components/PlayerRoster';
import { FullScreenTeamBuilder } from '@/components/FullScreenTeamBuilder';
import { ExportPanel } from '@/components/ExportPanel';
import { PlayerGroups } from '@/components/PlayerGroups';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, BarChart3, Users, LayoutGrid, ArrowRight, FileText, ArrowLeft, AlertTriangle, FolderOpen, Sparkles, SquarePen } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorBoundary } from 'react-error-boundary';
import { Analytics } from '@vercel/analytics/react';
import { flushSync } from 'react-dom';


// Import test runner for development
if (import.meta.env.DEV) {
  import('@/utils/firebaseTestRunner');
}

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-blue-50 to-green-50">
      <div className="max-w-md w-full space-y-4 p-6 bg-white/90 backdrop-blur-xl rounded-lg shadow-xl border border-red-200">
        <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Oops! Something went wrong
        </h2>
        <pre className="text-sm bg-red-50 p-4 rounded overflow-auto text-red-700 border border-red-200">{error.message}</pre>
        <Button onClick={resetErrorBoundary} className="bg-primary hover:bg-primary/90 text-white font-semibold">
          🔄 Try again
        </Button>
      </div>
    </div>
  );
}

function getAiIterationBanner(iteration?: AppState['teamIterations'][number] | null) {
  if (!iteration || iteration.type !== 'ai' || iteration.status !== 'ready') {
    return null;
  }

  const responseIds = iteration.aiResponseIds?.length
    ? iteration.aiResponseIds
    : iteration.aiResponseId
      ? [iteration.aiResponseId]
      : [];
  const executionDetails = [
    iteration.aiModel ? `Model used: ${iteration.aiModel}` : null,
    responseIds.length > 1
      ? `Response IDs: ${responseIds.join(', ')}`
      : responseIds[0]
        ? `Response ID: ${responseIds[0]}`
        : null,
  ].filter(Boolean).join('\n');

  if (iteration.generationSource === 'fallback') {
    return {
      tone: 'success' as const,
      title: 'AI draft completed',
      message: [
        iteration.errorMessage || 'This draft was finalized with TeamBuilder balancing and is ready to use.',
        executionDetails,
      ].filter(Boolean).join('\n\n'),
    };
  }

  return {
    tone: 'success' as const,
    title: 'This tab was built by AI',
    message: [
      iteration.errorMessage || 'The AI finished this draft and handed it back ready to use.',
      executionDetails,
    ].filter(Boolean).join('\n\n'),
  };
}

function App() {
  // Auth state from Context
  const { user, signOut } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  // Workspace state from Context
  const {
    currentWorkspaceId,
    workspaceName,
    workspaceDescription,
    savedWorkspaces,
    isSaving: isSavingWorkspace,
    isLoading: isFetchingWorkspaces,
    lastWorkspaceConflict,
    saveWorkspace,
    loadWorkspace,
    getWorkspaceSnapshot,
    deleteWorkspace,
    setCurrentWorkspaceInfo,
    clearWorkspaceConflict,
  } = useWorkspace();

  const [isFullScreenMode, setIsFullScreenMode] = useState(false);

  const [appState, setAppState] = useState<AppState>(() => {
    // Default state - will be overridden by useEffect load
    return {
      players: [],
      teams: [],
      unassignedPlayers: [],
      playerGroups: [],
      config: getDefaultConfig(),
      execRatingHistory: {},
      savedConfigs: [],
      teamIterations: [],
      activeTeamIterationId: null,
      leagueMemory: [],
    };
  });



  // Undo History
  const [history, setHistory] = useState<AppState[]>([]);
  const appStateRef = useRef(appState);

  const addToHistory = useCallback((currentState: AppState) => {
    setHistory(prev => {
      // Keep last 50 states
      const newHistory = [...prev, currentState];
      if (newHistory.length > 50) return newHistory.slice(newHistory.length - 50);
      return newHistory;
    });
  }, []);

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  const snapshotCurrentState = useCallback(() => {
    addToHistory(appStateRef.current);
  }, [addToHistory]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];

    // Ensure previousState is valid before restoring
    if (previousState) {
      setAppState(previousState);
      setHistory(prev => prev.slice(0, prev.length - 1));
      toast.success('Undo successful');
    }
  }, [history]);

  const [teamsView, setTeamsView] = useState<'landing' | 'exports'>('landing'); // UI state for teams tab

  // Workspace Dialog State (UI only)
  const [isSaveWorkspaceDialogOpen, setIsSaveWorkspaceDialogOpen] = useState(false);
  const [isLoadWorkspaceDialogOpen, setIsLoadWorkspaceDialogOpen] = useState(false);
  const [loadingWorkspaceId, setLoadingWorkspaceId] = useState<string | null>(null);
  const [workspaceSearchTerm, setWorkspaceSearchTerm] = useState('');
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isGenerateTeamsDialogOpen, setIsGenerateTeamsDialogOpen] = useState(false);

  const {
    persistenceStatus,
    applyLoadedWorkspace,
    restoreImportedState,
    syncWorkspaceSaveStatus,
    persistAppStateImmediately,
  } = useAppPersistence({
    user,
    appState,
    setAppState,
    currentWorkspaceId,
    workspaceName,
    workspaceDescription,
    saveWorkspace,
  });


  // Removed local auth effects and fetchUserWorkspaces effects as they are handled in contexts



  // Auth handlers
  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  // --- Workspace Handlers ---

  // --- Workspace Handlers (Delegated to Context) ---

  const handleOpenSaveWorkspaceDialog = useCallback(() => {
    if (!user) {
      toast.error('Please sign in to save projects');
      return;
    }
    setCurrentWorkspaceInfo(currentWorkspaceId || null, workspaceName || ('Project ' + new Date().toLocaleDateString()), workspaceDescription);
    setIsSaveWorkspaceDialogOpen(true);
  }, [user, workspaceName, workspaceDescription, setCurrentWorkspaceInfo, currentWorkspaceId]);

  const handleOpenLoadWorkspaceDialog = useCallback(() => {
    if (!user) {
      toast.error('Please sign in to load projects');
      return;
    }
    // Saved workspaces are auto-loaded by context
    setIsLoadWorkspaceDialogOpen(true);
  }, [user]);

  const handleSaveWorkspace = useCallback(async () => {
    try {
      const result = await saveWorkspace(appState, {
        id: currentWorkspaceId,
        name: workspaceName,
        description: workspaceDescription,
      });
      syncWorkspaceSaveStatus(result);
      if (result && result.type !== 'conflict' && result.type !== 'error') {
        setIsSaveWorkspaceDialogOpen(false);
      }
    } catch (e) {
      // Toast handled in context
    }
  }, [saveWorkspace, appState, currentWorkspaceId, workspaceName, workspaceDescription, syncWorkspaceSaveStatus]);

  const handleLoadWorkspace = useCallback(async (id: string) => {
    setLoadingWorkspaceId(id);
    const workspace = await loadWorkspace(id);
    if (workspace) {
      applyLoadedWorkspace(workspace);
      toast.success(`Loaded project "${workspace.name}"`);
      setIsLoadWorkspaceDialogOpen(false);
    }
    setLoadingWorkspaceId(null);
  }, [applyLoadedWorkspace, loadWorkspace]);

  const handleReloadWorkspaceAfterConflict = useCallback(async () => {
    if (!currentWorkspaceId) {
      return;
    }

    if (!window.confirm('Reload the latest cloud version? Your current unsaved changes in this tab will be replaced.')) {
      return;
    }

    await handleLoadWorkspace(currentWorkspaceId);
    clearWorkspaceConflict();
  }, [clearWorkspaceConflict, currentWorkspaceId, handleLoadWorkspace]);

  const handleSaveWorkspaceAsCopy = useCallback(async () => {
    const baseName = workspaceName.trim() || 'Recovered Project';
    const copyName = /\(copy\)$/i.test(baseName) ? baseName : `${baseName} (copy)`;
    setCurrentWorkspaceInfo(null, copyName, workspaceDescription);

    try {
      const result = await saveWorkspace(appState, {
        id: null,
        name: copyName,
        description: workspaceDescription,
      });

      syncWorkspaceSaveStatus(result);
      if (result && result.type !== 'conflict' && result.type !== 'error') {
        clearWorkspaceConflict();
      }
    } catch {
      // Toast handled in context
    }
  }, [appState, clearWorkspaceConflict, saveWorkspace, setCurrentWorkspaceInfo, syncWorkspaceSaveStatus, workspaceDescription, workspaceName]);

  const handleMergeWorkspaceAfterConflict = useCallback(async () => {
    if (!currentWorkspaceId || !lastWorkspaceConflict?.conflict?.actualRevision) {
      return;
    }

    const latestWorkspace = await getWorkspaceSnapshot(currentWorkspaceId);
    if (!latestWorkspace) {
      return;
    }

    const mergedState = mergeWorkspaceStateForConflict(latestWorkspace, appState);

    try {
      const result = await saveWorkspace(mergedState, {
        id: currentWorkspaceId,
        name: workspaceName,
        description: workspaceDescription,
        expectedRevision: latestWorkspace.revision,
      });

      syncWorkspaceSaveStatus(result);
      if (result && result.type !== 'conflict' && result.type !== 'error') {
        clearWorkspaceConflict();
        toast.success('Merged your draft with the latest saved project');
      }
    } catch {
      // Toast handled in context
    }
  }, [
    appState,
    clearWorkspaceConflict,
    currentWorkspaceId,
    getWorkspaceSnapshot,
    lastWorkspaceConflict?.conflict?.actualRevision,
    saveWorkspace,
    syncWorkspaceSaveStatus,
    workspaceDescription,
    workspaceName,
  ]);

  const handleDeleteWorkspaceAction = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    await deleteWorkspace(id);
  }, [deleteWorkspace]);

  const handleExportProjectBackup = useCallback(() => {
    const backupJson = serializeProjectBackup(appState, {
      currentWorkspaceId,
      workspaceName,
      workspaceDescription,
    });

    const blob = new Blob([backupJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = getProjectBackupFilename(workspaceName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Project backup exported');
  }, [appState, currentWorkspaceId, workspaceDescription, workspaceName]);

  const handleOpenProjectImport = useCallback(() => {
    importFileInputRef.current?.click();
  }, []);

  const handleImportProjectBackup = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const fileText = await file.text();
      const backup = parseProjectBackup(fileText);

      const confirmRestore = window.confirm(
        `Restore "${backup.project.name}" from backup? This will replace the project currently open on screen.`
      );

      if (!confirmRestore) {
        return;
      }

      restoreImportedState(backup.data);
      setCurrentWorkspaceInfo(
        null,
        backup.project.name || `Recovered ${new Date().toLocaleDateString()}`,
        backup.project.description || ''
      );
      setHistory([]);
      setActiveTab(
        (backup.data.teamIterations?.length ?? 0) > 0 || (backup.data.teams?.length ?? 0) > 0
          ? 'teams'
          : (backup.data.players?.length ?? 0) > 0
            ? 'roster'
            : 'upload'
      );
      setTeamsView('landing');
      setIsFullScreenMode(false);
      setIsSaveWorkspaceDialogOpen(false);
      setIsLoadWorkspaceDialogOpen(false);

      toast.success('Backup restored. Save it as a project when you are ready.');
    } catch (error) {
      console.error('Failed to import project backup:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to restore backup');
    }
  }, [restoreImportedState, setCurrentWorkspaceInfo]);



  const [activeTab, setActiveTab] = useState<string>('upload');

  const [, setIsManualMode] = useState(false);

  const {
    handlePlayersLoaded,
    handleConfigChange,
    handlePlayerUpdate,
    handlePlayerAdd,
    handleResolveWarning,
    handleDismissWarning,
    handleDismissAllWarnings,
    handlePlayerRemove,
    handlePlayerMove,
    handleClearExecRankings,
    handleResetExecHistory,
    handleResetTeams,
    handleTeamNameChange,
    handleTeamBrandingChange,
    handleRefreshTeamBranding,
    handleAddTeam,
    handleRemoveTeam,
    handleAddPlayerToGroup,
    handleRemovePlayerFromGroup,
    handleCreateNewGroup,
    handleDeleteGroup,
    handleMergeGroups,
  } = useTeamBuilderActions({
    appState,
    setAppState,
    snapshotCurrentState,
    persistAppStateImmediately,
    setActiveTab,
    setIsManualMode,
    setIsFullScreenMode,
    setCurrentWorkspaceInfo,
  });

  const handleRosterCsvLoaded = useCallback((
    players: Parameters<typeof handlePlayersLoaded>[0],
    playerGroups?: Parameters<typeof handlePlayersLoaded>[1],
    warnings?: Parameters<typeof handlePlayersLoaded>[2],
    metadata?: Parameters<typeof handlePlayersLoaded>[3]
  ) => {
    setHistory([]);
    handlePlayersLoaded(players, playerGroups, warnings, metadata);
  }, [handlePlayersLoaded]);

  const teamIterations = useMemo(() => appState.teamIterations ?? [], [appState.teamIterations]);
  const leagueMemory = useMemo(() => appState.leagueMemory ?? [], [appState.leagueMemory]);
  const activeIteration = teamIterations.find(iteration => iteration.id === appState.activeTeamIterationId) ?? null;
  const workspaceTeams = activeIteration?.teams ?? appState.teams;
  const workspaceUnassignedPlayers = activeIteration?.unassignedPlayers ?? appState.unassignedPlayers;
  const workspaceStats = activeIteration?.stats ?? appState.stats;
  const execHistoryCount = Object.keys(appState.execRatingHistory || {}).length;
  const currentRosterCsvContent = useMemo(
    () => appState.players.length > 0 ? serializePlayersToCSV(appState.players) : '',
    [appState.players]
  );

  const getNextIterationName = useCallback((type: 'manual' | 'ai') => {
    const prefix = type === 'manual' ? 'Manual' : 'AI';
    const highestNumber = teamIterations.reduce((max, iteration) => {
      if (iteration.type !== type) {
        return max;
      }

      const match = iteration.name.match(/(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);

    return `${prefix} ${highestNumber + 1}`;
  }, [teamIterations]);

  const selectIteration = useCallback((iterationId: string) => {
    flushSync(() => {
      setAppState(prev => applyTeamIterationToState(prev, iterationId));
    });
    setTeamsView('landing');
  }, []);

  const validateGenerationSetup = useCallback(async () => {
    if (appState.players.length === 0) {
      toast.error('Please upload players first');
      return false;
    }

    const configErrors = validateConfig(appState.config, appState.players.length);
    if (configErrors.length > 0) {
      configErrors.forEach(error => {
        toast.error(error, { duration: 5000 });
      });
      return false;
    }

    const rosterFeasibilityWarnings = getRosterFeasibilityWarnings(appState.players, appState.config);
    rosterFeasibilityWarnings.forEach(warning => {
      toast.warning(warning, { duration: 5000 });
    });

    const validation = validateGroupsForGeneration(appState.playerGroups, appState.config);

    if (!validation.valid) {
      validation.errors.forEach(error => {
        toast.error(error, { duration: 5000 });
      });
      return false;
    }

    validation.warnings.forEach(warning => {
      toast.warning(warning, { duration: 4000 });
    });

    return true;
  }, [appState.config, appState.playerGroups, appState.players]);

  const buildAiIterationInBackground = useCallback(async (
    iterationId: string,
    iterationName: string,
    variant: 'primary' | 'alternate',
    snapshot: {
      players: AppState['players'];
      config: AppState['config'];
      playerGroups: AppState['playerGroups'];
    },
    successMessage?: string
  ) => {
    try {
      await new Promise(resolve => window.setTimeout(resolve, 150));

      const builtIteration = await createAiTeamIteration(
        snapshot.players,
        snapshot.config,
        snapshot.playerGroups,
        iterationName,
        variant
      );

      let iterationWasUpdated = false;
      setAppState(prev => {
        if (!(prev.teamIterations ?? []).some(iteration => iteration.id === iterationId)) {
          return prev;
        }

        iterationWasUpdated = true;
        const updatedIterations = (prev.teamIterations ?? []).map(iteration => (
          iteration.id === iterationId
            ? {
              ...builtIteration,
              id: iterationId,
              createdAt: iteration.createdAt,
            }
            : iteration
        ));

        const nextState = {
          ...prev,
          teamIterations: updatedIterations,
        };

        return prev.activeTeamIterationId === iterationId
          ? applyTeamIterationToState(nextState, iterationId)
          : nextState;
      });

      if (iterationWasUpdated) {
        if (builtIteration.generationSource === 'fallback') {
          toast.warning(`${iterationName} is ready. The AI draft did not pass validation, so TeamBuilder switched to its built-in balancing method.`);
        } else if (successMessage) {
          toast.success(successMessage);
        }
      }
    } catch (error) {
      console.error('AI iteration generation failed:', error);

      let iterationWasUpdated = false;
      setAppState(prev => {
        if (!(prev.teamIterations ?? []).some(iteration => iteration.id === iterationId)) {
          return prev;
        }

        iterationWasUpdated = true;
        const updatedIterations = (prev.teamIterations ?? []).map(iteration => (
          iteration.id === iterationId
            ? {
              ...iteration,
              status: 'failed',
              errorMessage: 'Unable to generate this AI option.',
            }
            : iteration
        ));

        const nextState = {
          ...prev,
          teamIterations: updatedIterations,
        };

        return prev.activeTeamIterationId === iterationId
          ? applyTeamIterationToState(nextState, iterationId)
          : nextState;
      });

      if (iterationWasUpdated) {
        toast.error(`Could not generate ${iterationName}. Please try again.`);
      }
    }
  }, []);

  const handleOpenGenerateTeamsDialog = useCallback(() => {
    if (appState.players.length === 0) {
      toast.error('Please upload players first');
      return;
    }

    setIsGenerateTeamsDialogOpen(true);
  }, [appState.players.length]);

  const handleCreateManualIterations = useCallback(async () => {
    if (!(await validateGenerationSetup())) {
      return;
    }

    snapshotCurrentState();

    const manualOne = createManualTeamIteration(appState.players, appState.config, appState.playerGroups, 'Manual 1');
    const manualTwo = createManualTeamIteration(appState.players, appState.config, appState.playerGroups, 'Manual 2');

    setAppState(prev => applyTeamIterationToState({
      ...prev,
      teamIterations: [manualOne, manualTwo],
      activeTeamIterationId: manualOne.id,
    }, manualOne.id));

    setActiveTab('teams');
    setTeamsView('landing');
    setIsFullScreenMode(true);
    setIsGenerateTeamsDialogOpen(false);
    toast.success('Created two manual team tabs');
  }, [appState.config, appState.playerGroups, appState.players, snapshotCurrentState, validateGenerationSetup]);

  const handleCreateAiIterations = useCallback(async () => {
    if (!(await validateGenerationSetup())) {
      return;
    }

    snapshotCurrentState();

    const aiOne = createPendingTeamIteration('AI 1', 'ai');
    const aiTwo = createPendingTeamIteration('AI 2', 'ai');
    const snapshot = {
      players: appState.players,
      config: appState.config,
      playerGroups: appState.playerGroups,
    };

    setAppState(prev => applyTeamIterationToState({
      ...prev,
      teamIterations: [aiOne, aiTwo],
      activeTeamIterationId: aiOne.id,
    }, aiOne.id));

    setActiveTab('teams');
    setTeamsView('landing');
    setIsFullScreenMode(true);
    setIsGenerateTeamsDialogOpen(false);

    void buildAiIterationInBackground(aiOne.id, aiOne.name, 'primary', snapshot);
    void buildAiIterationInBackground(aiTwo.id, aiTwo.name, 'alternate', snapshot, 'AI team options are ready');
  }, [appState.config, appState.playerGroups, appState.players, buildAiIterationInBackground, snapshotCurrentState, validateGenerationSetup]);

  const handleCreateBothIterations = useCallback(async () => {
    if (!(await validateGenerationSetup())) {
      return;
    }

    snapshotCurrentState();

    const manualIteration = createManualTeamIteration(appState.players, appState.config, appState.playerGroups, 'Manual 1');
    const aiIteration = createPendingTeamIteration('AI 1', 'ai');
    const snapshot = {
      players: appState.players,
      config: appState.config,
      playerGroups: appState.playerGroups,
    };

    setAppState(prev => applyTeamIterationToState({
      ...prev,
      teamIterations: [manualIteration, aiIteration],
      activeTeamIterationId: manualIteration.id,
    }, manualIteration.id));

    setActiveTab('teams');
    setTeamsView('landing');
    setIsFullScreenMode(true);
    setIsGenerateTeamsDialogOpen(false);

    void buildAiIterationInBackground(aiIteration.id, aiIteration.name, 'primary', snapshot, 'Your AI tab is ready');
  }, [appState.config, appState.playerGroups, appState.players, buildAiIterationInBackground, snapshotCurrentState, validateGenerationSetup]);

  const handleAddManualIteration = useCallback(async () => {
    if (!(await validateGenerationSetup())) {
      return;
    }

    snapshotCurrentState();

    const iterationName = getNextIterationName('manual');
    const manualIteration = createManualTeamIteration(appState.players, appState.config, appState.playerGroups, iterationName);

    setAppState(prev => applyTeamIterationToState({
      ...prev,
      teamIterations: [...(prev.teamIterations ?? []), manualIteration],
      activeTeamIterationId: manualIteration.id,
    }, manualIteration.id));

    setActiveTab('teams');
    setTeamsView('landing');
    toast.success(`Added ${iterationName}`);
  }, [appState.config, appState.playerGroups, appState.players, getNextIterationName, snapshotCurrentState, validateGenerationSetup]);

  const handleAddAiIteration = useCallback(async () => {
    if (!(await validateGenerationSetup())) {
      return;
    }

    snapshotCurrentState();

    const iterationName = getNextIterationName('ai');
    const pendingIteration = createPendingTeamIteration(iterationName, 'ai');
    const snapshot = {
      players: appState.players,
      config: appState.config,
      playerGroups: appState.playerGroups,
    };

    setAppState(prev => applyTeamIterationToState({
      ...prev,
      teamIterations: [...(prev.teamIterations ?? []), pendingIteration],
      activeTeamIterationId: pendingIteration.id,
    }, pendingIteration.id));

    setActiveTab('teams');
    setTeamsView('landing');

    void buildAiIterationInBackground(
      pendingIteration.id,
      pendingIteration.name,
      'alternate',
      snapshot,
      `${pendingIteration.name} is ready`
    );
  }, [appState.config, appState.playerGroups, appState.players, buildAiIterationInBackground, getNextIterationName, snapshotCurrentState, validateGenerationSetup]);

  const handleCopyIteration = useCallback((iterationId: string) => {
    const sourceIteration = teamIterations.find(iteration => iteration.id === iterationId);
    if (!sourceIteration) {
      toast.error('That tab could not be copied');
      return;
    }

    if (sourceIteration.status !== 'ready') {
      toast.error('Only ready tabs can be copied right now');
      return;
    }

    snapshotCurrentState();

    let copiedIterationName = '';

    setAppState(prev => {
      const iterationToCopy = (prev.teamIterations ?? []).find(iteration => iteration.id === iterationId);
      if (!iterationToCopy) {
        return prev;
      }

      const copiedIteration = createCopiedTeamIteration(iterationToCopy, prev.teamIterations ?? []);
      copiedIterationName = copiedIteration.name;

      return applyTeamIterationToState({
        ...prev,
        teamIterations: [...(prev.teamIterations ?? []), copiedIteration],
        activeTeamIterationId: copiedIteration.id,
      }, copiedIteration.id);
    });

    setActiveTab('teams');
    setTeamsView('landing');

    if (copiedIterationName) {
      toast.success(`Created ${copiedIterationName}`);
    }
  }, [snapshotCurrentState, teamIterations]);

  const handleDeleteAllIterations = useCallback(() => {
    if (!window.confirm('Delete all team tabs and start over?')) {
      return;
    }

    snapshotCurrentState();

    setAppState(prev => ({
      ...prev,
      players: prev.players.map(player => ({ ...player, teamId: undefined })),
      teams: [],
      unassignedPlayers: [],
      stats: undefined,
      teamIterations: [],
      activeTeamIterationId: null,
    }));

    setTeamsView('landing');
    setIsFullScreenMode(false);
    toast.success('Deleted all team tabs. You can generate new ones when ready.');
  }, [snapshotCurrentState]);

  // Reset full screen mode when switching away from teams tab
  useEffect(() => {
    if (activeTab !== 'teams' && isFullScreenMode) {
      setIsFullScreenMode(false);
    }
  }, [activeTab, isFullScreenMode]);

  // Recalculate team stats when switching to teams tab (in case players were edited)
  useEffect(() => {
    if (activeTab !== 'teams') {
      return;
    }

    setAppState(prev => {
      if (prev.teams.length === 0) {
        return prev;
      }

      return syncActiveTeamIterationToState({
        ...prev,
        teams: prev.teams.map(team => {
          const totalSkill = team.players.reduce((sum, p) => sum + getEffectiveSkillRating(p), 0);
          const averageSkill = team.players.length > 0 ? totalSkill / team.players.length : 0;

          const genderBreakdown = { M: 0, F: 0, Other: 0 };
          team.players.forEach(p => {
            genderBreakdown[p.gender]++;
          });

          return {
            ...team,
            averageSkill,
            genderBreakdown
          };
        })
      });
    });
  }, [activeTab, appState.players]);

  if (isFullScreenMode) {
    return (
      <FullScreenTeamBuilder
        teams={workspaceTeams}
        unassignedPlayers={workspaceUnassignedPlayers}
        onExitFullScreen={() => setIsFullScreenMode(false)}
        config={appState.config}
        players={appState.players}
        playerGroups={appState.playerGroups}
        stats={workspaceStats}
        onPlayerMove={handlePlayerMove}
        onPlayerUpdate={handlePlayerUpdate}
        onTeamNameChange={handleTeamNameChange}
        onTeamBrandingChange={handleTeamBrandingChange}
        onLoadWorkspace={handleLoadWorkspace}
        currentWorkspaceId={currentWorkspaceId}
        onReset={handleResetTeams}
        onUndo={handleUndo}
        canUndo={history.length > 0}
        onRefreshBranding={handleRefreshTeamBranding}
        onAddTeam={handleAddTeam}
        onRemoveTeam={handleRemoveTeam}
        iterations={teamIterations}
        activeIterationId={activeIteration?.id ?? null}
        onSelectIteration={selectIteration}
        onCopyIteration={handleCopyIteration}
        onAddManualIteration={handleAddManualIteration}
        onAddAiIteration={handleAddAiIteration}
        onStartOver={handleDeleteAllIterations}
        activeIterationStatus={activeIteration?.status}
        leagueMemory={leagueMemory}
      />
    );
  }

  // --- Main Render ---

  return (
    <div className="min-h-screen bg-neutral-100 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <ProjectWorkspaceControls
          user={user}
          authDialogOpen={authDialogOpen}
          onAuthDialogOpenChange={setAuthDialogOpen}
          onSignOut={handleSignOut}
          persistenceStatus={persistenceStatus}
          importFileInputRef={importFileInputRef}
          onImportProjectBackup={handleImportProjectBackup}
          onExportProjectBackup={handleExportProjectBackup}
          onOpenProjectImport={handleOpenProjectImport}
          onOpenSaveWorkspaceDialog={handleOpenSaveWorkspaceDialog}
          onOpenLoadWorkspaceDialog={handleOpenLoadWorkspaceDialog}
          isSaveWorkspaceDialogOpen={isSaveWorkspaceDialogOpen}
          onSaveWorkspaceDialogOpenChange={setIsSaveWorkspaceDialogOpen}
          isLoadWorkspaceDialogOpen={isLoadWorkspaceDialogOpen}
          onLoadWorkspaceDialogOpenChange={setIsLoadWorkspaceDialogOpen}
          workspaceName={workspaceName}
          workspaceDescription={workspaceDescription}
          currentWorkspaceId={currentWorkspaceId}
          setCurrentWorkspaceInfo={setCurrentWorkspaceInfo}
          isSavingWorkspace={isSavingWorkspace}
          onSaveWorkspace={handleSaveWorkspace}
          workspaceConflict={lastWorkspaceConflict}
          onReloadWorkspaceAfterConflict={handleReloadWorkspaceAfterConflict}
          onMergeWorkspaceAfterConflict={handleMergeWorkspaceAfterConflict}
          onSaveWorkspaceAsCopy={handleSaveWorkspaceAsCopy}
          onDismissWorkspaceConflict={clearWorkspaceConflict}
          workspaceSearchTerm={workspaceSearchTerm}
          onWorkspaceSearchTermChange={setWorkspaceSearchTerm}
          isFetchingWorkspaces={isFetchingWorkspaces}
          savedWorkspaces={savedWorkspaces}
          loadingWorkspaceId={loadingWorkspaceId}
          onLoadWorkspace={handleLoadWorkspace}
          onDeleteWorkspaceAction={handleDeleteWorkspaceAction}
        />

        {/* Main Content Area */}
        {/* Main Content Area */}
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">



          {/* Right Column: Workspace */}
          <div className="space-y-6">

            {/* Tabs Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-slate-200/50 p-1 rounded-2xl w-full flex mb-6">
                <TabsTrigger
                  value="upload"
                  className="flex-1 rounded-xl py-3 font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                >
                  Data Source
                </TabsTrigger>
                <TabsTrigger
                  value="config"
                  className="flex-1 rounded-xl py-3 font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                >
                  League Config
                </TabsTrigger>
                <TabsTrigger
                  value="roster"
                  className="flex-1 rounded-xl py-3 font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                >
                  Player Roster
                  {appState.players.length > 0 && (
                    <span className="ml-2 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                      {appState.players.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="teams"
                  className="flex-1 rounded-xl py-3 font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                >
                  Teams
                  {teamIterations.length > 0 && (
                    <span className="ml-2 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                      {teamIterations.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="config" className="space-y-6 focus-visible:outline-none">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-8 border-b border-slate-100">
                    <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                      <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      League Configuration
                    </h2>
                    <p className="text-slate-500 mt-2 ml-14">Adjust team settings and balancing rules.</p>
                  </div>
                  <div className="p-8">
                    <ErrorBoundary FallbackComponent={ErrorFallback}>
                      <ConfigurationPanel
                        config={appState.config}
                        onConfigChange={handleConfigChange}
                        playerCount={appState.players.length}
                        players={appState.players}
                      />
                    </ErrorBoundary>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="upload" className="space-y-6 focus-visible:outline-none">
                <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center shadow-sm">
                  <div className="max-w-xl mx-auto space-y-6">
                    <div className="h-20 w-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-500 mb-4">
                      <FileSpreadsheet className="h-10 w-10" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-800">Upload Your Roster</h2>
                    <p className="text-slate-500 text-lg">
                      Drag and drop your CSV file here, or paste your data directly. We'll handle the parsing and validation.
                    </p>

                    <div id="csv-upload-trigger">
                      <CSVUploader
                        config={appState.config}
                        onPlayersLoaded={handleRosterCsvLoaded}
                        onNavigateToRoster={() => setActiveTab('roster')}
                        currentRosterCsvContent={currentRosterCsvContent}
                        currentRosterPlayerCount={appState.players.length}
                      />
                    </div>

                    <div className="pt-8 border-t border-slate-100 mt-8">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Or load a saved project</h3>

                      {!user ? (
                        <div className="p-4 bg-slate-50 rounded-xl text-slate-500">
                          Sign in to see your saved projects
                        </div>
                      ) : savedWorkspaces.length === 0 ? (
                        <div className="p-4 bg-slate-50 rounded-xl text-slate-500">
                          No saved projects found
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {savedWorkspaces.slice(0, 4).map(ws => (
                            <button
                              key={ws.id}
                              onClick={() => handleLoadWorkspace(ws.id)}
                              className="flex items-center p-3 bg-white border-2 border-slate-100 hover:border-primary/50 hover:bg-primary/5 rounded-xl transition-all group"
                            >
                              <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-primary transition-colors">
                                <FolderOpen className="h-5 w-5" />
                              </div>
                              <div className="ml-3 text-left overflow-hidden">
                                <div className="font-bold text-slate-700 truncate">{ws.name}</div>
                                <div className="text-xs text-slate-400">{new Date(ws.updatedAt).toLocaleDateString()}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="roster" className="space-y-6 focus-visible:outline-none">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px]">
                  <ErrorBoundary FallbackComponent={ErrorFallback}>
                    <PlayerRoster
                      players={appState.players}
                      onPlayerUpdate={handlePlayerUpdate}
                      onPlayerRemove={handlePlayerRemove}
                      onPlayerAdd={handlePlayerAdd}
                      onClearExecRankings={handleClearExecRankings}
                      onResetExecHistory={handleResetExecHistory}
                      execHistoryCount={execHistoryCount}
                      pendingWarnings={appState.pendingWarnings}
                      onResolveWarning={handleResolveWarning}
                      onDismissWarning={handleDismissWarning}
                      onDismissAllWarnings={handleDismissAllWarnings}
                    />
                  </ErrorBoundary>
                </div>

                {appState.playerGroups.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-extrabold text-slate-700 mb-4">Player Groups</h3>
                    <PlayerGroups
                      config={appState.config}
                      playerGroups={appState.playerGroups}
                      players={appState.players}
                      onAddPlayerToGroup={handleAddPlayerToGroup}
                      onRemovePlayerFromGroup={handleRemovePlayerFromGroup}
                      onCreateNewGroup={handleCreateNewGroup}
                      onDeleteGroup={handleDeleteGroup}
                      onMergeGroups={handleMergeGroups}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="teams" className="space-y-6 focus-visible:outline-none">
                {teamIterations.length === 0 ? (
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-200">
                      <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300 mb-6">
                        <Users className="h-10 w-10" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-700 mb-2">No Team Tabs Yet</h3>
                      <p className="text-slate-500 mb-8 max-w-md mx-auto">
                        Choose whether you want a manual workspace, AI-built options, or both.
                      </p>
                      <Button
                        onClick={handleOpenGenerateTeamsDialog}
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-white border-b-4 border-primary-shadow active:border-b-0 rounded-xl font-bold px-8 h-14 text-lg transition-all active:translate-y-1"
                      >
                        Generate Team Tabs
                      </Button>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="text-sm font-bold text-slate-800">1. Review the roster</div>
                        <p className="mt-2 text-sm text-slate-500">Check warnings, handler tags, ages, and group requests before generating.</p>
                        <Button variant="outline" className="mt-4" onClick={() => setActiveTab('roster')}>
                          Open roster
                        </Button>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="text-sm font-bold text-slate-800">2. Confirm league rules</div>
                        <p className="mt-2 text-sm text-slate-500">Set team count, gender minimums, and max team size so the generator knows the target.</p>
                        <Button variant="outline" className="mt-4" onClick={() => setActiveTab('config')}>
                          Open config
                        </Button>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="text-sm font-bold text-slate-800">3. Generate and compare</div>
                        <p className="mt-2 text-sm text-slate-500">Create manual tabs, AI tabs, or both, then compare scorecards before publishing.</p>
                        <Button className="mt-4" onClick={handleOpenGenerateTeamsDialog}>
                          Generate tabs
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {activeIteration?.status === 'generating' ? (
                      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-purple-50 text-purple-500">
                          <Sparkles className="h-10 w-10" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Building {activeIteration.name}</h3>
                        <p className="text-slate-500 max-w-md mx-auto">
                          This AI option is being prepared in the background. You can switch tabs or wait here.
                        </p>
                      </div>
                    ) : activeIteration?.status === 'failed' ? (
                      <div className="bg-white rounded-2xl p-12 text-center border border-red-200">
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-50 text-red-500">
                          <AlertTriangle className="h-10 w-10" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">This AI tab could not be generated</h3>
                        <p className="text-slate-500 max-w-md mx-auto">
                          {activeIteration.errorMessage || 'Please create a new AI iteration and try again.'}
                        </p>
                      </div>
                    ) : teamsView === 'landing' ? (
                        <div className="space-y-8 py-8">
                          {(() => {
                            const banner = getAiIterationBanner(activeIteration);
                            if (!banner) return null;

                            const bannerClasses = banner.tone === 'success'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                              : 'border-amber-200 bg-amber-50 text-amber-900';

                            return (
                              <div className={`rounded-2xl border px-5 py-4 text-sm ${bannerClasses}`}>
                                <div className="font-bold">{banner.title}</div>
                                <div className="mt-1 whitespace-pre-wrap">{banner.message}</div>
                              </div>
                            );
                          })()}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto px-4">
                          {/* Team Builder Card */}
                          <div
                            onClick={() => {
                              if (activeIteration?.id) {
                                flushSync(() => {
                                  setAppState(prev => applyTeamIterationToState(prev, activeIteration.id));
                                });
                              }
                              setIsFullScreenMode(true);
                            }}
                            className="group bg-white rounded-3xl p-8 border-2 border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 hover:-translate-y-1 transition-all cursor-pointer flex flex-col items-center text-center"
                          >
                            <div className="h-20 w-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-100 transition-colors">
                              <LayoutGrid className="h-10 w-10 text-indigo-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-3">Team Builder</h3>
                            <p className="text-slate-500 mb-8 leading-relaxed">
                              Interactive workspace to drag-and-drop players, manage unassigned pool, and balance teams visually.
                            </p>
                            <div className="mt-auto font-bold text-indigo-600 flex items-center group-hover:gap-2 transition-all">
                              ENTER WORKSPACE <ArrowRight className="h-4 w-4 ml-2" />
                            </div>
                          </div>

                          {/* Exports Card */}
                          <div
                            onClick={() => setTeamsView('exports')}
                            className="group bg-white rounded-3xl p-8 border-2 border-slate-100 shadow-sm hover:shadow-xl hover:border-green-200 hover:-translate-y-1 transition-all cursor-pointer flex flex-col items-center text-center"
                          >
                            <div className="h-20 w-20 bg-green-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-green-100 transition-colors">
                              <FileText className="h-10 w-10 text-green-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-3">Exports & Reports</h3>
                            <p className="text-slate-500 mb-8 leading-relaxed">
                              Download CSVs for spreadsheets, generate summary reports, and view detailed team statistics.
                            </p>
                            <div className="mt-auto font-bold text-green-600 flex items-center group-hover:gap-2 transition-all">
                              VIEW EXPORTS <ArrowRight className="h-4 w-4 ml-2" />
                            </div>
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <Button
                            variant="ghost"
                            onClick={() => setTeamsView('landing')}
                            className="text-slate-500 hover:text-slate-800"
                          >
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Workspace
                          </Button>
                          <h2 className="text-2xl font-extrabold text-slate-800">Exports & Reports</h2>
                        </div>

                        <ExportPanel
                          teams={workspaceTeams}
                          unassignedPlayers={workspaceUnassignedPlayers}
                          stats={workspaceStats}
                          config={appState.config}
                          playerGroups={appState.playerGroups}
                          leagueMemory={leagueMemory}
                          activeIterationName={activeIteration?.name}
                        />
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Dialog open={isGenerateTeamsDialogOpen} onOpenChange={setIsGenerateTeamsDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold text-slate-800">Generate Team Tabs</DialogTitle>
            <DialogDescription>
              Pick the kind of workspace you want to start with. You can always add more tabs later with the + button.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => void handleCreateManualIterations()}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <SquarePen className="h-6 w-6" />
              </div>
              <div className="text-lg font-bold text-slate-800">Manual Team</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Creates two blank team tabs so you can build and compare manual versions side by side.
              </p>
            </button>

            <button
              type="button"
              onClick={() => void handleCreateAiIterations()}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="text-lg font-bold text-slate-800">AI Team</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Builds two separate auto-generated team options in their own tabs.
              </p>
            </button>

            <button
              type="button"
              onClick={() => void handleCreateBothIterations()}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <LayoutGrid className="h-6 w-6" />
              </div>
              <div className="text-lg font-bold text-slate-800">Both</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Opens a manual tab right away and prepares an AI tab in the background so the user can keep working.
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Analytics />
    </div>
  );
}

export default App;
