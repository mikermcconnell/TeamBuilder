import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BigBoardView } from '@/components/teams/BigBoardView';
import type { LeagueConfig, Team } from '@/types';

const config: LeagueConfig = {
  id: 'league-1',
  name: 'League',
  maxTeamSize: 7,
  minFemales: 1,
  minMales: 1,
  allowMixedGender: true,
  targetTeams: 2,
};

const teams: Team[] = [
  {
    id: 'team-1',
    name: 'Blue Comets',
    color: '#2563eb',
    players: [
      {
        id: 'player-1',
        name: 'Alex Runner',
        gender: 'M',
        skillRating: 7,
        execSkillRating: 8,
        teammateRequests: [],
        avoidRequests: [],
        isHandler: true,
        isNewPlayer: false,
      },
      {
        id: 'player-2',
        name: 'Blair Cutter',
        gender: 'F',
        skillRating: 6,
        execSkillRating: null,
        teammateRequests: [],
        avoidRequests: [],
        isNewPlayer: true,
      },
    ],
    averageSkill: 7,
    genderBreakdown: { M: 1, F: 1, Other: 0 },
    handlerCount: 1,
  },
];

describe('BigBoardView', () => {
  it('renders all teams and compact player signals', () => {
    render(<BigBoardView teams={teams} config={config} draftName="Final Candidate" />);

    expect(screen.getByText('Final Candidate')).toBeInTheDocument();
    expect(screen.getByText('Blue Comets')).toBeInTheDocument();
    expect(screen.getByText('Alex Runner')).toBeInTheDocument();
    expect(screen.getByText('Blair Cutter')).toBeInTheDocument();
    expect(screen.getByText('Exec 8')).toBeInTheDocument();
    expect(screen.getByText('Handler')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Skill scale')).toBeInTheDocument();
    expect(screen.getByText('10 = darkest')).toBeInTheDocument();
    expect(screen.getByLabelText('Blue Comets skill balance versus league average')).toBeInTheDocument();
  });

  it('shows an empty message when there are no teams', () => {
    render(<BigBoardView teams={[]} config={config} draftName="Empty Draft" />);

    expect(screen.getByText('No teams to show yet')).toBeInTheDocument();
  });
});
