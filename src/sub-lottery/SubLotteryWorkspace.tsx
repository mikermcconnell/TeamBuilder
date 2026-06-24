import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Crown, Sparkles, Trophy, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SubLotteryPlayer, SubLotteryPublicState } from './types';

interface CreateRequestPayload {
  captainPin: string;
  scheduleEntryId: string;
}

interface SubLotteryWorkspaceProps {
  state: SubLotteryPublicState;
  onCreateRequest?: (payload: CreateRequestPayload) => void;
  onMarkAvailable?: (requestId: string, playerId: string) => void;
  onRunDraw?: (requestId: string) => void;
  isBusy?: boolean;
}

function getPoolLabel(pool: 'open' | 'female'): string {
  return pool === 'female' ? 'Female matching' : 'Open matching';
}

function getPlayerName(players: SubLotteryPlayer[], playerId: string | undefined): string {
  if (!playerId) return 'Waiting for draw';
  return players.find(player => player.id === playerId)?.name ?? 'Selected sub';
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function SubLotteryWorkspace({
  state,
  onCreateRequest,
  onMarkAvailable,
  onRunDraw,
  isBusy = false,
}: SubLotteryWorkspaceProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [captainPin, setCaptainPin] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedCaptainName, setSelectedCaptainName] = useState('');

  const activePlayers = useMemo(
    () => state.players.filter(player => player.active).sort((a, b) => a.name.localeCompare(b.name)),
    [state.players]
  );
  const activeScheduleEntries = useMemo(
    () => state.scheduleEntries.filter(entry => entry.active),
    [state.scheduleEntries]
  );
  const weekOptions = useMemo(
    () => uniqueSorted(activeScheduleEntries.map(entry => entry.weekLabel)),
    [activeScheduleEntries]
  );
  const scheduleEntriesForWeek = activeScheduleEntries.filter(entry => entry.weekLabel === selectedWeek);
  const captainOptions = uniqueSorted(scheduleEntriesForWeek.map(entry => entry.captainName));
  const selectedScheduleEntry = scheduleEntriesForWeek.find(entry => entry.captainName === selectedCaptainName) ?? null;
  const existingOpenRequestForSchedule = selectedScheduleEntry
    ? state.requests.find(request => request.scheduleEntryId === selectedScheduleEntry.id && request.status === 'open')
    : null;

  useEffect(() => {
    if (!selectedWeek && weekOptions[0]) {
      setSelectedWeek(weekOptions[0]);
    }
  }, [selectedWeek, weekOptions]);

  useEffect(() => {
    if (!captainOptions.includes(selectedCaptainName)) {
      setSelectedCaptainName(captainOptions[0] ?? '');
    }
  }, [captainOptions, selectedCaptainName]);

  const openRequests = state.requests.filter(request => request.status === 'open');
  const assignedRequests = state.requests.filter(request => request.status === 'assigned');
  const selectedPlayer = state.players.find(player => player.id === selectedPlayerId);
  const matchingOpenRequests = selectedPlayer
    ? openRequests.filter(request => request.pool === selectedPlayer.pool)
    : openRequests;

  const handleCreateRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedScheduleEntry) return;
    onCreateRequest?.({
      captainPin,
      scheduleEntryId: selectedScheduleEntry.id,
    });
  };

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#3c3c3c]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-white shadow-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700">
                <Sparkles className="h-4 w-4" /> Fair sub lottery
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight text-[#2f2f2f] sm:text-5xl">Sub Squad</h1>
                <p className="mt-3 max-w-2xl text-lg font-semibold text-zinc-600">
                  The schedule opens each week. Subs tap in, captains pick their scheduled game, and the app draws fairly from the matching pool.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border-2 border-sky-200 bg-sky-50 p-4">
                <div className="text-3xl font-black text-sky-700">{openRequests.length}</div>
                <div className="text-sm font-extrabold uppercase tracking-wide text-sky-700">Open needs</div>
              </div>
              <div className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-4">
                <div className="text-3xl font-black text-emerald-700">{assignedRequests.length}</div>
                <div className="text-sm font-extrabold uppercase tracking-wide text-emerald-700">Assigned subs</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[2rem] border-2 border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><Users className="h-6 w-6" /></div>
              <div>
                <h2 className="text-2xl font-black">Want to play?</h2>
                <p className="font-semibold text-zinc-500">Pick your name, then tap into a matching weekly need.</p>
              </div>
            </div>

            <label htmlFor="sub-player-select" className="mb-2 block text-sm font-black uppercase tracking-wide text-zinc-500">Pick your name</label>
            <select
              id="sub-player-select"
              value={selectedPlayerId}
              onChange={event => setSelectedPlayerId(event.target.value)}
              className="mb-5 h-12 w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 text-base font-bold outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">Choose your name</option>
              {activePlayers.map(player => (
                <option key={player.id} value={player.id}>{player.name} · {getPoolLabel(player.pool)}</option>
              ))}
            </select>

            <div className="space-y-3">
              {matchingOpenRequests.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-5 text-center font-bold text-zinc-500">
                  No matching weekly needs yet. Check back after captains confirm.
                </div>
              ) : matchingOpenRequests.map(request => {
                const entered = state.availability.some(entry => entry.requestId === request.id && entry.playerId === selectedPlayerId);
                return (
                  <article key={request.id} className="rounded-3xl border-2 border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-lg font-black">{request.teamName}</div>
                        <div className="font-semibold text-zinc-500">{request.weekLabel ? `${request.weekLabel} · ` : ''}{request.gameLabel}</div>
                        <div className="mt-2 inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-sky-700">{getPoolLabel(request.pool)}</div>
                      </div>
                      <button
                        type="button"
                        disabled={!selectedPlayerId || entered || isBusy}
                        onClick={() => onMarkAvailable?.(request.id, selectedPlayerId)}
                        className={cn(
                          'rounded-2xl border-2 px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed',
                          entered
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-emerald-700 bg-[#58cc02] text-white shadow-[0_4px_0_#58a700] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none',
                          !selectedPlayerId && 'opacity-50'
                        )}
                      >
                        {entered ? 'You’re entered' : 'I can play'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-[2rem] border-2 border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Crown className="h-6 w-6" /></div>
              <div>
                <h2 className="text-2xl font-black">Need a sub?</h2>
                <p className="font-semibold text-zinc-500">Choose your week and captain name. The schedule fills in the rest.</p>
              </div>
            </div>

            <form className="grid gap-4" onSubmit={handleCreateRequest}>
              <LabeledInput label="Captain PIN" value={captainPin} onChange={setCaptainPin} type="password" />
              <div className="grid gap-4 sm:grid-cols-2">
                <LabeledSelect label="Week" value={selectedWeek} onChange={setSelectedWeek} options={weekOptions} placeholder="Choose week" />
                <LabeledSelect label="Captain name" value={selectedCaptainName} onChange={setSelectedCaptainName} options={captainOptions} placeholder="Choose captain" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField label="Team name" value={selectedScheduleEntry?.teamName ?? ''} />
                <ReadOnlyField label="Game time" value={selectedScheduleEntry?.gameLabel ?? ''} />
              </div>
              <div className="rounded-2xl border-2 border-sky-100 bg-sky-50 p-4 text-sm font-black text-sky-800">
                {selectedScheduleEntry ? getPoolLabel(selectedScheduleEntry.pool) : 'Upload a schedule to enable captain requests.'}
              </div>

              <button
                type="submit"
                disabled={isBusy || !selectedScheduleEntry || Boolean(existingOpenRequestForSchedule)}
                className="mt-1 rounded-2xl border-2 border-sky-700 bg-[#1cb0f6] px-5 py-4 text-base font-black text-white shadow-[0_4px_0_#1899d6] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-60"
              >
                {existingOpenRequestForSchedule ? 'Sub need already open' : 'Confirm need a sub'}
              </button>
            </form>
          </section>
        </div>

        <section className="rounded-[2rem] border-2 border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><Trophy className="h-6 w-6" /></div>
            <div>
              <h2 className="text-2xl font-black">Results</h2>
              <p className="font-semibold text-zinc-500">Everyone can see who was picked and why the draw is fair.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {state.requests.map(request => (
              <article key={request.id} className="rounded-3xl border-2 border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black">{request.teamName}</div>
                    <div className="text-sm font-bold text-zinc-500">{request.weekLabel ? `${request.weekLabel} · ` : ''}{request.gameLabel} · {getPoolLabel(request.pool)}</div>
                  </div>
                  {request.status === 'assigned' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Clock className="h-5 w-5 text-sky-600" />}
                </div>
                <div className="mt-3 rounded-2xl bg-white p-3 text-sm font-extrabold text-zinc-700">
                  {request.status === 'assigned'
                    ? `${getPlayerName(state.players, request.assignedPlayerId)} won the draw.`
                    : 'Waiting for available subs, then run the lottery.'}
                </div>
                {request.status === 'open' && onRunDraw && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onRunDraw(request.id)}
                    className="mt-3 rounded-2xl border-2 border-amber-600 bg-amber-400 px-4 py-2 text-sm font-black text-white shadow-[0_3px_0_#d69e2e] disabled:opacity-60"
                  >
                    Run lottery
                  </button>
                )}
              </article>
            ))}
          </div>
          <p className="mt-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            Fairness note: players who have subbed less this season get better odds, but everyone entered still has a chance.
          </p>
        </section>
      </div>
    </main>
  );
}

interface LabeledInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}

function LabeledInput({ label, value, onChange, placeholder, type = 'text' }: LabeledInputProps) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-black uppercase tracking-wide text-zinc-500">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 text-base font-bold outline-none transition placeholder:text-zinc-300 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
      />
    </div>
  );
}

interface LabeledSelectProps {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}

function LabeledSelect({ label, value, options, placeholder, onChange }: LabeledSelectProps) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-black uppercase tracking-wide text-zinc-500">{label}</label>
      <select
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 text-base font-bold outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
      >
        <option value="">{placeholder}</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-black uppercase tracking-wide text-zinc-500">{label}</label>
      <input
        id={id}
        value={value}
        readOnly
        className="h-12 w-full rounded-2xl border-2 border-zinc-200 bg-zinc-50 px-4 text-base font-bold text-zinc-600 outline-none"
      />
    </div>
  );
}
