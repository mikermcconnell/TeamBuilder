import type React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CSVUploader } from '@/components/CSVUploader';

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
});
