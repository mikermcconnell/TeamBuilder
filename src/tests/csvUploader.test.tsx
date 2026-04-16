import type React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CSVUploader } from '@/components/CSVUploader';
import { getUserRosters } from '@/services/rosterService';

vi.mock('@/services/rosterService', () => ({
  getUserRosters: vi.fn(),
}));

vi.mock('@/services/aiService', () => ({
  findPlayerMatches: vi.fn(async () => []),
}));

vi.mock('@/config/firebase', () => ({
  auth: {
    onAuthStateChanged: (callback: (user: unknown) => void) => {
      callback({ uid: 'user-1' });
      return () => undefined;
    },
    currentUser: { uid: 'user-1' },
  },
}));

vi.mock('@/components/SavedRostersList', () => ({
  SavedRostersList: ({ currentCSVContent, currentPlayerCount }: { currentCSVContent?: string; currentPlayerCount?: number }) => (
    <div data-testid="saved-rosters-props">
      <span>{currentCSVContent || 'no-csv'}</span>
      <span>{currentPlayerCount ?? 'no-count'}</span>
    </div>
  ),
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('CSVUploader', () => {
  it('passes the live roster save data to the saved rosters panel', () => {
    vi.mocked(getUserRosters).mockResolvedValue([]);

    render(
      <CSVUploader
        onPlayersLoaded={vi.fn()}
        currentRosterCsvContent="live-roster-csv"
        currentRosterPlayerCount={4}
      />
    );

    expect(screen.getByTestId('saved-rosters-props')).toHaveTextContent('live-roster-csv');
    expect(screen.getByTestId('saved-rosters-props')).toHaveTextContent('4');
    expect(screen.getByText('Import Wizard')).toBeInTheDocument();
    expect(screen.getByText('Prepare file')).toBeInTheDocument();
    expect(screen.getByText('Review and confirm')).toBeInTheDocument();
  });

  it('marks imported players as new when they are missing from historical rosters', async () => {
    vi.mocked(getUserRosters).mockResolvedValue([
      {
        id: 'roster-1',
        userId: 'user-1',
        name: 'Last Season',
        players: [
          {
            id: 'hist-1',
            name: 'Returning Player',
            gender: 'M',
            skillRating: 6,
            execSkillRating: null,
            teammateRequests: [],
            avoidRequests: [],
            email: 'returning@example.com',
          },
        ],
        version: 1,
      },
    ] as never);

    const { container } = render(
      <CSVUploader
        onPlayersLoaded={vi.fn()}
      />
    );

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();

    const csvFile = new File(
      [
        [
          'Name,Gender,Skill Rating,Email',
          'Returning Player,M,6,returning@example.com',
          'Brand New,F,5,new@example.com',
        ].join('\n'),
      ],
      'players.csv',
      { type: 'text/csv' }
    );

    fireEvent.change(fileInput!, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(screen.getByText('Brand New')).toBeInTheDocument();
    });

    expect(screen.getByText('Detected 1 new player from your historical roster data.')).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });
});
