import React, { useState, useCallback, useEffect, useRef } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { Player, Team, LeagueConfig, AppState, PlayerGroup, getEffectiveSkillRating } from '@/types';
import { getDefaultConfig, saveDefaultConfig } from '@/utils/configManager';
import { generateBalancedTeams } from '@/utils/teamGenerator';
import { validateAndProcessCSV, generateSampleCSV } from '@/utils/csvProcessor';
import { debounce } from '@/utils/performance';
import { validateAppState, validatePlayer, validateTeamName } from '@/utils/validation';
import { dataStorageService } from '@/services/dataStorageService';
import { WorkspaceService } from '@/services/workspaceService';
import { SavedWorkspace } from '@/types';
// Removed legacy imports
// Removed rosterService imports
import { CSVUploader } from '@/components/CSVUploader';
import { ConfigurationPanel } from '@/components/ConfigurationPanel';
import { PlayerRoster } from '@/components/PlayerRoster';
import { FullScreenTeamBuilder } from '@/components/FullScreenTeamBuilder';
import { ExportPanel } from '@/components/ExportPanel';
import { PlayerGroups } from '@/components/PlayerGroups';
import TutorialLanding from '@/components/TutorialLanding';
import { AuthDialog } from '@/components/AuthDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderOpen, Users, FileSpreadsheet, BarChart3, Shuffle, UserCheck, Trash2, LayoutGrid, ArrowRight, FileText, ArrowLeft, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorBoundary } from 'react-error-boundary';
import { Analytics } from '@vercel/analytics/react';
import logoUrl from '@/assets/logo.svg';

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

const normalizeName = (name: string): string => name.trim().toLowerCase();

