import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TeamBoard } from '@/components/TeamBoard';
import type { LeagueConfig, Player, Team } from '@/types';

vi.mock('@/components/DroppableTeamCard', () => ({
  DroppableTeamCard: ({ team }: { team: Team }) => <div data-testid={`team-${team.id}`}>{team.name}</div>,
}));

function createTeam(): Team {
  return {
    id: 'team-1',
    name: 'Comets',
    players: [],
    averageSkill: 0,
    genderBreakdown: { M: 0, F: 0, Other: 0 },
  };
}

const config: LeagueConfig = {
  id: 'league-1',
  name: 'Spring League',
  maxTeamSize: 14,
  minFemales: 4,
  minMales: 8,
  allowMixedGender: true,
};

describe('TeamBoard', () => {
  it('removes the team board hero and summary while keeping action buttons', () => {
    render(
      <TeamBoard
        teams={[createTeam()]}
        players={[] as Player[]}
        config={config}
        onTeamNameChange={vi.fn()}
        onRefreshBranding={vi.fn()}
        onAddTeam={vi.fn()}
      />
    );

    expect(screen.queryByText('Team Board')).not.toBeInTheDocument();
    expect(screen.queryByText('Draft Summary')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh names & colors/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add team/i })).toBeInTheDocument();
    expect(screen.getByTestId('team-team-1')).toBeInTheDocument();
  });
});
