import React, { useEffect, useState } from 'react';
import { UploadCloud } from 'lucide-react';

import {
  adminImportPlayers,
  adminImportSchedule,
  createCaptainRequest,
  loadSubLotteryState,
  markAvailable,
} from './api';
import { parseSubPlayerCsv, parseSubScheduleCsv } from './core';
import { SubLotteryWorkspace } from './SubLotteryWorkspace';
import type { CreateSubRequestRequest } from './apiContracts';
import type { SubLotteryPublicState } from './types';
import { getWorkflowDeadlinesForGameDate } from './workflow';

const DEFAULT_SEASON_ID = 'default-season';

const samplePlayersCsv = [
  'Name,Pool',
  'Alice Green,Female',
  'Bella Blue,Female',
  'Cara Cloud,Female',
  'Dina Dash,Female',
  'Priya Pine,Female',
  'Owen Orange,Open',
  'Sam Spruce,Open',
  'Noah Navy,Open',
  'Liam Lime,Open',
  'Jordan Jet,Open',
].join('\n');

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getSampleScheduleCsv(referenceDate = new Date()): string {
  const weekOneDate = formatDateOnly(addDays(getWeekStart(referenceDate), 2));
  const weekTwoDate = formatDateOnly(addDays(getWeekStart(referenceDate), 9));

  return [
    'Week,Date,Captain,Team,Game Time,Pool',
    `Week 1,${weekOneDate},Morgan,Blue Team,Friday 8 PM,Female`,
    `Week 1,${weekOneDate},Casey,Green Team,Friday 9 PM,Open`,
    `Week 1,${weekOneDate},Taylor,Red Team,Thursday 7 PM,Female`,
    `Week 1,${weekOneDate},Riley,Yellow Team,Thursday 8 PM,Open`,
    `Week 2,${weekTwoDate},Jamie,Purple Team,Friday 8 PM,Female`,
    `Week 2,${weekTwoDate},Avery,Orange Team,Friday 9 PM,Open`,
  ].join('\n');
}

function getSampleState(referenceDate = new Date()): SubLotteryPublicState {
  return {
    seasonId: DEFAULT_SEASON_ID,
    seasonName: 'Testing season',
    players: parseSubPlayerCsv(samplePlayersCsv),
    requests: [],
    availability: [],
    scheduleEntries: parseSubScheduleCsv(getSampleScheduleCsv(referenceDate)),
    assignments: [],
  };
}

function hasLoadedTestingData(state: SubLotteryPublicState): boolean {
  return state.players.length > 0 && state.scheduleEntries.length > 0;
}