function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  // const [isLoadingAuth, setIsLoadingAuth] = useState(true); // Unused
  // const [isLoadingAuth, setIsLoadingAuth] = useState(true); // Unused
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [isFullScreenMode, setIsFullScreenMode] = useState(false);
  const [teamsView, setTeamsView] = useState<'landing' | 'exports'>('landing'); // State for switching between landing and exports views

  // Check if user has seen the tutorial before
  const [showTutorial, setShowTutorial] = useState(() => {
    return !localStorage.getItem('tutorialCompleted');
  });

  const [appState, setAppState] = useState<AppState>(() => {
    // Default state - will be overridden by useEffect load
    return {
      players: [],
      teams: [],
      unassignedPlayers: [],
      playerGroups: [],
      config: getDefaultConfig(),
      execRatingHistory: {},
      savedConfigs: []
    };
  });

  const [dataLoaded, setDataLoaded] = useState(false);

  // Workspace State
  const [isSaveWorkspaceDialogOpen, setIsSaveWorkspaceDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);

  const [isLoadWorkspaceDialogOpen, setIsLoadWorkspaceDialogOpen] = useState(false);
  const [savedWorkspaces, setSavedWorkspaces] = useState<SavedWorkspace[]>([]);
  const [isFetchingWorkspaces, setIsFetchingWorkspaces] = useState(false);
  const [loadingWorkspaceId, setLoadingWorkspaceId] = useState<string | null>(null);
  const [workspaceSearchTerm, setWorkspaceSearchTerm] = useState('');

  // Auto-save logic
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Debounced auto-save effect
  useEffect(() => {
    // Only auto-save if we have a current workspace loaded and a user is signed in
    if (!currentWorkspaceId || !user) {
      return;
    }

    setSaveStatus('saving');

    const debouncedSave = setTimeout(async () => {
      try {
        const payload: Omit<SavedWorkspace, 'id' | 'createdAt' | 'updatedAt'> = {
          userId: user.uid,
          name: workspaceName || 'Untitled Project',
          description: workspaceDescription || '',
          players: appState.players,
          playerGroups: appState.playerGroups,
          config: appState.config,
          teams: appState.teams,
          unassignedPlayers: appState.unassignedPlayers,
          stats: appState.stats,
          version: 1,
        };

        // We use the existing logic but just call the service directly to avoid UI flashing from the main save handler if it has other side effects
        // Or we can reuse the logic. Let's reuse the logic but carefully.
        // Actually, handleSaveWorkspace sets 'isSavingWorkspace' which might show a big spinner. We want this to be subtle.
        // So let's call the service directly here.

        await WorkspaceService.saveWorkspace(payload, currentWorkspaceId);
        setSaveStatus('saved');

        // Reset back to idle after a moment, or keep as 'saved' until next change?
        // Let's keep 'saved' visible for a bit then fade out or just stay 'saved'.
        setTimeout(() => setSaveStatus('idle'), 3000);

      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('error');
      }
    }, 3000); // 3 second delay

    return () => clearTimeout(debouncedSave);
  }, [appState, currentWorkspaceId, user, workspaceName, workspaceDescription]);


  useEffect(() => {
    if (!user) {
      setCurrentWorkspaceId(null);
      setWorkspaceName('');
      setWorkspaceDescription('');
      setSavedWorkspaces([]);
      setIsLoadWorkspaceDialogOpen(false);
      setWorkspaceSearchTerm('');
      setLoadingWorkspaceId(null);
    }
  }, [user]);

  const fetchUserWorkspaces = useCallback(async () => {
    if (!user) {
      setSavedWorkspaces([]);
      return;
    }

    setIsFetchingWorkspaces(true);
    try {
      const workspaces = await WorkspaceService.getUserWorkspaces(user.uid);
      setSavedWorkspaces(workspaces);
    } catch (error) {
      console.error('Failed to load saved workspaces:', error);
      toast.error('Failed to load saved projects');
    } finally {
      setIsFetchingWorkspaces(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchUserWorkspaces();
    }
  }, [user, fetchUserWorkspaces]);



  const handleStartApp = useCallback(() => {
    localStorage.setItem('tutorialCompleted', 'true');
    setShowTutorial(false);
  }, []);

  // Auth handlers
  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
      toast.success('Signed out - data will save locally');
    } catch (error) {
      console.error('Failed to sign out:', error);
      toast.error('Failed to sign out');
    }
  }, []);

  // Set up auth listener and load data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      dataStorageService.setUser(firebaseUser);
      // setIsLoadingAuth(false);

      // Load data when auth state changes
      try {
        const loadedState = await dataStorageService.load();
        if (loadedState) {
          // Validate the loaded state
          if (validateAppState(loadedState)) {
            // Additional validation: ensure all players are valid
            const validatedPlayers = loadedState.players
              .map(p => validatePlayer(p))
              .filter((p): p is Player => p !== null);

            const execHistory = { ...(loadedState.execRatingHistory ?? {}) };
            const migratedHistory: Record<string, { rating: number; updatedAt: number }> = {};

            // Migrate old data if necessary
            Object.entries(execHistory).forEach(([key, val]) => {
              if (typeof val === 'number') {
                migratedHistory[key] = { rating: val, updatedAt: 0 };
              } else if (val && typeof val === 'object' && 'rating' in val) {
                // @ts-ignore - we know this is likely valid from validation check
                migratedHistory[key] = val;
              }
            });

            validatedPlayers.forEach(player => {
              // Seed history from players if missing
              if (player.execSkillRating !== null) {
                const key = normalizeName(player.name);
                // Only seed if not already present (prefer history)
                if (!migratedHistory[key]) {
                  migratedHistory[key] = { rating: player.execSkillRating, updatedAt: 0 };
                }
              }
            });

            setAppState({
              ...loadedState,
              players: validatedPlayers,
              config: loadedState.config || getDefaultConfig(),
              execRatingHistory: migratedHistory
            });
          } else {
            console.warn('Invalid saved state structure');
            toast.warning('Some saved data was invalid and has been cleaned up');
          }
        } else if (localStorage.getItem('tutorialCompleted') === 'true') {
          // Load sample data if user has completed tutorial but has no saved data
          const sampleCSV = generateSampleCSV();
          const result = validateAndProcessCSV(sampleCSV);
          if (result.isValid && result.players.length > 0) {
            setAppState(prev => ({
              ...prev,
              players: result.players,
              playerGroups: result.playerGroups || []
            }));
            toast.info('Loaded sample roster to get you started!');
          }
        }

        if (firebaseUser) {
          toast.success('Signed in - data will sync to cloud');
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('Failed to load saved data');
      } finally {
        setDataLoaded(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Save state whenever it changes (after initial load)
  useEffect(() => {
    if (dataLoaded) {
      const saveData = async () => {
        try {
          await dataStorageService.save(appState);
        } catch (error) {
          console.error('Failed to save data:', error);
          setSyncStatus('error');
        }
      };

      // Debounce the save
      const timeoutId = setTimeout(saveData, 500);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [appState, dataLoaded]);




  // --- Workspace Handlers ---

  const handleOpenSaveWorkspaceDialog = useCallback(() => {
    if (!user) {
      toast.error('Please sign in to save projects');
      return;
    }

    setWorkspaceName(prev => {
      if (prev.trim()) return prev;
      return 'Project ' + new Date().toLocaleDateString();
    });
    setIsSaveWorkspaceDialogOpen(true);
  }, [user]);

  const handleOpenLoadWorkspaceDialog = useCallback(() => {
    if (!user) {
      toast.error('Please sign in to load projects');
      return;
    }
    fetchUserWorkspaces();
    setIsLoadWorkspaceDialogOpen(true);
  }, [user, fetchUserWorkspaces]);

  const handleSaveWorkspace = useCallback(async () => {
    if (!user) return;

    const trimmedName = workspaceName.trim();
    if (!trimmedName) {
      toast.error('Please enter a project name');
      return;
    }

    setIsSavingWorkspace(true);

    try {
      const payload: Omit<SavedWorkspace, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user.uid,
        name: trimmedName,
        description: workspaceDescription.trim(),
        players: appState.players,
        playerGroups: appState.playerGroups,
        config: appState.config,
        teams: appState.teams,
        unassignedPlayers: appState.unassignedPlayers,
        stats: appState.stats,
        version: 1,
        // tags: [] 
      };

      const id = await WorkspaceService.saveWorkspace(payload, currentWorkspaceId || undefined);
      setCurrentWorkspaceId(id);

      toast.success('Project saved successfully');
      setIsSaveWorkspaceDialogOpen(false);
      fetchUserWorkspaces();
    } catch (error: any) {
      console.error('Failed to save project:', error);
      toast.error('Failed to save project');
    } finally {
      setIsSavingWorkspace(false);
    }
  }, [user, workspaceName, workspaceDescription, appState, currentWorkspaceId, fetchUserWorkspaces]);

  const handleLoadWorkspace = useCallback(async (id: string) => {
    if (!user) return;

    setLoadingWorkspaceId(id);
    try {
      const workspace = await WorkspaceService.getWorkspace(id);
      if (!workspace) {
        toast.error('Project not found');
        return;
      }

      setAppState(prev => ({
        ...prev,
        players: workspace.players || [],
        playerGroups: workspace.playerGroups || [],
        config: workspace.config || getDefaultConfig(),
        teams: workspace.teams || [],
        unassignedPlayers: workspace.unassignedPlayers || [],
        stats: workspace.stats,
        // We merge history? Or just keep what we have? 
        // For now, let's assume history in current session is valuable, but maybe we should load history from workspace if we decide to save it there?
        // The SavedWorkspace type doesn't explicitly store history in my definition above efficiently, but simple AppState usually has execHistory.
        // Actually, my definition of SavedWorkspace missed 'execRatingHistory'.
        // Let's just keep current history for now, or if I add it to `SavedWorkspace` later I can load it.
      }));

      setCurrentWorkspaceId(workspace.id);
      setWorkspaceName(workspace.name);
      setWorkspaceDescription(workspace.description || '');

      toast.success(`Loaded project "${workspace.name}"`);
      setIsLoadWorkspaceDialogOpen(false);
    } catch (error) {
      console.error('Failed to load project:', error);
      toast.error('Failed to load project');
    } finally {
      setLoadingWorkspaceId(null);
    }
  }, [user]);

  const handleDeleteWorkspace = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      await WorkspaceService.deleteWorkspace(id);
      toast.success('Project deleted');
      if (currentWorkspaceId === id) {
        setCurrentWorkspaceId(null);
        setWorkspaceName('');
      }
      fetchUserWorkspaces();
    } catch (error) {
      toast.error('Failed to delete project');
    }
  }, [currentWorkspaceId, fetchUserWorkspaces]);



  const [activeTab, setActiveTab] = useState<string>('upload');





  const [isManualMode, setIsManualMode] = useState(false);

  const handlePlayersLoaded = useCallback((players: Player[], playerGroups: PlayerGroup[] = []) => {
    setAppState(prev => {
      const execRatingHistory = { ...prev.execRatingHistory };

      // Seed history with any exec ratings already stored on current players
      prev.players.forEach(existingPlayer => {
        if (existingPlayer.execSkillRating !== null) {
          const key = normalizeName(existingPlayer.name);
          if (!execRatingHistory[key]) {
            execRatingHistory[key] = { rating: existingPlayer.execSkillRating, updatedAt: 0 };
          }
        }
      });

      const now = Date.now();
      const updatedPlayers = players.map(player => {
        const nameKey = normalizeName(player.name);
        const csvExec = player.execSkillRating !== null && player.execSkillRating !== undefined
          ? player.execSkillRating
          : null;

        const historyEntry = execRatingHistory[nameKey];

        let finalExec: number | null = null;
        let isNewFromCSV = false;

        if (csvExec !== null) {
          finalExec = csvExec;
          isNewFromCSV = true;
        } else if (historyEntry) {
          finalExec = historyEntry.rating;
        }

        if (finalExec !== null && isNewFromCSV) {
          execRatingHistory[nameKey] = { rating: finalExec, updatedAt: now };
        }

        return {
          ...player,
          execSkillRating: finalExec
        };
      });

      const playersById = new Map(updatedPlayers.map(player => [player.id, player]));
      const updatedPlayerGroups = playerGroups.map(group => ({
        ...group,
        players: group.players.map(groupPlayer => playersById.get(groupPlayer.id) ?? groupPlayer)
      }));

      return {
        ...prev,
        players: updatedPlayers,
        playerGroups: updatedPlayerGroups,
        teams: [],
        unassignedPlayers: [],
        stats: undefined,
        execRatingHistory
      };
    });

    setIsManualMode(false);
    setIsFullScreenMode(false);

    if (players.length > 0) {
      setActiveTab('roster');
      const groupedPlayerCount = playerGroups.reduce((sum, group) => sum + group.players.length, 0);
      if (groupedPlayerCount > 0) {
        toast.success('Loaded ' + players.length + ' players with ' + playerGroups.length + ' groups');
      } else {
        toast.success('Loaded ' + players.length + ' players successfully');
      }
    }

    setCurrentWorkspaceId(null);
    setWorkspaceName('');
    setWorkspaceDescription('');
  }, []);



  // Auto-load sample roster if no players are loaded
  useEffect(() => {
    const autoLoadSampleRoster = async () => {
      // Only load if no players are currently loaded, tutorial is complete, and data has been loaded
      if (appState.players.length === 0 && !showTutorial && dataLoaded) {
        try {
          const response = await fetch('/sample_players.csv');
          if (response.ok) {
            const csvText = await response.text();
            const result = validateAndProcessCSV(csvText);

            if (result.isValid && result.players.length > 0) {
              handlePlayersLoaded(result.players, result.playerGroups || []);
            }
          }
        } catch (error) {
          console.log('Could not auto-load sample roster:', error);
          // Silently fail - this is just a convenience feature
        }
      }
    };

    autoLoadSampleRoster();
  }, [appState.players.length, showTutorial, dataLoaded, handlePlayersLoaded]);

  const handleConfigChange = useCallback((config: LeagueConfig) => {
    setAppState(prev => ({ ...prev, config }));
    saveDefaultConfig(config);
  }, []);

  const handleGenerateTeams = useCallback(async (randomize: boolean = false, manualMode: boolean = false) => {
    if (appState.players.length === 0) {
      toast.error('Please upload players first');
      return;
    }

    setIsManualMode(manualMode); // Track manual mode state

    try {
      // Add a small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = generateBalancedTeams(appState.players, appState.config, appState.playerGroups, randomize, manualMode);

      setAppState(prev => ({
        ...prev,
        teams: result.teams,
        unassignedPlayers: result.unassignedPlayers,
        stats: result.stats
      }));

      setActiveTab('teams');

      const message = manualMode
        ? `Created ${result.teams.length} manual teams - drag players to complete setup`
        : randomize
          ? `Generated ${result.teams.length} random teams`
          : `Generated ${result.teams.length} balanced teams`;

      toast.success(message);

      if (result.unassignedPlayers.length > 0) {
        toast.warning(`${result.unassignedPlayers.length} players could not be assigned due to constraints`);
      }
    } catch (error) {
      console.error('Team generation failed:', error);
      toast.error('Failed to generate teams. Please check your configuration.');
    }
  }, [appState.players, appState.config]);

  const handlePlayerUpdate = useCallback((updatedPlayer: Player) => {
    setAppState(prev => {
      const existingPlayer = prev.players.find(p => p.id === updatedPlayer.id);
      const updatedHistory = { ...prev.execRatingHistory };

      if (existingPlayer) {
        // const oldKey = normalizeName(existingPlayer.name);
        const newKey = normalizeName(updatedPlayer.name);

        // If name changed, clean up old key? Optionally keep it in case they change back contextually
        // For now, if name changes, we treat it as a new entity usually, but let's keep it simple.

        if (updatedPlayer.execSkillRating !== null && updatedPlayer.execSkillRating !== undefined) {
          // Manual update always sets timestamp to NOW
          updatedHistory[newKey] = { rating: updatedPlayer.execSkillRating, updatedAt: Date.now() };
        }
      } else if (updatedPlayer.execSkillRating !== null && updatedPlayer.execSkillRating !== undefined) {
        updatedHistory[normalizeName(updatedPlayer.name)] = { rating: updatedPlayer.execSkillRating, updatedAt: Date.now() };
      }

      // Update player in the main players array
      const updatedPlayers = prev.players.map(p =>
        p.id === updatedPlayer.id ? updatedPlayer : p
      );

      // Update player in teams and recalculate team stats
      const updatedTeams = prev.teams.map(team => {
        const playerInTeam = team.players.find(p => p.id === updatedPlayer.id);
        if (playerInTeam) {
          // Update the player in this team
          const updatedTeamPlayers = team.players.map(p =>
            p.id === updatedPlayer.id ? updatedPlayer : p
          );

          // Calculate new team stats
          const totalSkill = updatedTeamPlayers.reduce((sum, p) => sum + getEffectiveSkillRating(p), 0);
          const averageSkill = updatedTeamPlayers.length > 0 ? totalSkill / updatedTeamPlayers.length : 0;

          const genderBreakdown = { M: 0, F: 0, Other: 0 };
          updatedTeamPlayers.forEach(p => {
            genderBreakdown[p.gender]++;
          });

          return {
            ...team,
            players: updatedTeamPlayers,
            averageSkill,
            genderBreakdown
          };
        }
        return team;
      });

      // Update player in unassigned players if present
      const updatedUnassigned = prev.unassignedPlayers.map(p =>
        p.id === updatedPlayer.id ? updatedPlayer : p
      );

      return {
        ...prev,
        players: updatedPlayers,
        teams: updatedTeams,
        unassignedPlayers: updatedUnassigned,
        execRatingHistory: updatedHistory
      };
    });
  }, []);


  const handlePlayerAdd = useCallback((newPlayer: Player) => {
    setAppState(prev => {
      const updatedHistory = { ...prev.execRatingHistory };
      if (newPlayer.execSkillRating !== null && newPlayer.execSkillRating !== undefined) {
        updatedHistory[normalizeName(newPlayer.name)] = { rating: newPlayer.execSkillRating, updatedAt: Date.now() };
      }

      return {
        ...prev,
        players: [...prev.players, newPlayer],
        // Clear teams when adding new players to force regeneration
        teams: [],
        unassignedPlayers: [],
        stats: undefined,
        execRatingHistory: updatedHistory
      };
    });
  }, []);

  const handlePlayerRemove = useCallback((playerId: string) => {
    setAppState(prev => {
      const removedPlayer = prev.players.find(p => p.id === playerId);
      if (!removedPlayer) return prev;

      // Remove from main players array
      const updatedPlayers = prev.players.filter(p => p.id !== playerId);

      // Remove from teams and recalculate team stats
      const updatedTeams = prev.teams.map(team => {
        const playerInTeam = team.players.find(p => p.id === playerId);
        if (playerInTeam) {
          const updatedTeamPlayers = team.players.filter(p => p.id !== playerId);

          // Calculate new team stats
          const totalSkill = updatedTeamPlayers.reduce((sum, p) => sum + getEffectiveSkillRating(p), 0);
          const averageSkill = updatedTeamPlayers.length > 0 ? totalSkill / updatedTeamPlayers.length : 0;

          const genderBreakdown = { M: 0, F: 0, Other: 0 };
          updatedTeamPlayers.forEach(p => {
            genderBreakdown[p.gender]++;
          });

          return {
            ...team,
            players: updatedTeamPlayers,
            averageSkill,
            genderBreakdown
          };
        }
        return team;
      });

      // Remove from unassigned players
      const updatedUnassigned = prev.unassignedPlayers.filter(p => p.id !== playerId);

      // Remove from player groups
      const updatedPlayerGroups = prev.playerGroups.map(group => ({
        ...group,
        players: group.players.filter(p => p.id !== playerId)
      })).filter(group => group.players.length > 0); // Remove empty groups

      // Clean up teammate/avoid requests that reference the removed player
      const cleanedPlayers = updatedPlayers.map(player => ({
        ...player,
        teammateRequests: player.teammateRequests.filter(name =>
          name.toLowerCase() !== removedPlayer.name.toLowerCase()
        ),
        avoidRequests: player.avoidRequests.filter(name =>
          name.toLowerCase() !== removedPlayer.name.toLowerCase()
        )
      }));

      return {
        ...prev,
        players: cleanedPlayers,
        teams: updatedTeams,
        unassignedPlayers: updatedUnassigned,
        playerGroups: updatedPlayerGroups
      };
    });
  }, []);

  const handlePlayerMove = useCallback((playerId: string, targetTeamId: string | null) => {
    setAppState(prev => {
      const updatedTeams = prev.teams.map(team => ({
        ...team,
        players: team.players.filter(p => p.id !== playerId)
      }));

      let updatedUnassigned = [...prev.unassignedPlayers];
      const player = prev.players.find(p => p.id === playerId);

      if (!player) return prev;

      // Create updated player with new teamId
      const updatedPlayer = { ...player, teamId: targetTeamId || undefined };

      if (targetTeamId) {
        const targetTeam = updatedTeams.find(t => t.id === targetTeamId);
        if (targetTeam) {
          targetTeam.players.push(updatedPlayer);
          updatedUnassigned = updatedUnassigned.filter(p => p.id !== playerId);
        }
      } else {
        if (!updatedUnassigned.find(p => p.id === playerId)) {
          updatedUnassigned.push(updatedPlayer);
        }
      }

      // Update the main players array with the new teamId
      const updatedPlayers = prev.players.map(p =>
        p.id === playerId ? updatedPlayer : p
      );

      // Recalculate team stats
      updatedTeams.forEach(team => {
        // Use execSkillRating if available, otherwise fall back to skillRating
        const totalSkill = team.players.reduce((sum, p) => {
          const skill = (p.execSkillRating !== null && p.execSkillRating !== undefined)
            ? p.execSkillRating
            : p.skillRating;
          return sum + skill;
        }, 0);
        team.averageSkill = team.players.length > 0 ? totalSkill / team.players.length : 0;
        team.genderBreakdown = { M: 0, F: 0, Other: 0 };
        team.players.forEach(p => {
          team.genderBreakdown[p.gender]++;
        });
      });

      return {
        ...prev,
        players: updatedPlayers,
        teams: updatedTeams,
        unassignedPlayers: updatedUnassigned
      };
    });
  }, [isManualMode]);

  // Create debounced team name change handler
  const debouncedTeamNameChangeRef = useRef(
    debounce((teamId: string, newName: string) => {
      setAppState(prev => ({
        ...prev,
        teams: prev.teams.map(team =>
          team.id === teamId ? { ...team, name: validateTeamName(newName) } : team
        )
      }));
    }, 300)
  );

  const handleTeamNameChange = useCallback((teamId: string, newName: string) => {
    debouncedTeamNameChangeRef.current(teamId, newName);
  }, []);

  const handleLoadTeams = useCallback((teams: Team[], unassignedPlayers: Player[], config: LeagueConfig) => {
    // Recalculate team averages using execSkillRating when loading
    const recalculatedTeams = teams.map(team => {
      const totalSkill = team.players.reduce((sum, p) => {
        const skill = (p.execSkillRating !== null && p.execSkillRating !== undefined)
          ? p.execSkillRating
          : p.skillRating;
        return sum + skill;
      }, 0);
      return {
        ...team,
        averageSkill: team.players.length > 0 ? totalSkill / team.players.length : 0
      };
    });

    setAppState(prev => ({
      ...prev,
      teams: recalculatedTeams,
      unassignedPlayers,
      config
    }));
    toast.success('Teams loaded successfully');
  }, []);

  // Player group management functions
  const handleAddPlayerToGroup = useCallback((playerId: string, groupId: string) => {
    setAppState(prev => {
      const targetGroup = prev.playerGroups.find(g => g.id === groupId);
      const player = prev.players.find(p => p.id === playerId);

      if (!targetGroup || !player || targetGroup.players.length >= 4) {
        return prev;
      }

      const updatedGroups = prev.playerGroups.map(group => {
        if (group.id === groupId) {
          return {
            ...group,
            playerIds: [...group.playerIds, playerId],
            players: [...group.players, player]
          };
        }
        return group;
      });

      const updatedPlayers = prev.players.map(p =>
        p.id === playerId ? { ...p, groupId } : p
      );

      return {
        ...prev,
        playerGroups: updatedGroups,
        players: updatedPlayers
      };
    });
  }, []);

  const handleRemovePlayerFromGroup = useCallback((playerId: string) => {
    setAppState(prev => {
      const updatedGroups = prev.playerGroups.map(group => ({
        ...group,
        playerIds: group.playerIds.filter(id => id !== playerId),
        players: group.players.filter(p => p.id !== playerId)
      })).filter(group => group.players.length > 0); // Remove empty groups

      const updatedPlayers = prev.players.map(p =>
        p.id === playerId ? { ...p, groupId: undefined } : p
      );

      return {
        ...prev,
        playerGroups: updatedGroups,
        players: updatedPlayers
      };
    });
  }, []);

  const handleCreateNewGroup = useCallback((playerIds: string[]) => {
    setAppState(prev => {
      const selectedPlayers = prev.players.filter(p => playerIds.includes(p.id));

      if (selectedPlayers.length === 0 || selectedPlayers.length > 4) {
        return prev;
      }

      // Generate next group label
      const usedLabels = prev.playerGroups.map(g => g.label);
      let nextLabel = 'A';
      for (let i = 0; i < 26; i++) {
        const label = String.fromCharCode(65 + i); // A, B, C, ...
        if (!usedLabels.includes(label)) {
          nextLabel = label;
          break;
        }
      }

      // Generate color (reuse existing color logic)
      const colors = [
        '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316',
        '#06B6D4', '#84CC16', '#EC4899', '#6B7280', '#14B8A6', '#F43F5E'
      ];
      const groupColor = colors[prev.playerGroups.length % colors.length];

      const newGroup: PlayerGroup = {
        id: `group-${Date.now()}`,
        label: nextLabel,
        color: groupColor,
        playerIds: playerIds,
        players: selectedPlayers
      };

      const updatedPlayers = prev.players.map(p =>
        playerIds.includes(p.id) ? { ...p, groupId: newGroup.id } : p
      );

      return {
        ...prev,
        playerGroups: [...prev.playerGroups, newGroup],
        players: updatedPlayers
      };
    });
  }, []);

  const handleDeleteGroup = useCallback((groupId: string) => {
    setAppState(prev => {
      const groupToDelete = prev.playerGroups.find(g => g.id === groupId);
      if (!groupToDelete) return prev;

      const updatedGroups = prev.playerGroups.filter(g => g.id !== groupId);
      const updatedPlayers = prev.players.map(p =>
        groupToDelete.playerIds.includes(p.id) ? { ...p, groupId: undefined } : p
      );

      return {
        ...prev,
        playerGroups: updatedGroups,
        players: updatedPlayers
      };
    });
  }, []);

  const handleMergeGroups = useCallback((sourceGroupId: string, targetGroupId: string) => {
    setAppState(prev => {
      const sourceGroup = prev.playerGroups.find(g => g.id === sourceGroupId);
      const targetGroup = prev.playerGroups.find(g => g.id === targetGroupId);

      if (!sourceGroup || !targetGroup) return prev;

      // Update players to be in the target group
      const updatedPlayers = prev.players.map(player => {
        if (sourceGroup.playerIds.includes(player.id)) {
          return { ...player, groupId: targetGroupId };
        }
        return player;
      });

      // Merge the players into the target group
      const updatedGroups = prev.playerGroups.map(group => {
        if (group.id === targetGroupId) {
          return {
            ...group,
            playerIds: [...group.playerIds, ...sourceGroup.playerIds],
            players: [...group.players, ...sourceGroup.players]
          };
        }
        return group;
      }).filter(group => group.id !== sourceGroupId); // Remove the source group

      return {
        ...prev,
        playerGroups: updatedGroups,
        players: updatedPlayers
      };
    });
  }, []);



  // Reset full screen mode when switching away from teams tab
  useEffect(() => {
    if (activeTab !== 'teams' && isFullScreenMode) {
      setIsFullScreenMode(false);
    }
  }, [activeTab, isFullScreenMode]);

  // Recalculate team stats when switching to teams tab (in case players were edited)
  useEffect(() => {
    if (activeTab === 'teams' && appState.teams.length > 0) {
      setAppState(prev => ({
        ...prev,
        teams: prev.teams.map(team => {
          // Recalculate team stats with current player data
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
      }));
    }
  }, [activeTab, appState.players]);

  if (isFullScreenMode) {
    return (
      <FullScreenTeamBuilder
        teams={appState.teams}
        unassignedPlayers={appState.unassignedPlayers}
        onExitFullScreen={() => setIsFullScreenMode(false)}
        config={appState.config}
        players={appState.players}
        playerGroups={appState.playerGroups}
        onPlayerMove={handlePlayerMove}
        onTeamNameChange={handleTeamNameChange}
        onTeamNameChange={handleTeamNameChange}
        onLoadWorkspace={handleLoadWorkspace}
        currentWorkspaceId={currentWorkspaceId}
      />
    );
  }

  // --- Main Render ---

  if (showTutorial) {
    return <TutorialLanding onStartApp={handleStartApp} />;
  }

  return (
    <div className="min-h-screen bg-neutral-100 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">

        {/* Header Section */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
              <img src={logoUrl} alt="TeamBuilder Logo" className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">TeamBuilder</h1>
              <p className="text-slate-500 font-medium">Create balanced teams in seconds</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sync Status */}


            {/* Auth & Save Controls */}
            {!user ? (
              <Button
                onClick={() => setAuthDialogOpen(true)}
                className="bg-white hover:bg-slate-50 text-slate-700 border-b-4 border-slate-200 active:border-b-0 rounded-xl font-bold px-6 h-12 transition-all active:translate-y-1"
              >
                Sign In
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 mr-2">
                  <Button
                    onClick={handleOpenLoadWorkspaceDialog}
                    variant="ghost"
                    className="h-10 px-3 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                  >
                    <FolderOpen className="h-4 w-4 mr-2" /> Load Project
                  </Button>
                  <Button
                    onClick={handleOpenSaveWorkspaceDialog}
                    variant="ghost"
                    className="h-10 px-3 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                  >
                    <div className="flex items-center gap-2">
                      <Save className="h-4 w-4 mr-2" />
                      <span className="hidden xl:inline">Save Project</span>
                      <span className="xl:hidden">Save</span>
                    </div>
                  </Button>

                  {/* Auto-save Status Indicator */}
                  {currentWorkspaceId && (
                    <div className="text-sm font-medium transition-colors w-24 text-right">
                      {saveStatus === 'saving' && <span className="text-slate-500 italic">Saving...</span>}
                      {saveStatus === 'saved' && <span className="text-green-600">All saved</span>}
                      {saveStatus === 'error' && <span className="text-red-500">Save failed</span>}
                    </div>
                  )}
                </div>

                <div className="bg-white px-4 h-12 flex items-center gap-3 rounded-xl border border-slate-200 shadow-sm hidden md:flex">
                  <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <UserCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Logged in as</div>
                    <div className="text-sm font-bold text-slate-800 leading-none">{user.displayName || user.email}</div>
                  </div>
                </div>

                <Button
                  onClick={handleSignOut}
                  variant="ghost"
                  className="h-12 w-12 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <Users className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
        </header>

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
                  Config
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
                  {appState.teams.length > 0 && (
                    <span className="ml-2 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                      {appState.teams.length}
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
                      Configuration
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
                      <CSVUploader onPlayersLoaded={handlePlayersLoaded} />
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
                    />
                  </ErrorBoundary>
                </div>

                {appState.playerGroups.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-extrabold text-slate-700 mb-4">Player Groups</h3>
                    <PlayerGroups
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
                {appState.teams.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-200">
                    <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300 mb-6">
                      <Users className="h-10 w-10" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">No Teams Generated Yet</h3>
                    <p className="text-slate-500 mb-8 max-w-md mx-auto">
                      Upload your roster and configure your settings to generate balanced teams instantly.
                    </p>
                    <Button
                      onClick={() => handleGenerateTeams(false)}
                      size="lg"
                      className="bg-primary hover:bg-primary/90 text-white border-b-4 border-primary-shadow active:border-b-0 rounded-xl font-bold px-8 h-14 text-lg transition-all active:translate-y-1"
                    >
                      Generate Teams Now
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {teamsView === 'landing' ? (
                      <div className="space-y-8 py-8">
                        <div className="text-center space-y-2">
                          <h2 className="text-3xl font-extrabold text-slate-800">Select Workspace</h2>
                          <p className="text-slate-500 max-w-lg mx-auto">
                            Choose between the interactive Team Builder for drag-and-drop adjustments, or view Exports & Reports.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto px-4">
                          {/* Team Builder Card */}
                          <div
                            onClick={() => setIsFullScreenMode(true)}
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

                        <div className="flex justify-center mt-8">
                          <Button
                            onClick={() => handleGenerateTeams(false)}
                            variant="outline"
                            className="border-2 border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold"
                          >
                            <Shuffle className="h-4 w-4 mr-2" /> Re-Balance Teams
                          </Button>
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
                          teams={appState.teams}
                          unassignedPlayers={appState.unassignedPlayers}
                          stats={appState.stats}
                          config={appState.config}
                          playerGroups={appState.playerGroups}
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

      {/* Dialogs */}
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

      <Dialog open={isSaveWorkspaceDialogOpen} onOpenChange={setIsSaveWorkspaceDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold text-slate-800">Save Project</DialogTitle>
            <DialogDescription>Save your entire workspace (players, teams, and settings) to the cloud.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ws-name" className="font-bold text-slate-700">Project Name</Label>
              <Input
                id="ws-name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g., Summer Tournament 2024"
                className="rounded-xl border-2 border-slate-200 focus-visible:ring-primary"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ws-desc" className="font-bold text-slate-700">Description (Optional)</Label>
              <Input
                id="ws-desc"
                value={workspaceDescription}
                onChange={(e) => setWorkspaceDescription(e.target.value)}
                placeholder="Notes about this session..."
                className="rounded-xl border-2 border-slate-200 focus-visible:ring-primary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsSaveWorkspaceDialogOpen(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button
              onClick={handleSaveWorkspace}
              disabled={isSavingWorkspace}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl font-bold"
            >
              {isSavingWorkspace ? 'Saving...' : 'Save Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLoadWorkspaceDialogOpen} onOpenChange={setIsLoadWorkspaceDialogOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold text-slate-800">Load Project</DialogTitle>
            <DialogDescription>Select a previously saved workspace to restore.</DialogDescription>
            <div className="relative mt-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FolderOpen className="h-4 w-4 text-slate-400" />
              </div>
              <Input
                placeholder="Search projects..."
                className="pl-10 rounded-xl bg-slate-50 border-slate-200"
                value={workspaceSearchTerm}
                onChange={(e) => setWorkspaceSearchTerm(e.target.value)}
              />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-[300px] py-2 space-y-2">
            {isFetchingWorkspaces ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : savedWorkspaces.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                No saved projects found.
              </div>
            ) : (
              savedWorkspaces
                .filter(ws => ws.name.toLowerCase().includes(workspaceSearchTerm.toLowerCase()))
                .map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => handleLoadWorkspace(ws.id)}
                    disabled={loadingWorkspaceId === ws.id}
                    className="w-full flex items-center p-4 bg-white border border-slate-100 hover:border-primary/30 hover:bg-slate-50 rounded-xl transition-all group text-left relative"
                  >
                    <div className="h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 group-hover:bg-primary group-hover:text-white transition-colors">
                      <FolderOpen className="h-6 w-6" />
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                        {ws.name}
                      </div>
                      <div className="text-sm text-slate-500 line-clamp-1">{ws.description}</div>
                      <div className="text-xs text-slate-400 mt-1 flex gap-3">
                        <span>{new Date(ws.updatedAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{ws.players?.length || 0} players</span>
                        <span>•</span>
                        <span>{ws.teams?.length || 0} teams</span>
                      </div>
                    </div>

                    <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                        onClick={(e) => handleDeleteWorkspace(ws.id, e)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </button>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>


      <Analytics />
    </div>
  );
}

export default App;
