import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkillDistributionChart } from '@/components/SkillDistributionChart';
import type { Player } from '@/types';

const players: Player[] = [
  {
    id: 'm-1',
    name: 'Mark',
    gender: 'M',
    skillRating: 7,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
  },
  {
    id: 'm-2',
    name: 'Miles',
    gender: 'M',
    skillRating: 8,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
  },
  {
    id: 'f-1',
    name: 'Fiona',
    gender: 'F',
    skillRating: 4,
    execSkillRating: null,
    teammateRequests: [],
    avoidRequests: [],
  },
];

describe('SkillDistributionChart', () => {
  it('lets the user filter the chart by gender', () => {
    render(<SkillDistributionChart players={players} />);

    fireEvent.click(screen.getByRole('button', { name: /skill distribution analysis/i }));

    expect(screen.getByText(/3 players • All players • Mean: 6\.3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Male$/ }));
    expect(screen.getByText(/2 players • Male • Mean: 7\.5/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Female$/ }));
    expect(screen.getByText(/1 players • Female • Mean: 4\.0/)).toBeInTheDocument();
  });

  it('shows a friendly empty state when the selected gender has no players', () => {
    render(
      <SkillDistributionChart
        players={[
          {
            id: 'm-1',
            name: 'Mark',
            gender: 'M',
            skillRating: 7,
            execSkillRating: null,
            teammateRequests: [],
            avoidRequests: [],
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /skill distribution analysis/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Female$/ }));

    expect(screen.getByText(/no female players available for this chart/i)).toBeInTheDocument();
  });
});
