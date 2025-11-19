import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { Player, Team, LeagueConfig, AppState, TeamGenerationStats, PlayerGroup, getEffectiveSkillRating } from '@/types';
import { getDefaultConfig, saveDefaultConfig } from '@/utils/configManager';
import { generateBalancedTeams } from '@/utils/teamGenerator';
import { validateAndProcessCSV } from '@/utils/csvProcessor';
import { debounce, safeJsonParse, validateObjectStructure, safeLocalStorageSave } from '@/utils/performance';
import { validateAppState, validatePlayer, validateTeamName } from '@/utils/validation';
import { dataStorageService } from '@/services/dataStorageService';
import { saveRoster, updateRoster, RosterData, getUserRosters, getRoster } from '@/services/rosterService';
import { CSVUploader } from '@/components/CSVUploader';
import { ConfigurationPanel } from '@/components/ConfigurationPanel';
import { PlayerRoster } from '@/components/PlayerRoster';
import { TeamDisplay } from '@/components/TeamDisplay';
import { FullScreenTeamBuilder } from '@/components/FullScreenTeamBuilder';
import { GenerationStats } from '@/components/GenerationStats';
import { ExportPanel } from '@/components/ExportPanel';
import { PlayerGroups } from '@/components/PlayerGroups';
import PlayerEmail from '@/components/PlayerEmail';
import TutorialLanding from '@/components/TutorialLanding';
import { SavedTeamsManager } from '@/components/SavedTeamsManager';
import { AuthDialog } from '@/components/AuthDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, FolderOpen, Users, Settings, FileSpreadsheet, BarChart3, Download, Shuffle, Zap, UserCheck, Trash2, Play, AlertTriangle, MousePointer, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorBoundary } from 'react-error-boundary';
import { Analytics } from '@vercel/analytics/react';
import logoUrl from '@/assets/logo.svg';

// Import test runner for development
if (import.meta.env.DEV) {
  import('@/utils/firebaseTestRunner');
}

interface ComponentErrorBoundaryProps {
  children: React.ReactNode;
  isolate?: boolean;
  componentName: string;
}

