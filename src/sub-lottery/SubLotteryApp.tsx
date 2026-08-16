import React, { useEffect, useState } from 'react';
import { TestTube2, UploadCloud } from 'lucide-react';

import {
  adminImportPlayers,
  adminImportSchedule,
  cancelCaptainRequest,
  createCaptainRequest,
  loadSubLotteryState,
  loadTestingWeek,
  markAvailable,
  runTestingDraw,
  updateCaptainRequest,
  updatePreferences,
} from './api';
import { parseSubPlayerCsv, parseSubScheduleCsv } from './core';
import { SubLotteryWorkspace } from './SubLotteryWorkspace';
import type { CreateSubRequestRequest } from './apiContracts';
import type { SubLotteryPublicState } from './types';
import { getTestingPhaseDateForState, type SubLotteryTestingPhase } from './testingFixtures';
import { SubLotteryAdmin } from './SubLotteryAdmin';
import { SubLotteryRespond } from './SubLotteryRespond';

const DEFAULT_SEASON_ID = 'default-season';

const EMPTY_STATE: SubLotteryPublicState = {
  seasonId: DEFAULT_SEASON_ID,
  seasonName: 'Current season',
  players: [],
  requests: [],
  availability: [],
  scheduleEntries: [],
  assignments: [],
};

const samplePlayersCsv = [
  'Name,Pool,Email',
  'Alice Green,Female,alice@example.com',
  'Bella Blue,Female,bella@example.com',
  'Cara Cloud,Female,cara@example.com',
  'Dina Dash,Female,dina@example.com',
  'Priya Pine,Female,priya@example.com',
  'Owen Orange,Open,owen@example.com',
  'Sam Spruce,Open,sam@example.com',
  'Noah Navy,Open,noah@example.com',
  'Liam Lime,Open,liam@example.com',
  'Jordan Jet,Open,jordan@example.com',
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
    'Week,Date,Captain,Captain Email,Team,Game Time',
    `Week 1,${weekOneDate},Morgan,morgan@example.com,Blue Team,Friday 8 PM`,
    `Week 1,${weekOneDate},Casey,casey@example.com,Green Team,Friday 9 PM`,
    `Week 1,${weekOneDate},Taylor,taylor@example.com,Red Team,Thursday 7 PM`,
    `Week 1,${weekOneDate},Riley,riley@example.com,Yellow Team,Thursday 8 PM`,
    `Week 2,${weekTwoDate},Jamie,jamie@example.com,Purple Team,Friday 8 PM`,
    `Week 2,${weekTwoDate},Avery,avery@example.com,Orange Team,Friday 9 PM`,
  ].join('\n');
}

export function SubLotteryApp() {
  if (window.location.pathname === '/sub-lottery/admin') return <SubLotteryAdmin />;
  if (window.location.pathname === '/sub-lottery/respond') return <SubLotteryRespond />;
  return <SubLotteryMainApp />;
}

