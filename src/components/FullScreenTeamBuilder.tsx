import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Player, Team, LeagueConfig, PlayerGroup, PlayerUpdateHandler, TeamGenerationStats, TeamIteration, TeamIterationStatus, LeagueMemoryEntry } from '@/types';
import { getPlayerGroup } from '@/utils/playerGrouping';
import { PlayerSidebar } from './PlayerSidebar';
import { TeamBoard } from './TeamBoard';
import { DraggablePlayerCard } from './DraggablePlayerCard';
import { TeamIterationTabs } from './TeamIterationTabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw, PanelLeftClose, PanelLeft, Undo2, AlertTriangle, Loader2, ArrowUpDown, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { WorkspaceManager } from './WorkspaceManager';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildIterationInsights, buildManualMoveRecommendations } from '@/utils/teamInsights';
import { ManualEditAssist } from './teams/ManualEditAssist';

interface FullScreenTeamBuilderProps {
  teams: Team[];
  unassignedPlayers: Player[];
  config: LeagueConfig;
  onPlayerMove: (playerId: string, targetTeamId: string | null) => void;
  onPlayerUpdate: PlayerUpdateHandler;
  onTeamNameChange: (teamId: string, newName: string) => void;
  onTeamBrandingChange?: (teamId: string, updates: {
    name?: string;
    color?: string;
    colorName?: string;
    resetName?: boolean;
    resetColor?: boolean;
  }) => void;
  players: Player[];
  playerGroups: PlayerGroup[];
  stats?: TeamGenerationStats;
  onExitFullScreen?: () => void;
  onLoadWorkspace: (id: string) => void;
  currentWorkspaceId?: string | null;
  isEmbedded?: boolean;
  onReset?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onRefreshBranding?: () => void;
  onAddTeam?: () => void;
  onRemoveTeam?: (teamId: string) => void;
  iterations: TeamIteration[];
  activeIterationId: string | null;
  onSelectIteration: (iterationId: string) => void;
  onCopyIteration: (iterationId: string) => void;
  onAddManualIteration: () => void;
  onStartOver?: () => void;
  activeIterationStatus?: TeamIterationStatus;
  leagueMemory?: LeagueMemoryEntry[];
}