function ComponentErrorBoundary({ children, isolate, componentName }: ComponentErrorBoundaryProps) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error(`Error in ${componentName}:`, error, errorInfo);
        toast.error(`Error in ${componentName}: ${error.message}`);
      }}
      isolate={isolate}
    >
      {children}
    </ErrorBoundary>
  );
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
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

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

  const [isSaveRosterDialogOpen, setIsSaveRosterDialogOpen] = useState(false);
  const [rosterName, setRosterName] = useState('');
  const [rosterDescription, setRosterDescription] = useState('');
  const [savedRosterId, setSavedRosterId] = useState<string | null>(null);
  const [isSavingRoster, setIsSavingRoster] = useState(false);
  const [isLoadRosterDialogOpen, setIsLoadRosterDialogOpen] = useState(false);
  const [savedRosters, setSavedRosters] = useState<RosterData[]>([]);
  const [isFetchingRosters, setIsFetchingRosters] = useState(false);
  const [loadingRosterId, setLoadingRosterId] = useState<string | null>(null);
  const [rosterSearchTerm, setRosterSearchTerm] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const autoSaveResetTimeoutRef = useRef<number | null>(null);
  const autoSaveSuppressTimeoutRef = useRef<number | null>(null);
  const autoSaveSuppressedRef = useRef(false);
  const autoSaveInFlightRef = useRef(false);

  const suppressAutoSave = useCallback((duration: number = 1000) => {
    autoSaveSuppressedRef.current = true;
    if (autoSaveSuppressTimeoutRef.current) {
      window.clearTimeout(autoSaveSuppressTimeoutRef.current);
    }
    autoSaveSuppressTimeoutRef.current = window.setTimeout(() => {
      autoSaveSuppressedRef.current = false;
      autoSaveSuppressTimeoutRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedRosterId(null);
      setRosterName('');
      setRosterDescription('');
      setSavedRosters([]);
      setIsLoadRosterDialogOpen(false);
      setRosterSearchTerm('');
      setLoadingRosterId(null);
      setLastAutoSaveAt(null);
      setAutoSaveStatus('idle');
      suppressAutoSave(1000);
    }
  }, [user, suppressAutoSave]);

  const fetchUserRosters = useCallback(async () => {
    if (!user) {
      setSavedRosters([]);
      return;
    }

    setIsFetchingRosters(true);
    try {
      const rosters = await getUserRosters(user.uid, false);
      setSavedRosters(rosters);
    } catch (error) {
      console.error('Failed to load saved rosters:', error);
      toast.error('Failed to load saved rosters');
    } finally {
      setIsFetchingRosters(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchUserRosters();
    }
  }, [user, fetchUserRosters]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      if (autoSaveResetTimeoutRef.current) {
        window.clearTimeout(autoSaveResetTimeoutRef.current);
        autoSaveResetTimeoutRef.current = null;
      }
      if (autoSaveSuppressTimeoutRef.current) {
        window.clearTimeout(autoSaveSuppressTimeoutRef.current);
        autoSaveSuppressTimeoutRef.current = null;
      }
    };
  }, []);

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
      setIsLoadingAuth(false);

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
            validatedPlayers.forEach(player => {
              if (player.execSkillRating !== null) {
                execHistory[normalizeName(player.name)] = player.execSkillRating;
              }
            });

            setAppState({
              ...loadedState,
              players: validatedPlayers,
              config: loadedState.config || getDefaultConfig(),
              execRatingHistory: execHistory
            });
          } else {
            console.warn('Invalid saved state structure');
            toast.warning('Some saved data was invalid and has been cleaned up');
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
        setSyncStatus('saving');
        try {
          await dataStorageService.save(appState);
          setSyncStatus('saved');
        } catch (error) {
          console.error('Failed to save data:', error);
          setSyncStatus('error');
        }
      };

      // Debounce the save
      const timeoutId = setTimeout(saveData, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [appState, dataLoaded]);


  // Add a function to clear saved data
  const handleClearSavedData = useCallback(async () => {
    if (window.confirm('Are you sure you want to clear all saved data? This cannot be undone.')) {
      await dataStorageService.clearAll();
      setAppState({
        players: [],
        teams: [],
        unassignedPlayers: [],
        playerGroups: [],
        config: getDefaultConfig(),
        execRatingHistory: {},
        savedConfigs: []
      });
      toast.success('All saved data has been cleared');
      setSavedRosterId(null);
      setRosterName('');
      setRosterDescription('');
      setLastAutoSaveAt(null);
      setAutoSaveStatus('idle');
      suppressAutoSave(1000);
    }
  }, [suppressAutoSave]);

  const handleOpenSaveRosterDialog = useCallback(() => {
    if (!user) {
      toast.error('Please sign in to save rosters online');
      return;
    }

    if (appState.players.length === 0) {
      toast.error('Add players before saving');
      return;
    }

    setRosterName(prev => {
      if (prev.trim()) {
        return prev;
      }
      const fallbackName = 'Roster ' + new Date().toLocaleDateString();
      return fallbackName;
    });
    setIsSaveRosterDialogOpen(true);
  }, [user, appState.players.length]);

  const handleOpenLoadRosterDialog = useCallback(() => {
    if (!user) {
      toast.error('Please sign in to load rosters');
      return;
    }

    fetchUserRosters();
    setIsLoadRosterDialogOpen(true);
  }, [user, fetchUserRosters]);

  const handleSaveRosterToFirebase = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to save rosters online');
      return;
    }

    const trimmedName = rosterName.trim();
    if (!trimmedName) {
      toast.error('Please enter a roster name');
      return;
    }

    if (appState.players.length === 0) {
      toast.error('Cannot save an empty roster');
      return;
    }

    suppressAutoSave(1500);
    setIsSavingRoster(true);

    try {
      const descriptionValue = rosterDescription.trim();

      if (savedRosterId) {
        const updatePayload: Partial<RosterData> = {
          name: trimmedName,
          players: appState.players,
          playerGroups: appState.playerGroups
        };

        updatePayload.description = descriptionValue || '';

        await updateRoster(savedRosterId, updatePayload, true);
        toast.success('Roster updated successfully');
      } else {
        const rosterPayload: Omit<RosterData, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'metadata'> = {
          userId: user.uid,
          name: trimmedName,
          players: appState.players,
          playerGroups: appState.playerGroups
        };

        if (descriptionValue) {
          rosterPayload.description = descriptionValue;
        }

        const rosterId = await saveRoster(rosterPayload);
        setSavedRosterId(rosterId);
        toast.success('Roster saved successfully');
      }

      fetchUserRosters();
      setIsSaveRosterDialogOpen(false);
    } catch (error: any) {
      console.error('Failed to save roster to Firebase:', error);
      toast.error(error?.message || 'Failed to save roster');
    } finally {
      setIsSavingRoster(false);
    }
  }, [user, rosterName, rosterDescription, appState.players, appState.playerGroups, savedRosterId, fetchUserRosters, suppressAutoSave]);

  const autoSaveRoster = useCallback(async () => {
    if (!user || !dataLoaded || isSavingRoster) {
      return;
    }

    if (autoSaveSuppressedRef.current || autoSaveInFlightRef.current) {
      return;
    }

    if (appState.players.length === 0) {
      return;
    }

    autoSaveInFlightRef.current = true;
    setAutoSaveStatus('saving');

    const trimmedName = rosterName.trim();
    let nameToUse = trimmedName;
    if (!trimmedName) {
      nameToUse = 'Auto Saved Roster ' + new Date().toLocaleDateString();
      setRosterName(prev => (prev.trim() ? prev : nameToUse));
    }

    const descriptionValue = rosterDescription.trim();
    try {
      if (savedRosterId) {
        const updatePayload: Partial<RosterData> = {
          name: nameToUse,
          players: appState.players,
          playerGroups: appState.playerGroups,
          description: descriptionValue || ''
        };

        await updateRoster(savedRosterId, updatePayload, false);
      } else {
        if (!user) {
          return;
        }

        const rosterPayload: Omit<RosterData, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'metadata'> = {
          userId: user.uid,
          name: nameToUse,
          players: appState.players,
          playerGroups: appState.playerGroups
        };

        if (descriptionValue) {
          rosterPayload.description = descriptionValue;
        }

        const newRosterId = await saveRoster(rosterPayload);
        setSavedRosterId(newRosterId);
      }

      setAutoSaveStatus('saved');
      setLastAutoSaveAt(new Date());
      suppressAutoSave(1000);

      fetchUserRosters();
    } catch (error) {
      console.error('Auto-save failed:', error);
      setAutoSaveStatus('error');
    } finally {
      autoSaveInFlightRef.current = false;

      if (autoSaveResetTimeoutRef.current) {
        window.clearTimeout(autoSaveResetTimeoutRef.current);
      }
      autoSaveResetTimeoutRef.current = window.setTimeout(() => {
        setAutoSaveStatus('idle');
        autoSaveResetTimeoutRef.current = null;
      }, 3000);
    }
  }, [user, dataLoaded, isSavingRoster, appState.players, appState.playerGroups, rosterName, rosterDescription, savedRosterId, suppressAutoSave, fetchUserRosters]);

  const handleLoadRosterFromFirebase = useCallback(async (rosterId: string) => {
    suppressAutoSave(1500);
    if (!user) {
      toast.error('Please sign in to load rosters');
      return;
    }

    setLoadingRosterId(rosterId);
    try {
      const roster = await getRoster(rosterId);
      if (!roster) {
        toast.error('Roster could not be found');
        return;
      }

      setAppState(prev => {
        const execHistory = { ...prev.execRatingHistory };
        (roster.players || []).forEach(player => {
          if (player.execSkillRating !== null && player.execSkillRating !== undefined) {
            execHistory[normalizeName(player.name)] = player.execSkillRating;
          }
        });

        return {
          ...prev,
          players: roster.players || [],
          teams: roster.teams || [],
          unassignedPlayers: roster.unassignedPlayers || [],
          playerGroups: roster.playerGroups || [],
          config: roster.teamsConfig || prev.config,
          stats: undefined,
          execRatingHistory: execHistory
        };
      });

      setSavedRosterId(roster.id ?? null);
      setRosterName(roster.name ?? '');
      setRosterDescription(roster.description ?? '');
      setIsManualMode(false);
      setIsFullScreenMode(false);
      setIsLoadRosterDialogOpen(false);
      setRosterSearchTerm('');

      if (roster.teams && roster.teams.length > 0) {
        setActiveTab('teams');
      } else {
        setActiveTab('roster');
      }

      if (roster.name) {
        toast.success('Loaded roster "' + roster.name + '"');
      } else {
        toast.success('Loaded roster');
      }
      fetchUserRosters();
    } catch (error) {
      console.error('Failed to load roster from Firebase:', error);
      toast.error('Failed to load roster');
    } finally {
      setLoadingRosterId(null);
    }
  }, [user, fetchUserRosters, suppressAutoSave]);

  const filteredSavedRosters = useMemo(() => {
    const term = rosterSearchTerm.trim().toLowerCase();
    if (!term) {
      return savedRosters;
    }

    return savedRosters.filter(roster => {
      const searchSource = [
        roster.name,
        roster.description,
        roster.season,
        roster.sport,
        Array.isArray(roster.tags) ? roster.tags.join(' ') : ''
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchSource.includes(term);
    });
  }, [savedRosters, rosterSearchTerm]);

  const [activeTab, setActiveTab] = useState<string>('upload');

  useEffect(() => {
    if (!user || !dataLoaded || isSavingRoster) {
      return;
    }

    if (autoSaveSuppressedRef.current) {
      return;
    }

    if (appState.players.length === 0) {
      return;
    }

    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = window.setTimeout(() => {
      autoSaveTimeoutRef.current = null;
      void autoSaveRoster();
    }, 1500);

    return () => {
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [user, dataLoaded, isSavingRoster, appState.players, appState.playerGroups, rosterName, rosterDescription, savedRosterId, autoSaveRoster]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isFullScreenMode, setIsFullScreenMode] = useState(false);
  const handlePlayersLoaded = useCallback((players: Player[], playerGroups: PlayerGroup[] = []) => {
    suppressAutoSave(1500);
    setAppState(prev => {
      const execRatingHistory = { ...prev.execRatingHistory };

      // Seed history with any exec ratings already stored on current players
      prev.players.forEach(existingPlayer => {
        if (existingPlayer.execSkillRating !== null) {
          execRatingHistory[normalizeName(existingPlayer.name)] = existingPlayer.execSkillRating;
        }
      });

      const updatedPlayers = players.map(player => {
        const nameKey = normalizeName(player.name);
        const csvExec = player.execSkillRating !== null && player.execSkillRating !== undefined
          ? player.execSkillRating
          : null;

        const historyExec = execRatingHistory[nameKey];
        const finalExec = csvExec !== null && csvExec !== undefined
          ? csvExec
          : historyExec !== undefined
            ? historyExec
            : null;

        if (finalExec !== null) {
          execRatingHistory[nameKey] = finalExec;
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

    setSavedRosterId(null);
    setRosterName('');
    setRosterDescription('');
  }, [suppressAutoSave]);



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

    setIsGenerating(true);
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
    } finally {
      setIsGenerating(false);
    }
  }, [appState.players, appState.config]);

  const handlePlayerUpdate = useCallback((updatedPlayer: Player) => {
    setAppState(prev => {
      const existingPlayer = prev.players.find(p => p.id === updatedPlayer.id);
      const updatedHistory = { ...prev.execRatingHistory };

      if (existingPlayer) {
        const oldKey = normalizeName(existingPlayer.name);
        const newKey = normalizeName(updatedPlayer.name);

        if (oldKey !== newKey && updatedHistory[oldKey] !== undefined) {
          delete updatedHistory[oldKey];
        }

        if (updatedPlayer.execSkillRating !== null && updatedPlayer.execSkillRating !== undefined) {
          updatedHistory[newKey] = updatedPlayer.execSkillRating;
        } else {
          delete updatedHistory[newKey];
        }
      } else if (updatedPlayer.execSkillRating !== null && updatedPlayer.execSkillRating !== undefined) {
        updatedHistory[normalizeName(updatedPlayer.name)] = updatedPlayer.execSkillRating;
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
        updatedHistory[normalizeName(newPlayer.name)] = newPlayer.execSkillRating;
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
      const updatedPlayer = { ...player, teamId: targetTeamId };

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
        teams: isManualMode ? updatedTeams : updatedTeams.filter(t => t.players.length > 0),
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

  const hasPlayers = appState.players.length > 0;
  const hasTeams = appState.teams.length > 0;

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

  // Show tutorial landing page if user hasn't completed it
  if (showTutorial) {
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <TutorialLanding onStartApp={handleStartApp} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-green-50">
        <header className="bg-white/95 backdrop-blur-xl shadow-xl border-b border-green-200">
          <div className="w-full max-w-full xl:max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <img src={logoUrl} alt="TeamBuilder Logo" className="h-10 w-10" />
                <div>
                  <h1 className="text-4xl font-bold">
                    <span className="text-gray-800">Team</span>
                    <span className="text-primary">Builder</span>
                  </h1>
                  <p className="text-sm text-gray-600 mt-1.5">⚽ Automatically generate balanced sports teams ⚽</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Sync status indicator */}
                {user && (
                  <div className="flex items-center gap-2 text-sm">
                    {syncStatus === 'saving' && (
                      <span className="text-blue-600">🔄 Saving...</span>
                    )}
                    {syncStatus === 'saved' && (
                      <span className="text-green-600">✅ Saved</span>
                    )}
                    {syncStatus === 'error' && (
                      <span className="text-red-600">⚠️ Offline</span>
                    )}
                  </div>
                )}

                {/* Auth controls */}
                {!user ? (
                  <Button
                    onClick={() => setAuthDialogOpen(true)}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Sign in to save online
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-gray-600">
                      {user.email || 'Signed in'}
                    </div>
                    <Button
                      onClick={handleSignOut}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Users className="h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

        <main className="w-full max-w-full xl:max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 py-8">
          {/* Main Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-7 mb-6 bg-white/80 backdrop-blur-xl border border-green-200 shadow-lg">
              <TabsTrigger value="upload" className="flex items-center gap-2 text-gray-600 hover:text-gray-800 data-[state=active]:text-white data-[state=active]:bg-primary font-medium">
                <FileSpreadsheet className="h-4 w-4" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="roster" disabled={!hasPlayers} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 data-[state=active]:text-white data-[state=active]:bg-primary disabled:text-gray-400 font-medium">
                <Users className="h-4 w-4" />
                Roster
              </TabsTrigger>
              <TabsTrigger value="groups" disabled={!hasPlayers} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 data-[state=active]:text-white data-[state=active]:bg-primary disabled:text-gray-400 font-medium">
                <UserCheck className="h-4 w-4" />
                Groups
              </TabsTrigger>
              <TabsTrigger value="config" disabled={!hasPlayers} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 data-[state=active]:text-white data-[state=active]:bg-primary disabled:text-gray-400 font-medium">
                <Zap className="h-4 w-4" />
                Generate Teams
              </TabsTrigger>
              <TabsTrigger value="teams" disabled={!hasTeams} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 data-[state=active]:text-white data-[state=active]:bg-primary disabled:text-gray-400 font-medium">
                <BarChart3 className="h-4 w-4" />
                Teams
              </TabsTrigger>
              <TabsTrigger value="export" disabled={!hasTeams} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 data-[state=active]:text-white data-[state=active]:bg-primary disabled:text-gray-400 font-medium">
                <Download className="h-4 w-4" />
                Export
              </TabsTrigger>
              <TabsTrigger value="email" disabled={!hasTeams || appState.players.filter(p => p.email).length === 0} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 data-[state=active]:text-white data-[state=active]:bg-primary disabled:text-gray-400 font-medium">
                <Users className="h-4 w-4" />
                Email
              </TabsTrigger>
            </TabsList>

            {/* Upload Tab */}
            <TabsContent value="upload" className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">🏆 Get Started</h2>
                <Button
                  variant="outline"
                  onClick={() => {
                    localStorage.removeItem('tutorialCompleted');
                    window.location.reload();
                  }}
                  className="flex items-center gap-2 text-secondary hover:text-secondary/80 border-green-200 hover:bg-green-50"
                >
                  <Play className="h-4 w-4" />
                  View Tutorial Again
                </Button>
              </div>
              <Card className="bg-white/90 backdrop-blur-xl border-green-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-800 flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    Upload Player Roster
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                  Upload a CSV or Excel file with player information to get started building your teams
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ComponentErrorBoundary isolate componentName="CSVUploader">
                    <CSVUploader onPlayersLoaded={handlePlayersLoaded} />
                  </ComponentErrorBoundary>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Player Groups Tab */}
            <TabsContent value="groups" className="space-y-6">
              <PlayerGroups 
                playerGroups={appState.playerGroups}
                players={appState.players}
                onAddPlayerToGroup={handleAddPlayerToGroup}
                onRemovePlayerFromGroup={handleRemovePlayerFromGroup}
                onCreateNewGroup={handleCreateNewGroup}
                onDeleteGroup={handleDeleteGroup}
                onMergeGroups={handleMergeGroups}
              />
            </TabsContent>

            {/* Roster Tab */}
            <TabsContent value="roster" className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    localStorage.removeItem('tutorialCompleted');
                    window.location.reload();
                  }}
                  className="flex items-center gap-2 text-secondary hover:text-secondary/80 border-green-200 hover:bg-green-50"
                >
                  <Play className="h-4 w-4" />
                  View Tutorial Again
                </Button>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={handleOpenSaveRosterDialog}
                    className="flex items-center gap-2 bg-primary text-white hover:bg-primary/90 shadow-md"
                    disabled={appState.players.length === 0 || isSavingRoster}
                  >
                    <Save className="h-4 w-4" />
                    {isSavingRoster ? 'Saving...' : savedRosterId ? 'Update Roster' : 'Save Roster'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleOpenLoadRosterDialog}
                    className="flex items-center gap-2 border-green-200 hover:bg-green-50"
                    disabled={!user || isFetchingRosters}
                  >
                    <FolderOpen className="h-4 w-4" />
                    {isFetchingRosters ? 'Loading...' : 'Load Roster'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClearSavedData}
                    className="flex items-center gap-2 text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear Saved Data
                  </Button>
                </div>
                {user && (
                  <div className="w-full text-xs text-muted-foreground mt-1">
                    {autoSaveStatus === 'saving' && 'Auto-saving...'}
                    {autoSaveStatus === 'saved' && lastAutoSaveAt && ('Auto-saved at ' + lastAutoSaveAt.toLocaleTimeString())}
                    {autoSaveStatus === 'error' && (
                      <span className="text-red-500">Auto-save failed. Changes are stored locally.</span>
                    )}
                  </div>
                )}
              </div>
              <ComponentErrorBoundary isolate componentName="PlayerRoster">
                <PlayerRoster
                  players={appState.players}
                  onPlayerUpdate={handlePlayerUpdate}
                  onPlayerAdd={handlePlayerAdd}
                  onPlayerRemove={handlePlayerRemove}
                />
              </ComponentErrorBoundary>

              <Dialog
                open={isSaveRosterDialogOpen}
                onOpenChange={open => {
                  if (!isSavingRoster) {
                    setIsSaveRosterDialogOpen(open);
                  }
                }}
              >
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{savedRosterId ? 'Update Roster' : 'Save Roster'}</DialogTitle>
                    <DialogDescription>
                      Name your roster so you can find it again quickly. You can update it later.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="roster-name">Roster name</Label>
                      <Input
                        id="roster-name"
                        value={rosterName}
                        onChange={event => setRosterName(event.target.value)}
                        placeholder="e.g. 2025 Fall Indoor League"
                        disabled={isSavingRoster}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="roster-description">Description (optional)</Label>
                      <Input
                        id="roster-description"
                        value={rosterDescription}
                        onChange={event => setRosterDescription(event.target.value)}
                        placeholder="Add a short note to quickly identify this roster"
                        disabled={isSavingRoster}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsSaveRosterDialogOpen(false)}
                      disabled={isSavingRoster}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveRosterToFirebase}
                      disabled={isSavingRoster || !rosterName.trim()}
                    >
                      {isSavingRoster ? 'Saving...' : savedRosterId ? 'Update Roster' : 'Save Roster'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog
                open={isLoadRosterDialogOpen}
                onOpenChange={open => {
                  if (!loadingRosterId) {
                    setIsLoadRosterDialogOpen(open);
                    if (!open) {
                      setRosterSearchTerm('');
                    }
                  }
                }}
              >
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Load Saved Roster</DialogTitle>
                    <DialogDescription>
                      Choose a roster you've saved to Firebase to replace the current roster.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="roster-search">Search</Label>
                      <Input
                        id="roster-search"
                        value={rosterSearchTerm}
                        onChange={event => setRosterSearchTerm(event.target.value)}
                        placeholder="Search by name, season, or sport"
                        disabled={isFetchingRosters}
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
                      {isFetchingRosters && savedRosters.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          Loading saved rosters...
                        </div>
                      ) : filteredSavedRosters.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          {rosterSearchTerm
                            ? 'No saved rosters match your search.'
                            : 'No saved rosters yet.'}
                        </div>
                      ) : (
                        filteredSavedRosters.map(roster => {
                          const rosterId = roster.id;
                          const isLoadingThisRoster = rosterId ? loadingRosterId === rosterId : false;
                          const updatedLabel = roster.updatedAt
                            ? 'Updated ' + roster.updatedAt.toLocaleDateString()
                            : undefined;
                          const playersLabel = (roster.metadata?.totalPlayers ?? 0) + ' players';
                          return (
                            <button
                              key={rosterId || roster.name}
                              type="button"
                              onClick={() => rosterId && handleLoadRosterFromFirebase(rosterId)}
                              disabled={!rosterId || isLoadingThisRoster}
                              className="w-full px-4 py-3 text-left hover:bg-muted transition disabled:opacity-60"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="text-sm font-medium text-foreground">
                                    {roster.name || 'Untitled roster'}
                                  </div>
                                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                                    <span>{playersLabel}</span>
                                    {roster.season && <span>• {roster.season}</span>}
                                    {roster.sport && <span>• {roster.sport}</span>}
                                    {updatedLabel && <span>• {updatedLabel}</span>}
                                  </div>
                                </div>
                                <div className="text-xs font-medium text-muted-foreground">
                                  {isLoadingThisRoster ? 'Loading…' : 'Load'}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsLoadRosterDialogOpen(false);
                        setRosterSearchTerm('');
                      }}
                      disabled={loadingRosterId !== null}
                    >
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Generate Teams Tab */}
            <TabsContent value="config" className="space-y-6">
              <Card className="bg-white/90 backdrop-blur-xl border-green-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-800 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Team Generation Settings
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Configure team size limits and gender requirements for fair, balanced teams
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ConfigurationPanel
                    config={appState.config}
                    onConfigChange={handleConfigChange}
                    playerCount={appState.players.length}
                    players={appState.players}
                  />
                </CardContent>
              </Card>

              {/* Generate Teams Section */}
              <Card className="bg-white/90 backdrop-blur-xl border-green-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-800 flex items-center gap-2">
                    ⚡ Generate Teams
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Create balanced teams based on your configuration and player constraints
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      onClick={() => handleGenerateTeams(false)}
                      disabled={isGenerating || !hasPlayers}
                      className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg"
                      size="lg"
                    >
                      <Zap className="h-4 w-4" />
                      {isGenerating ? 'Generating...' : '🏆 Balanced Teams'}
                    </Button>

                    <Button
                      onClick={() => handleGenerateTeams(true)}
                      disabled={isGenerating || !hasPlayers}
                      variant="outline"
                      className="flex items-center gap-2 border-secondary text-secondary hover:bg-secondary hover:text-white"
                      size="lg"
                    >
                      <Shuffle className="h-4 w-4" />
                      🎲 Random Teams
                    </Button>

                    <Button
                      onClick={() => handleGenerateTeams(false, true)}
                      disabled={isGenerating || !hasPlayers}
                      variant="outline"
                      className="flex items-center gap-2 border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white"
                      size="lg"
                    >
                      <MousePointer className="h-4 w-4" />
                      ⚡ Manual Teams
                    </Button>
                  </div>
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>🏆 Balanced Teams:</strong> Honors teammate/avoid requests and balances skill levels
                      <br />
                      <strong>🎲 Random Teams:</strong> Ignores preferences and randomly distributes players
                      <br />
                      <strong>⚡ Manual Teams:</strong> Creates empty teams with groups pre-assigned, drag individual players
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Teams Tab */}
            <TabsContent value="teams" className="space-y-6">
              {/* Full Screen Mode */}
              {isFullScreenMode ? (
                <FullScreenTeamBuilder
                  teams={appState.teams}
                  unassignedPlayers={appState.unassignedPlayers}
                  config={appState.config}
                  onPlayerMove={handlePlayerMove}
                  onTeamNameChange={handleTeamNameChange}
                  players={appState.players}
                  playerGroups={appState.playerGroups}
                  onExitFullScreen={() => setIsFullScreenMode(false)}
                  onLoadTeams={handleLoadTeams}
                />
              ) : (
                <>
                  {/* Team Generation Statistics */}
                  {appState.stats && (
                    <div className="mb-6">
                      <GenerationStats stats={appState.stats} totalTeams={appState.teams.length} />
                    </div>
                  )}

                  {/* Save/Load Teams and Full Screen Button */}
                  <div className="space-y-4 mb-6">
                    <SavedTeamsManager
                      teams={appState.teams}
                      unassignedPlayers={appState.unassignedPlayers}
                      config={appState.config}
                      onLoadTeams={handleLoadTeams}
                    />

                    {/* Full Screen Button - Only show in manual mode */}
                    {isManualMode && appState.teams.length > 0 && (
                      <div className="flex justify-end">
                        <Button
                          onClick={() => setIsFullScreenMode(true)}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          <Maximize2 className="h-4 w-4" />
                          Full Screen Team Builder
                        </Button>
                      </div>
                    )}
                  </div>

                  <TeamDisplay
                    teams={appState.teams}
                    unassignedPlayers={appState.unassignedPlayers}
                    config={appState.config}
                    onPlayerMove={handlePlayerMove}
                    onTeamNameChange={handleTeamNameChange}
                    players={appState.players}
                    playerGroups={appState.playerGroups}
                    manualMode={isManualMode}
                  />
                </>
              )}
            </TabsContent>

            {/* Export Tab */}
            <TabsContent value="export" className="space-y-6">
              <ExportPanel 
                teams={appState.teams}
                unassignedPlayers={appState.unassignedPlayers}
                config={appState.config}
                stats={appState.stats}
                playerGroups={appState.playerGroups}
              />
            </TabsContent>

            {/* Email Tab */}
            <TabsContent value="email" className="space-y-6">
              <PlayerEmail 
                teams={appState.teams}
                unassignedPlayers={appState.unassignedPlayers}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>
      <Analytics />
    </ErrorBoundary>
  );
}

export default App;
