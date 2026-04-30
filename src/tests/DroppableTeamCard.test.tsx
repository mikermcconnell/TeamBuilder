import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DroppableTeamCard } from '@/components/DroppableTeamCard';
import type { LeagueConfig, Team } from '@/types';

vi.mock('@dnd-kit/core', () => ({
  useDroppable: ({ id }: { id: string }) => ({
    isOver: false,
    setNodeRef: (node: HTMLElement | null) => {
      if (node) {
        node.setAttribute('data-droppable-id', id);
      }
    },
  }),
}));

const config: LeagueConfig = {
  id: 'league-1',
  name: 'League',
  maxTeamSize: 7,
  minFemales: 1,
  minMales: 1,
  allowMixedGender: true,
  targetTeams: 2,
};

const emptyTeam: Team = {
  id: 'team-1',
  name: 'Team 1',
  players: [],
  averageSkill: 0,
  genderBreakdown: { M: 0, F: 0, Other: 0 },
};

describe('DroppableTeamCard', () => {
  it('registers the whole team card as the drop target', () => {
    const { container } = render(
      <DroppableTeamCard
        team={emptyTeam}
        allPlayers={[]}
        config={config}
        onNameChange={vi.fn()}
      />
    );

    const teamCard = container.querySelector('.relative.h-full.flex.flex-col');

    expect(teamCard).toHaveAttribute('data-droppable-id', emptyTeam.id);
  });
});