export function FullScreenTeamBuilder({
  teams,
  unassignedPlayers,
  config,
  onPlayerMove,
  onPlayerUpdate,
  onTeamNameChange,
  onTeamBrandingChange,
  players,
  playerGroups,
  stats,
  onExitFullScreen,
  onLoadWorkspace,
  currentWorkspaceId,
  isEmbedded = false,
  onReset,
  onUndo,
  canUndo = false,
  onRefreshBranding,
  onAddTeam,
  onRemoveTeam,
  iterations,
  activeIterationId,
  onSelectIteration,
  onCopyIteration,
  onAddManualIteration,
  onStartOver,
  activeIterationStatus = 'ready',
  leagueMemory = [],
}: FullScreenTeamBuilderProps) {

  // Handle Undo Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (canUndo && onUndo) {
          onUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, onUndo]);

  const [activePlayer, setActivePlayer] = useState<Player | null>(null);

  const [sortBy, setSortBy] = useState<'name' | 'skill-high' | 'skill-low'>('name');

  // Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const currentInsights = buildIterationInsights({
    id: activeIterationId ?? 'current',
    name: iterations.find(iteration => iteration.id === activeIterationId)?.name || 'Current draft',
    teams,
    unassignedPlayers,
    stats,
  }, config, leagueMemory);
  const moveRecommendations = activePlayer
    ? buildManualMoveRecommendations(activePlayer.id, teams, config, leagueMemory)
    : [];

  // Sort teams
  const sortedTeams = [...teams].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    }
    const getAvgSkill = (team: Team) => {
      if (team.players.length === 0) return 0;
      const total = team.players.reduce((sum, p) => {
        const skill = (p.execSkillRating !== null && p.execSkillRating !== undefined)
          ? p.execSkillRating
          : p.skillRating;
        return sum + skill;
      }, 0);
      return total / team.players.length;
    };
    const skillA = getAvgSkill(a);
    const skillB = getAvgSkill(b);
    return sortBy === 'skill-high' ? skillB - skillA : skillA - skillB;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    // setActiveId(active.id as string);
    setActivePlayer(active.data.current?.player || null);
  };

  const handleDragOver = (_: DragOverEvent) => {
    // We can add visual feedback here if needed, but for now we rely on the droppable components
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActivePlayer(null);

    if (!over) return;

    const activePlayerId = active.id as string;
    const overId = over.id as string;
    const draggedPlayer = players.find(p => p.id === activePlayerId);

    if (!draggedPlayer) return;

    // Find source and destination
    const sourceTeamId = teams.find(t => t.players.some(p => p.id === activePlayerId))?.id || null;

    // Determine target team ID
    let targetTeamId: string | null = null;

    if (overId === 'unassigned') {
      targetTeamId = null;
    } else {
      // Check if dropped on a team card directly
      const targetTeam = teams.find(t => t.id === overId);
      if (targetTeam) {
        targetTeamId = targetTeam.id;
      } else {
        // Check if dropped on a player within a team
        const teamWithPlayer = teams.find(t => t.players.some(p => p.id === overId));
        if (teamWithPlayer) {
          targetTeamId = teamWithPlayer.id;
        }
      }
    }

    // Only move if destination is different
    if (sourceTeamId !== targetTeamId) {
      // Check if player is in a group
      const playerGroup = getPlayerGroup(playerGroups, activePlayerId);

      if (playerGroup && playerGroup.players.length > 1) {
        // Move entire group together
        playerGroup.players.forEach(groupMember => {
          onPlayerMove(groupMember.id, targetTeamId);
        });

        // Show group move toast
        if (targetTeamId) {
          const teamName = teams.find(t => t.id === targetTeamId)?.name || 'Team';
          toast.success(`Moved Group ${playerGroup.label} (${playerGroup.players.length} players) to ${teamName}`);
        } else {
          toast.success(`Moved Group ${playerGroup.label} (${playerGroup.players.length} players) to Unassigned`);
        }
      } else {
        // Move single player
        onPlayerMove(activePlayerId, targetTeamId);

        // Show toast
        if (targetTeamId) {
          const teamName = teams.find(t => t.id === targetTeamId)?.name || 'Team';
          toast.success(`Moved ${draggedPlayer.name} to ${teamName}`);
        } else {
          toast.success(`Moved ${draggedPlayer.name} to Unassigned`);
        }
      }
    }
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  return (
    <div className={isEmbedded
      ? "w-full h-[800px] flex flex-col font-sans text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden"
      : "fixed inset-0 bg-slate-50 z-50 flex flex-col font-sans text-slate-900"
    }>
      {/* Enterprise Header */}
      <div className={`bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex-shrink-0 z-20 sticky top-0 ${isEmbedded ? 'bg-white' : ''}`}>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
          {!isEmbedded && (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onExitFullScreen}
                className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors -ml-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm">
                  <img src="/logo-new.jpg" alt="TeamBuilder" className="h-4 w-4 object-cover rounded" />
                </div>
                <h1 className="text-lg font-bold tracking-tight text-slate-800">TeamBuilder Workspace</h1>
              </div>
            </div>
          )}
          {isEmbedded && (
            <div className="flex items-center gap-2 text-slate-500">
              <span className="text-sm font-semibold uppercase tracking-wider">Interactive Workspace</span>
            </div>
          )}
          </div>

          <div className="flex items-center gap-3">
            {onUndo && (
              <Button
                variant="outline"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                className="gap-2 text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
                <span className="hidden sm:inline">Undo</span>
              </Button>
            )}
            {onReset && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm('Reset this iteration? This will move all players back to the Player Pool for the current tab.')) {
                    onReset();
                    toast.success('Current tab reset');
                  }
                }}
                className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Clear Tab</span>
              </Button>
            )}
            {onStartOver && (
              <Button
                variant="outline"
                size="sm"
                onClick={onStartOver}
                className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
              >
                <AlertTriangle className="w-4 h-4" />
                <span className="hidden sm:inline">Start Over</span>
              </Button>
            )}
            {onLoadWorkspace && (
              <div className="flex items-center gap-3">
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'name' | 'skill-high' | 'skill-low')}>
                  <SelectTrigger className="w-[180px] h-9 bg-white border-slate-200">
                    <SelectValue placeholder="Sort teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
                        <span>Sort by Name</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="skill-high">
                      <div className="flex items-center gap-2">
                        <ArrowDownWideNarrow className="h-3.5 w-3.5 text-slate-500" />
                        <span>Skill: High to Low</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="skill-low">
                      <div className="flex items-center gap-2">
                        <ArrowUpNarrowWide className="h-3.5 w-3.5 text-slate-500" />
                        <span>Skill: Low to High</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="h-6 w-px bg-slate-200 mx-1" />
                {onLoadWorkspace && (
                  <div className="flex items-center">
                    <WorkspaceManager
                      players={players}
                      playerGroups={playerGroups}
                      teams={teams}
                      unassignedPlayers={unassignedPlayers}
                      config={config}
                      stats={stats}
                      onLoadWorkspace={onLoadWorkspace}
                      currentWorkspaceId={currentWorkspaceId}
                      mode="toolbar"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {iterations.length > 0 && (
          <div className="mt-3">
            <TeamIterationTabs
              iterations={iterations}
              activeIterationId={activeIterationId}
              onSelectIteration={onSelectIteration}
              onCopyIteration={onCopyIteration}
              onAddManualIteration={onAddManualIteration}
            />
          </div>
        )}
      </div>

      {/* Main Content */}
      {activeIterationStatus !== 'ready' ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${activeIterationStatus === 'failed' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'}`}>
              {activeIterationStatus === 'failed' ? <AlertTriangle className="h-8 w-8" /> : <Loader2 className="h-8 w-8 animate-spin" />}
            </div>
            <h2 className="text-2xl font-bold text-slate-800">
              {activeIterationStatus === 'failed' ? 'This team tab could not be opened' : 'Preparing this team tab'}
            </h2>
            <p className="mt-3 text-slate-500">
              {activeIterationStatus === 'failed'
                ? 'Create another manual tab when you are ready.'
                : 'Your other team tabs are still available while this version finishes loading.'}
            </p>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="relative flex-1 flex overflow-hidden">
          {/* Sidebar - Collapsible */}
          <div className={`relative flex-shrink-0 z-20 shadow-xl transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-12' : 'w-80'}`}>
            {/* Toggle button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="absolute -right-3 top-4 z-30 bg-white border border-slate-200 rounded-full p-1.5 shadow-md hover:bg-slate-50 transition-colors"
              title={isSidebarCollapsed ? 'Expand Player Pool' : 'Collapse Player Pool'}
            >
              {isSidebarCollapsed ? (
                <PanelLeft className="h-4 w-4 text-slate-600" />
              ) : (
                <PanelLeftClose className="h-4 w-4 text-slate-600" />
              )}
            </button>

            {/* Collapsed state - minimal indicator */}
            {isSidebarCollapsed ? (
              <div className="h-full bg-white flex flex-col items-center pt-16 border-r border-slate-200">
                <div className="writing-mode-vertical text-xs font-medium text-slate-500 tracking-wider rotate-180" style={{ writingMode: 'vertical-rl' }}>
                  PLAYER POOL ({unassignedPlayers.length})
                </div>
              </div>
            ) : (
              <PlayerSidebar
                players={unassignedPlayers}
                playerGroups={playerGroups}
                onPlayerUpdate={onPlayerUpdate}
              />
            )}
          </div>

          <ManualEditAssist
            activePlayer={activePlayer}
            recommendations={moveRecommendations}
            insights={currentInsights}
          />

          {/* Board */}
          <TeamBoard
            teams={sortedTeams}
            players={players}
            config={config}
            onPlayerUpdate={onPlayerUpdate}
            onTeamNameChange={onTeamNameChange}
            onTeamBrandingChange={onTeamBrandingChange}
            onAddTeam={onAddTeam}
            onRemoveTeam={onRemoveTeam}
            onRefreshBranding={onRefreshBranding}
            playerGroups={playerGroups}
          />
        </div>

        {/* Drag Overlay */}
        {
          createPortal(
            <DragOverlay dropAnimation={dropAnimation}>
              {activePlayer ? (
                <DraggablePlayerCard player={activePlayer} />
              ) : null}
            </DragOverlay>,
            document.body
          )
        }
        </DndContext >
      )}
    </div >
  );
}