function SubLotteryMainApp() {
  const [state, setState] = useState<SubLotteryPublicState>(EMPTY_STATE);
  const [demoMode, setDemoMode] = useState(false);
  const [testingPhase, setTestingPhase] = useState<SubLotteryTestingPhase>('captain');
  const [testingCurrentDate, setTestingCurrentDate] = useState<Date | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const showAdminTools = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('admin') === '1';
  const showTestingTools = import.meta.env.DEV;

  const refresh = async () => {
    const nextState = await loadSubLotteryState();
    setState(nextState);
  };

  useEffect(() => {
    refresh()
      .catch(() => {
        setState(EMPTY_STATE);
      });
  }, []);

  const selectTestingPhase = (phase: SubLotteryTestingPhase, testingState = state) => {
    setTestingPhase(phase);
    setTestingCurrentDate(getTestingPhaseDateForState(testingState, phase));
    setError(null);
    setSuccess(null);
  };

  const toggleTestingMode = async () => {
    if (demoMode) {
      setDemoMode(false);
      setTestingCurrentDate(undefined);
      setState(EMPTY_STATE);
      void refresh().catch(() => setState(EMPTY_STATE));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const nextState = await loadTestingWeek();
      setState(nextState);
      setDemoMode(true);
      selectTestingPhase(nextState.assignments.length > 0 ? 'results' : 'player', nextState);
      setSuccess('Saved Firebase testing week loaded.');
    } catch (testingError) {
      setError(testingError instanceof Error ? testingError.message : 'Testing week could not be loaded.');
    } finally {
      setBusy(false);
    }
  };

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

  const runSavedTestingDraw = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const nextState = await runTestingDraw({ seasonId: state.seasonId });
      setState(nextState);
      selectTestingPhase('results', nextState);
      setSuccess('Testing draw completed and winners were saved to Firebase.');
    } catch (drawError) {
      setError(drawError instanceof Error ? drawError.message : 'Testing draw could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const resetSavedTestingWeek = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const nextState = await loadTestingWeek({ reset: true });
      setState(nextState);
      selectTestingPhase('player', nextState);
      setSuccess('Testing week reset in Firebase.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Testing week could not be reset.');
    } finally {
      setBusy(false);
    }
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
      <div className="absolute left-4 top-4 z-20"><a href="/sub-lottery/admin" className="rounded-xl border-2 border-zinc-300 bg-white px-3 py-2 text-xs font-black text-zinc-600 shadow-sm">Admin</a></div>
      {showTestingTools && <TestingControls
        enabled={demoMode}
        phase={testingPhase}
        busy={busy}
        state={state}
        onToggle={() => void toggleTestingMode()}
        onSelectPhase={selectTestingPhase}
        onRunDraw={() => void runSavedTestingDraw()}
        onReset={() => void resetSavedTestingWeek()}
      />}
      <SubLotteryWorkspace
        state={state}
        isBusy={busy}
        demoMode={demoMode}
        currentDate={testingCurrentDate}
        onCreateRequest={(payloads) => {
          void runAction(
            async () => {
              let nextState = state;
              for (const payload of payloads) {
                nextState = await createCaptainRequest({
                  ...payload,
                  seasonId: state.seasonId,
                } satisfies CreateSubRequestRequest);
              }
              return nextState;
            },
            `${payloads.length === 1 ? 'Sub need' : `${payloads.length} sub needs`} saved. Subs can enter during the Monday lottery window.`,
          );
        }}
        onMarkAvailable={(requestId, playerId) => {
          void runAction(
            () => markAvailable({ requestId, playerId }),
            demoMode ? 'Testing entry saved to Firebase.' : 'You are entered. Good luck!',
          );
        }}
        onUpdatePreferences={(playerId, requestIds) => {
          void runAction(() => updatePreferences({ playerId, requestIds }), 'Your ranked choices were saved.');
        }}
        onUpdateRequest={(payload) => {
          void runAction(async () => {
            try { return await updateCaptainRequest(payload); }
            catch (editError) {
              if (editError instanceof Error && editError.message === 'MERGE_CONFIRMATION_REQUIRED' && window.confirm('A request for that pool already exists. Merge the quantities?')) return updateCaptainRequest({ ...payload, confirmMerge: true });
              throw editError;
            }
          }, 'Sub need updated.');
        }}
        onCancelRequest={({ requestId, captainPin }) => {
          void runAction(
            () => cancelCaptainRequest({ requestId, captainPin }),
            'Sub need cancelled.',
          );
        }}
      />
      {showAdminTools && !demoMode && (
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

function TestingControls({
  enabled,
  phase,
  busy,
  state,
  onToggle,
  onSelectPhase,
  onRunDraw,
  onReset,
}: {
  enabled: boolean;
  phase: SubLotteryTestingPhase;
  busy: boolean;
  state: SubLotteryPublicState;
  onToggle: () => void;
  onSelectPhase: (phase: SubLotteryTestingPhase) => void;
  onRunDraw: () => void;
  onReset: () => void;
}) {
  const phases: Array<{ value: SubLotteryTestingPhase; label: string; time: string }> = [
    { value: 'captain', label: 'Captains ask', time: 'Friday noon' },
    { value: 'player', label: 'Subs enter', time: 'Monday 9 AM' },
  ];
  const openRequestCount = state.requests.filter(request => request.status === 'open').length;
  const hasResults = state.assignments.length > 0;

  return (
    <div className="flex w-full justify-end bg-[#f7f7f7] px-4 pt-4 sm:px-6">
      <div className="flex max-w-full flex-col items-end gap-2">
      <button
        type="button"
        aria-pressed={enabled}
        disabled={busy}
        onClick={onToggle}
        className={`flex items-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-black shadow-lg transition focus:outline-none focus:ring-4 focus:ring-purple-200 ${enabled
          ? 'border-purple-700 bg-purple-600 text-white'
          : 'border-zinc-300 bg-white text-zinc-700 hover:border-purple-400'}`}
      >
        <TestTube2 className="h-4 w-4" /> Testing {enabled ? 'on' : 'off'}
      </button>
      {enabled && (
        <div className="w-[min(32rem,calc(100vw-1.5rem))] rounded-3xl border-2 border-purple-200 bg-white p-3 shadow-xl">
          <div className="px-1 pb-2 text-xs font-bold text-zinc-600">
            {state.seasonName} · saved separately in Firebase
          </div>
          <div className="grid grid-cols-2 gap-2" aria-label="Testing time window">
            {phases.map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={phase === option.value}
                onClick={() => onSelectPhase(option.value)}
                className={`rounded-2xl border-2 px-2 py-2 text-center transition ${phase === option.value
                  ? 'border-purple-600 bg-purple-50 text-purple-900'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-purple-300'}`}
              >
                <span className="block text-xs font-black sm:text-sm">{option.label}</span>
                <span className="block text-[10px] font-bold sm:text-xs">{option.time}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || openRequestCount === 0 || state.availability.length === 0}
            onClick={onRunDraw}
            className="mt-3 w-full rounded-2xl border-2 border-amber-700 bg-amber-400 px-4 py-3 text-sm font-black text-amber-950 shadow-[0_3px_0_#b45309] disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none"
          >
            {hasResults ? 'Draw already completed' : 'Run draw and show winners'}
          </button>
          {!hasResults && state.availability.length === 0 && (
            <div className="mt-2 text-center text-xs font-bold text-amber-800">Enter at least one dummy sub before running the draw.</div>
          )}
          {hasResults && (
            <button
              type="button"
              onClick={() => onSelectPhase('results')}
              className="mt-2 w-full rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800"
            >
              Show saved results
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Reset this Firebase testing week? All testing entries and winners for this week will be cleared.')) {
                onReset();
              }
            }}
            className="mt-3 w-full rounded-xl px-3 py-2 text-xs font-black text-zinc-500 underline decoration-zinc-300 underline-offset-2"
          >
            Reset this testing week
          </button>
        </div>
      )}
      </div>
    </div>
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