export function SubLotteryApp() {
  const [state, setState] = useState<SubLotteryPublicState>(() => getSampleState());
  const [demoMode, setDemoMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const showAdminTools = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('admin') === '1';

  const refresh = async () => {
    const nextState = await loadSubLotteryState();
    if (hasLoadedTestingData(nextState)) {
      setState(nextState);
      setDemoMode(false);
      return;
    }

    setState(getSampleState());
    setDemoMode(true);
  };

  useEffect(() => {
    refresh()
      .catch(() => {
        setState(getSampleState());
        setDemoMode(true);
      });
  }, []);

  const runAction = async (action: () => Promise<SubLotteryPublicState>, successMessage: string) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const nextState = await action();
      setState(nextState);
      setSuccess(successMessage);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const createDemoRequest = (payload: CreateSubRequestRequest): SubLotteryPublicState => {
    const scheduleEntry = state.scheduleEntries.find(entry => entry.id === payload.scheduleEntryId);
    if (!scheduleEntry) {
      throw new Error('Schedule entry not found.');
    }
    if (!scheduleEntry.gameDate) {
      throw new Error('Schedule entry needs a game date.');
    }
    const deadlines = getWorkflowDeadlinesForGameDate(scheduleEntry.gameDate);
    if (Date.now() > new Date(deadlines.captainClosesAt).getTime()) {
      throw new Error('Captain requests are closed for this week.');
    }

    const existingOpenRequest = state.requests.find(request => (
      request.scheduleEntryId === scheduleEntry.id && request.pool === payload.pool && request.status === 'open'
    ));
    if (existingOpenRequest) {
      throw new Error('A sub need is already open for this scheduled game.');
    }
    const requestedSlots = Number(payload.slotsNeeded);
    if (!Number.isFinite(requestedSlots) || requestedSlots < 1) {
      throw new Error('Choose how many subs are needed.');
    }

    return {
      ...state,
      requests: [
        {
          id: `demo-request-${Date.now()}`,
          seasonId: state.seasonId,
          captainName: scheduleEntry.captainName,
          teamName: scheduleEntry.teamName,
          gameLabel: scheduleEntry.gameLabel,
          pool: payload.pool,
          slotsNeeded: Math.floor(requestedSlots),
          status: 'open',
          openedAt: new Date().toISOString(),
          closesAt: deadlines.availabilityClosesAt,
          availabilityOpensAt: deadlines.availabilityOpensAt,
          availabilityClosesAt: deadlines.availabilityClosesAt,
          drawAt: deadlines.drawAt,
          assignedPlayerIds: [],
          scheduleEntryId: scheduleEntry.id,
          weekLabel: scheduleEntry.weekLabel,
        },
        ...state.requests,
      ],
    };
  };

  const markDemoAvailable = (requestId: string, playerId: string): SubLotteryPublicState => {
    const request = state.requests.find(entry => entry.id === requestId);
    const now = Date.now();
    if (request?.availabilityOpensAt && now < new Date(request.availabilityOpensAt).getTime()) {
      throw new Error('Player entries are not open yet.');
    }
    if (request?.availabilityClosesAt && now > new Date(request.availabilityClosesAt).getTime()) {
      throw new Error('Player entries are closed.');
    }
    const alreadyEntered = state.availability.some(entry => (
      entry.requestId === requestId && entry.playerId === playerId
    ));
    if (alreadyEntered) {
      return state;
    }

    return {
      ...state,
      availability: [
        ...state.availability,
        { requestId, playerId, enteredAt: new Date().toISOString() },
      ],
    };
  };

  const importDemoData = (seasonName: string, playersCsvText: string, scheduleCsvText: string): SubLotteryPublicState => ({
    seasonId: state.seasonId,
    seasonName: seasonName.trim() || 'Testing season',
    players: parseSubPlayerCsv(playersCsvText),
    scheduleEntries: parseSubScheduleCsv(scheduleCsvText),
    requests: [],
    availability: [],
    assignments: [],
  });

  return (
    <>
      {(error || success) && (
        <div className="fixed inset-x-0 top-3 z-50 mx-auto w-[min(92vw,36rem)] rounded-2xl border-2 border-zinc-200 bg-white px-4 py-3 text-center text-sm font-black shadow-lg">
          {error ? <span className="text-red-600">{error}</span> : <span className="text-emerald-700">{success}</span>}
        </div>
      )}
      <SubLotteryWorkspace
        state={state}
        isBusy={busy}
        onCreateRequest={(payload) => {
          if (demoMode) {
            try {
              setState(createDemoRequest(payload));
              setSuccess('Sub need added. Sub players can enter during the Monday lottery window.');
              setError(null);
            } catch (requestError) {
              setError(requestError instanceof Error ? requestError.message : 'Sub need could not be opened.');
              setSuccess(null);
            }
          } else {
            void runAction(
              () => createCaptainRequest({ ...payload, seasonId: state.seasonId } satisfies CreateSubRequestRequest),
              'Sub need opened. Subs can enter now.',
            );
          }
        }}
        onMarkAvailable={(requestId, playerId) => {
          if (demoMode) {
            try {
              setState(markDemoAvailable(requestId, playerId));
              setSuccess('You are in the lottery.');
              setError(null);
            } catch (availabilityError) {
              setError(availabilityError instanceof Error ? availabilityError.message : 'Could not enter this request.');
              setSuccess(null);
            }
          } else {
            void runAction(
              () => markAvailable({ requestId, playerId }),
              'You are entered. Good luck!',
            );
          }
        }}
      />
      {showAdminTools && (
        <AdminImportPanel
          seasonId={state.seasonId}
          onImport={(nextState) => setState(nextState)}
          onDemoImport={(seasonName, playersCsvText, scheduleCsvText) => {
            setState(importDemoData(seasonName, playersCsvText, scheduleCsvText));
            setSuccess('Testing data loaded.');
            setError(null);
          }}
          demoMode={demoMode}
          disabled={busy}
          setBusy={setBusy}
          setError={setError}
          setSuccess={setSuccess}
        />
      )}
    </>
  );
}

interface AdminImportPanelProps {
  seasonId: string;
  demoMode: boolean;
  disabled: boolean;
  onImport: (state: SubLotteryPublicState) => void;
  onDemoImport: (seasonName: string, playersCsvText: string, scheduleCsvText: string) => void;
  setBusy: (busy: boolean) => void;
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
}

function AdminImportPanel({ seasonId, demoMode, disabled, onImport, onDemoImport, setBusy, setError, setSuccess }: AdminImportPanelProps) {
  const [open, setOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [seasonName, setSeasonName] = useState('Current season');
  const [playersCsvText, setPlayersCsvText] = useState(samplePlayersCsv);
  const [scheduleCsvText, setScheduleCsvText] = useState(() => getSampleScheduleCsv());

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (demoMode) {
      onDemoImport(seasonName, playersCsvText, scheduleCsvText);
      setOpen(false);
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const playerState = await adminImportPlayers({ seasonId, adminPin, seasonName, csvText: playersCsvText });
      const nextState = await adminImportSchedule({ seasonId: playerState.seasonId, adminPin, seasonName, csvText: scheduleCsvText });
      onImport(nextState);
      setSuccess('Sub list and schedule imported.');
      setOpen(false);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="bg-[#f7f7f7] px-4 pb-8">
      <div className="mx-auto max-w-6xl rounded-[2rem] border-2 border-dashed border-zinc-300 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-black text-zinc-700"
        >
          <UploadCloud className="h-4 w-4" /> Admin: load sub list and schedule
        </button>
        {open && (
          <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
            <input
              value={adminPin}
              onChange={event => setAdminPin(event.target.value)}
              placeholder="Admin PIN"
              type="text"
              className="h-11 rounded-2xl border-2 border-zinc-200 px-4 font-bold outline-none focus:border-emerald-400"
            />
            <input
              value={seasonName}
              onChange={event => setSeasonName(event.target.value)}
              placeholder="Season name"
              className="h-11 rounded-2xl border-2 border-zinc-200 px-4 font-bold outline-none focus:border-emerald-400"
            />
            <label className="text-sm font-black uppercase tracking-wide text-zinc-500">Sub list CSV</label>
            <textarea
              value={playersCsvText}
              onChange={event => setPlayersCsvText(event.target.value)}
              rows={5}
              className="rounded-2xl border-2 border-zinc-200 p-4 font-mono text-sm outline-none focus:border-emerald-400"
            />
            <label className="text-sm font-black uppercase tracking-wide text-zinc-500">Schedule CSV</label>
            <textarea
              value={scheduleCsvText}
              onChange={event => setScheduleCsvText(event.target.value)}
              rows={5}
              className="rounded-2xl border-2 border-zinc-200 p-4 font-mono text-sm outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={disabled}
              className="rounded-2xl border-2 border-emerald-700 bg-[#58cc02] px-5 py-3 font-black text-white shadow-[0_4px_0_#58a700] disabled:opacity-60"
            >
              Import players and schedule
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
