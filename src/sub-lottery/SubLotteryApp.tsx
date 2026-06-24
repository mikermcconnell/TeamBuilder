import React, { useEffect, useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';

import {
  adminImportPlayers,
  adminImportSchedule,
  createCaptainRequest,
  loadSubLotteryState,
  markAvailable,
  runDraw,
} from './api';
import { SubLotteryWorkspace } from './SubLotteryWorkspace';
import type { CreateSubRequestRequest } from './apiContracts';
import type { SubLotteryPublicState } from './types';

const starterState: SubLotteryPublicState = {
  seasonId: 'default-season',
  seasonName: 'Current season',
  players: [],
  requests: [],
  availability: [],
  scheduleEntries: [],
};

export function SubLotteryApp() {
  const [state, setState] = useState<SubLotteryPublicState>(starterState);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = async () => {
    const nextState = await loadSubLotteryState();
    setState(nextState);
  };

  useEffect(() => {
    refresh()
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : 'Could not load the sub lottery.'))
      .finally(() => setLoading(false));
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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f7] text-[#3c3c3c]">
        <div className="rounded-[2rem] border-2 border-zinc-200 bg-white p-8 text-center shadow-sm">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-emerald-600" />
          <div className="text-xl font-black">Loading Sub Squad…</div>
        </div>
      </main>
    );
  }

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
          void runAction(
            () => createCaptainRequest({ ...payload, seasonId: state.seasonId } satisfies CreateSubRequestRequest),
            'Sub need opened. Subs can enter now.',
          );
        }}
        onMarkAvailable={(requestId, playerId) => {
          void runAction(
            () => markAvailable({ requestId, playerId }),
            'You are entered. Good luck!',
          );
        }}
        onRunDraw={(requestId) => {
          void runAction(
            () => runDraw({ requestId }),
            'Lottery complete.',
          );
        }}
      />
      <AdminImportPanel
        seasonId={state.seasonId}
        onImport={(nextState) => setState(nextState)}
        disabled={busy}
        setBusy={setBusy}
        setError={setError}
        setSuccess={setSuccess}
      />
    </>
  );
}

interface AdminImportPanelProps {
  seasonId: string;
  disabled: boolean;
  onImport: (state: SubLotteryPublicState) => void;
  setBusy: (busy: boolean) => void;
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
}

function AdminImportPanel({ seasonId, disabled, onImport, setBusy, setError, setSuccess }: AdminImportPanelProps) {
  const [open, setOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [seasonName, setSeasonName] = useState('Current season');
  const [playersCsvText, setPlayersCsvText] = useState('Name,Pool\nAlice Green,Female\nOwen Orange,Open');
  const [scheduleCsvText, setScheduleCsvText] = useState('Week,Captain,Team,Game Time,Pool\nWeek 1,Morgan,Blue Team,Friday 8 PM,Female\nWeek 1,Casey,Green Team,Friday 9 PM,Open');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
              type="password"
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
