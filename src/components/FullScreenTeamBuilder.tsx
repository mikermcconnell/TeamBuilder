import React, { useState, useCallback, useEffect } from 'react';
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
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { Player, Team, LeagueConfig, PlayerGroup } from '@/types';
import { PlayerSidebar } from './PlayerSidebar';
import { TeamBoard } from './TeamBoard';
import { DraggablePlayerCard } from './DraggablePlayerCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

interface FullScreenTeamBuilderProps {
  teams: Team[];
  unassignedPlayers: Player[];
  config: LeagueConfig;
  onPlayerMove: (playerId: string, targetTeamId: string | null) => void;
  onTeamNameChange: (teamId: string, newName: string) => void;
  players: Player[];
  playerGroups: PlayerGroup[];
  onExitFullScreen: () => void;
  onLoadTeams?: (teams: Team[], unassignedPlayers: Player[], config: LeagueConfig) => void;
}

export function FullScreenTeamBuilder({
  teams,
  unassignedPlayers,
  config,
  onPlayerMove,
  onTeamNameChange,
  players,
  playerGroups,
  onExitFullScreen,
  onLoadTeams
}: FullScreenTeamBuilderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);

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
    setActiveId(active.id as string);
    setActivePlayer(active.data.current?.player || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // We can add visual feedback here if needed, but for now we rely on the droppable components
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActivePlayer(null);

    if (!over) return;

    const activePlayerId = active.id as string;
    const overId = over.id as string;

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
      onPlayerMove(activePlayerId, targetTeamId);

      // Show toast
      const player = players.find(p => p.id === activePlayerId);
      if (player) {
        if (targetTeamId) {
          const teamName = teams.find(t => t.id === targetTeamId)?.name || 'Team';
          toast.success(`Moved ${player.name} to ${teamName}`);
        } else {
          toast.success(`Moved ${player.name} to Unassigned`);
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
    <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={onExitFullScreen}
            className="flex items-center gap-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="h-6 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-md">
              <Maximize2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-none">Team Builder Hub</h1>
              <p className="text-xs text-gray-500 mt-0.5">Drag and drop to organize teams</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Future: Add Undo/Redo buttons here */}
        </div>
      </div>

      {/* Main Content */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-80 flex-shrink-0 z-20 shadow-xl">
            <PlayerSidebar
              players={unassignedPlayers}
              playerGroups={playerGroups}
            />
          </div>

          {/* Board */}
          <TeamBoard
            teams={teams}
            config={config}
            onTeamNameChange={onTeamNameChange}
          // Add handlers for adding/removing teams if needed in future
          />
        </div>

        {/* Drag Overlay */}
        {createPortal(
          <DragOverlay dropAnimation={dropAnimation}>
            {activePlayer ? (
              <DraggablePlayerCard player={activePlayer} />
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </div>
  );
}
