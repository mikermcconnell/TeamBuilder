import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Crown, Sparkles, Trophy, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatCountdown, getSubLotteryCoins, getSubLotteryWorkflowState, getWorkflowScheduleWeekLabel, SUB_LOTTERY_TIME_ZONE } from './workflow';
import type { SubLotteryPlayer, SubLotteryPool, SubLotteryPublicState, SubLotteryRequest } from './types';

interface CreateRequestPayload {
  captainPin: string;
  scheduleEntryId: string;
  pool: SubLotteryPool;
  slotsNeeded: number;
}

interface SubLotteryWorkspaceProps {
  state: SubLotteryPublicState;
  onCreateRequest?: (payload: CreateRequestPayload) => void;
  onMarkAvailable?: (requestId: string, playerId: string) => void;
  isBusy?: boolean;
  currentDate?: Date;
}

function getPoolLabel(pool: 'open' | 'female'): string {
  return pool === 'female' ? 'Female matching' : 'Open matching';
}

function getPlayerName(players: SubLotteryPlayer[], playerId: string | undefined): string {
  if (!playerId) return 'Waiting for draw';
  return players.find(player => player.id === playerId)?.name ?? 'Selected sub';
}

function getPlayerNames(players: SubLotteryPlayer[], playerIds: string[] | undefined): string {
  if (!playerIds || playerIds.length === 0) return 'No eligible subs entered.';
  return playerIds.map(playerId => getPlayerName(players, playerId)).join(', ');
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function formatDeadline(iso: string | undefined): string {
  if (!iso) return 'After the draw';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SUB_LOTTERY_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatLocalDateFromDateOnly(dateOnly: string): string {
  const [year = 0, month = 1, day = 1] = dateOnly.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function SubLotteryWorkspace({
  state,
  onCreateRequest,
  onMarkAvailable,
  isBusy = false,
  currentDate = new Date(),
}: SubLotteryWorkspaceProps) {
  const [selectedPlayerName, setSelectedPlayerName] = useState('');
  const [captainPin, setCaptainPin] = useState('');
  const [selectedCaptainName, setSelectedCaptainName] = useState('');
  const [selectedRequestPool, setSelectedRequestPool] = useState<SubLotteryPool | null>(null);
  const [slotsNeeded, setSlotsNeeded] = useState('1');

  const activePlayers = useMemo(
    () => state.players.filter(player => player.active).sort((a, b) => a.name.localeCompare(b.name)),
    [state.players]
  );
  const activeScheduleEntries = useMemo(
    () => state.scheduleEntries.filter(entry => entry.active),
    [state.scheduleEntries]
  );
  const workflow = getSubLotteryWorkflowState(currentDate);
  const currentWeekLabel = getWorkflowScheduleWeekLabel(activeScheduleEntries, currentDate);
  const scheduleEntriesForWeek = activeScheduleEntries.filter(entry => entry.weekLabel === currentWeekLabel);
  const captainOptions = uniqueSorted(scheduleEntriesForWeek.map(entry => entry.captainName));
  const selectedScheduleEntry = scheduleEntriesForWeek.find(entry => normalizeName(entry.captainName) === normalizeName(selectedCaptainName)) ?? null;
  const existingOpenRequestForSchedule = selectedScheduleEntry
    ? state.requests.find(request => request.scheduleEntryId === selectedScheduleEntry.id && request.pool === selectedRequestPool && request.status === 'open')
    : null;
  const isCaptainPhase = workflow.phase === 'captain';
  const isPlayerPhase = workflow.phase === 'player';

  const openRequests = state.requests.filter(request => request.status === 'open');
  const assignedRequests = state.requests.filter(request => request.status === 'assigned');
  const selectedPlayer = activePlayers.find(player => normalizeName(player.name) === normalizeName(selectedPlayerName));
  const matchingOpenRequests = selectedPlayer
    ? openRequests.filter(request => request.pool === selectedPlayer.pool)
    : openRequests;
  const captainDisableReason = !isCaptainPhase
    ? 'Captain requests are closed for this week.'
    : !selectedScheduleEntry
      ? 'Choose your captain name to load your game.'
      : !selectedRequestPool
        ? 'Choose open matching or female matching.'
        : Number(slotsNeeded) < 1
          ? 'Enter at least 1 sub.'
          : existingOpenRequestForSchedule
            ? 'This need is already added.'
            : '';
  const getEntryCount = (request: SubLotteryRequest) => state.availability
    .filter(entry => entry.requestId === request.id)
    .length;

  const handleCreateRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedScheduleEntry || !selectedRequestPool) return;
    onCreateRequest?.({
      captainPin,
      scheduleEntryId: selectedScheduleEntry.id,
      pool: selectedRequestPool,
      slotsNeeded: Math.max(1, Math.floor(Number(slotsNeeded) || 0)),
    });
  };

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#3c3c3c]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border-2 border-emerald-200 bg-white shadow-sm">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border-2 border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-700">
                <Sparkles className="h-4 w-4" /> Sub lottery
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight text-[#2f2f2f] sm:text-5xl">Sub Squad</h1>
                <p className="mt-3 max-w-2xl text-lg font-semibold text-zinc-600">
                  Captains say who they need by Sunday night. Sub players pick the games they can play Monday morning. The app draws names at 12:01 PM.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border-2 border-sky-200 bg-sky-50 p-4">
                <div className="text-3xl font-black text-sky-700">{openRequests.length}</div>
                <div className="text-sm font-extrabold uppercase tracking-wide text-sky-700">Teams needing subs</div>
              </div>
              <div className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-4">
                <div className="text-3xl font-black text-emerald-700">{assignedRequests.length}</div>
                <div className="text-sm font-extrabold uppercase tracking-wide text-emerald-700">Assigned subs</div>
              </div>
            </div>
          </div>
        </section>

        <WorkflowStepper workflow={workflow} />

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[2rem] border-2 border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><Users className="h-6 w-6" /></div>
              <div>
                <h2 className="text-2xl font-black">Sub players: join a draw</h2>
                <p className="font-semibold text-zinc-500">
                  {isPlayerPhase
                    ? 'Pick your name, then enter the lottery for games you can play.'
                    : `Sub players can enter lotteries ${formatDeadline(workflow.availabilityOpensAt)} to ${formatDeadline(workflow.availabilityClosesAt)}.`}
                </p>
              </div>
            </div>

            <div className="mb-5">
              <LabeledTypeahead
                label="Pick your name"
                listId="sub-player-suggestions"
                value={selectedPlayerName}
                onChange={setSelectedPlayerName}
                placeholder="Start typing your name"
                options={activePlayers.map(player => ({
                  value: player.name,
                  label: getPoolLabel(player.pool),
                }))}
                focusColor="emerald"
              />
            </div>

            <div className="space-y-3">
              {matchingOpenRequests.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-5 text-center font-bold text-zinc-500">
                  {selectedPlayer
                    ? 'No matching games yet. Check back after captains add their sub needs.'
                    : 'Pick your name first. We will show the games that match your sub pool.'}
                </div>
              ) : matchingOpenRequests.map(request => {
                const entered = Boolean(selectedPlayer && state.availability.some(entry => entry.requestId === request.id && entry.playerId === selectedPlayer.id));
                const entryCount = getEntryCount(request);
                return (
                  <article key={request.id} className="rounded-3xl border-2 border-zinc-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-lg font-black">{request.teamName}</div>
                        <div className="font-semibold text-zinc-500">{request.weekLabel ? `${request.weekLabel} · ` : ''}{request.gameLabel}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-sky-700">{getPoolLabel(request.pool)}</span>
                          <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-700">{request.slotsNeeded ?? 1} needed</span>
                          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">{entryCount} in lottery</span>
                        </div>
                        {selectedPlayer && (
                          <div className="mt-2 text-xs font-bold text-zinc-500">You match this game.</div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!isPlayerPhase || !selectedPlayer || entered || isBusy}
                        onClick={() => selectedPlayer && onMarkAvailable?.(request.id, selectedPlayer.id)}
                        className={cn(
                          'rounded-2xl border-2 px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed',
                          entered
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-emerald-700 bg-[#58cc02] text-white shadow-[0_4px_0_#58a700] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none',
                          (!isPlayerPhase || !selectedPlayer) && 'opacity-50'
                        )}
                      >
                        {entered ? "You are in the lottery" : isPlayerPhase ? 'Enter lottery' : 'Lottery opens Monday'}
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
                <h2 className="text-2xl font-black">Captains: add a sub need</h2>
                <p className="font-semibold text-zinc-500">
                  {isCaptainPhase ? `Add your sub needs before ${formatDeadline(workflow.captainClosesAt)}.` : 'Captain requests are closed for this week.'}
                </p>
              </div>
            </div>

            <form className="grid gap-4" onSubmit={handleCreateRequest}>
              <LabeledInput label="Captain PIN" value={captainPin} onChange={setCaptainPin} />
              <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4 text-sm font-black text-emerald-800">
                Game week: {currentWeekLabel ?? 'No games found for this week'}
              </div>
              <LabeledTypeahead
                label="Captain name"
                listId="captain-name-suggestions"
                value={selectedCaptainName}
                onChange={setSelectedCaptainName}
                placeholder="Start typing captain name"
                options={captainOptions.map(name => ({ value: name }))}
                focusColor="sky"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField label="Team name" value={selectedScheduleEntry?.teamName ?? ''} />
                <ReadOnlyField label="Game time" value={selectedScheduleEntry?.gameLabel ?? ''} />
              </div>
              <PoolCheckboxes selectedPool={selectedRequestPool} onChange={setSelectedRequestPool} />
              <LabeledInput label="Number of subs needed" value={slotsNeeded} onChange={setSlotsNeeded} type="number" min={1} />

              <button
                type="submit"
                disabled={isBusy || !isCaptainPhase || !selectedScheduleEntry || !selectedRequestPool || Number(slotsNeeded) < 1 || Boolean(existingOpenRequestForSchedule)}
                className="mt-1 rounded-2xl border-2 border-sky-700 bg-[#1cb0f6] px-5 py-4 text-base font-black text-white shadow-[0_4px_0_#1899d6] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none"
              >
                {!isCaptainPhase ? 'Captain window closed' : existingOpenRequestForSchedule ? 'This need is already added' : 'Add sub need'}
              </button>
              {captainDisableReason && (
                <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                  {captainDisableReason}
                </div>
              )}
            </form>
          </section>
        </div>

        <section className="rounded-[2rem] border-2 border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><Trophy className="h-6 w-6" /></div>
            <div>
              <h2 className="text-2xl font-black">Results</h2>
              <p className="font-semibold text-zinc-500">See which subs were picked after the Monday draw.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {state.requests.map(request => (
              <article key={request.id} className="rounded-3xl border-2 border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black">{request.teamName}</div>
                    <div className="text-sm font-bold text-zinc-500">
                      {request.weekLabel ? `${request.weekLabel} · ` : ''}{request.gameLabel} · {getPoolLabel(request.pool)} · {request.slotsNeeded ?? 1} needed
                    </div>
                  </div>
                  {request.status === 'assigned' ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Clock className="h-5 w-5 text-sky-600" />}
                </div>
                <div className="mt-3 rounded-2xl bg-white p-3 text-sm font-extrabold text-zinc-700">
                  {request.status === 'assigned'
                    ? `${getPlayerNames(state.players, request.assignedPlayerIds ?? (request.assignedPlayerId ? [request.assignedPlayerId] : []))} ${request.assignedPlayerIds?.length ? 'won the draw.' : ''}`
                    : `${getEntryCount(request)} sub player${getEntryCount(request) === 1 ? '' : 's'} entered. Waiting for the draw.`}
                  {request.assignedAt && (
                    <div className="mt-1 text-xs font-bold text-zinc-500">Draw completed {formatDeadline(request.assignedAt)}</div>
                  )}
                </div>
              </article>
            ))}
          </div>
          <p className="mt-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            Lottery note: every sub player starts with 5 coins. Each time they sub, they use 1 coin. Everyone always keeps at least 1 coin, so everyone still has a chance.
          </p>
        </section>

        <section className="rounded-[2rem] border-2 border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-2xl font-black">Sub history</h2>
          <p className="mb-4 font-semibold text-zinc-500">See who has subbed this season and how many lottery coins they have left.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {activePlayers.map(player => (
              <div key={player.id} className="rounded-3xl border-2 border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-black">{player.name}</div>
                    <div className="text-sm font-bold text-zinc-500">{getPoolLabel(player.pool)}</div>
                  </div>
                  <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-3 py-2 text-sm font-black text-amber-800">
                    {getSubLotteryCoins(player.seasonSubCount)} coins
                  </div>
                </div>
                <div className="mt-2 text-sm font-bold text-zinc-600">{player.seasonSubCount} season sub{player.seasonSubCount === 1 ? '' : 's'}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function WorkflowStepper({ workflow }: { workflow: ReturnType<typeof getSubLotteryWorkflowState> }) {
  const gameDateLabel = `${formatLocalDateFromDateOnly(workflow.targetWeekStartDate)} evening`;
  const steps = [
    { title: 'Captains ask for subs', detail: `By ${formatDeadline(workflow.captainClosesAt)}` },
    { title: 'Sub players enter lottery', detail: `${formatDeadline(workflow.availabilityOpensAt)} to ${formatDeadline(workflow.availabilityClosesAt)}` },
    { title: 'Draw runs', detail: formatDeadline(workflow.drawAt) },
    { title: 'Results are shared', detail: 'After the draw' },
  ];

  return (
    <section className="rounded-[2rem] border-2 border-sky-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black">This week's plan</h2>
          <p className="font-semibold text-zinc-500">See what is open now and what happens next.</p>
        </div>
        <div className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 px-5 py-3 text-center">
          <div className="text-xs font-black uppercase tracking-wide text-emerald-700">{workflow.nextDeadlineLabel}</div>
          <div className="text-2xl font-black text-emerald-800">{formatCountdown(workflow.nextDeadlineAt)}</div>
          <div className="text-xs font-bold text-emerald-700">{formatDeadline(workflow.nextDeadlineAt)}</div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const isActive = workflow.activeStepIndex === index;
          const isComplete = workflow.activeStepIndex > index;
          return (
            <div
              key={step.title}
              className={cn(
                'rounded-3xl border-2 p-4',
                isActive && 'border-sky-500 bg-sky-50 ring-4 ring-sky-100',
                isComplete && 'border-emerald-200 bg-emerald-50',
                !isActive && !isComplete && 'border-zinc-200 bg-zinc-50'
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-black text-zinc-500">Part {index + 1}</div>
                {isComplete ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Clock className="h-5 w-5 text-sky-600" />}
              </div>
              <div className="font-black text-zinc-800">{step.title}</div>
              <div className="text-sm font-bold text-zinc-500">{step.detail}</div>
            </div>
          );
        })}
      </div>
      <WeekTimeline activeStepIndex={workflow.activeStepIndex} gameDateLabel={gameDateLabel} />
    </section>
  );
}

function WeekTimeline({ activeStepIndex, gameDateLabel }: { activeStepIndex: number; gameDateLabel: string }) {
  const timelineItems = [
    { label: 'Captain deadline', time: 'Sunday night', position: 8 },
    { label: 'Lottery opens', time: 'Monday morning', position: 32 },
    { label: 'Draw runs', time: 'Monday 12:01 PM', position: 55 },
    { label: 'Results shared', time: 'Monday afternoon', position: 73 },
    { label: 'Game time', time: gameDateLabel, position: 100 },
  ];
  const progressByStep = [8, 32, 55, 73, 100];
  const progressPercent = progressByStep[Math.min(activeStepIndex, progressByStep.length - 1)] ?? 8;

  return (
    <div className="mt-5 rounded-3xl border-2 border-zinc-200 bg-zinc-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black uppercase tracking-wide text-zinc-500">Week timeline</div>
          <div className="text-sm font-bold text-zinc-600">The week ends at Monday evening game time.</div>
        </div>
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
          Game time = finish
        </div>
      </div>

      <div className="relative mt-7 hidden h-28 sm:block">
        <div
          className="absolute left-0 right-0 top-2 h-4 rounded-full border-2 border-zinc-200 bg-white"
          role="progressbar"
          aria-label="Week timeline progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div
            className="h-full rounded-full bg-[#58cc02]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {timelineItems.map((item, index) => {
          const isReached = progressPercent >= item.position;
          return (
            <div
              key={item.label}
              className="absolute top-4 flex flex-col items-center"
              style={{
                left: `${item.position}%`,
                transform: item.position === 100 ? 'translate(-100%, -50%)' : 'translate(-50%, -50%)',
              }}
            >
              <div
                className={cn(
                  'h-5 w-5 rounded-full border-2',
                  isReached ? 'border-emerald-700 bg-[#58cc02]' : 'border-zinc-300 bg-white'
                )}
              />
              <div className={cn(
                'mt-2 w-28 text-center text-[11px] font-black leading-tight',
                isReached ? 'text-emerald-800' : 'text-zinc-500'
              )}>
                {item.label}
              </div>
              <div className="w-28 text-center text-[10px] font-bold text-zinc-500">{item.time}</div>
              <span className="sr-only">{`Part ${index + 1}: ${item.label}, ${item.time}`}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2 text-xs font-bold text-zinc-600 sm:hidden">
        {timelineItems.map((item, index) => {
          const isReached = progressPercent >= item.position;
          return (
            <div key={item.label} className="grid grid-cols-[1.5rem_1fr] items-center gap-2 rounded-2xl bg-white px-3 py-2">
              <div className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-black',
                isReached ? 'border-emerald-700 bg-[#58cc02] text-white' : 'border-zinc-300 bg-white text-zinc-500'
              )}>
                {index + 1}
              </div>
              <div>
                <div className="font-black text-zinc-800">{item.label}</div>
                <div>{item.time}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 sm:hidden">
        <div
          className="h-4 rounded-full border-2 border-zinc-200 bg-white"
          role="progressbar"
          aria-label="Week timeline progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div
            className="h-full rounded-full bg-[#58cc02]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function PoolCheckboxes({
  selectedPool,
  onChange,
}: {
  selectedPool: SubLotteryPool | null;
  onChange: (pool: SubLotteryPool) => void;
}) {
  const options: Array<{ pool: SubLotteryPool; label: string; help: string }> = [
    { pool: 'open', label: 'Open matching sub', help: 'Players listed as open matching can enter.' },
    { pool: 'female', label: 'Female matching sub', help: 'Only players listed as female matching can enter.' },
  ];

  return (
    <fieldset className="rounded-2xl border-2 border-sky-100 bg-sky-50 p-4">
      <legend className="mb-3 text-sm font-black uppercase tracking-wide text-sky-800">Choose the kind of sub you need</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map(option => (
          <label
            key={option.pool}
            className={cn(
              'flex cursor-pointer gap-3 rounded-2xl border-2 bg-white p-4 transition',
              selectedPool === option.pool ? 'border-sky-500 ring-4 ring-sky-100' : 'border-zinc-200'
            )}
          >
            <input
              type="checkbox"
              checked={selectedPool === option.pool}
              onChange={() => onChange(option.pool)}
              className="mt-1 h-5 w-5 rounded border-zinc-300 text-sky-600 focus:ring-sky-400"
            />
            <span>
              <span className="block text-sm font-black text-zinc-800">{option.label}</span>
              <span className="mt-1 block text-xs font-bold text-zinc-500">{option.help}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface LabeledInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
}

function LabeledInput({ label, value, onChange, placeholder, type = 'text', min }: LabeledInputProps) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-black uppercase tracking-wide text-zinc-500">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        min={min}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 text-base font-bold outline-none transition placeholder:text-zinc-300 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
      />
    </div>
  );
}

interface TypeaheadOption {
  value: string;
  label?: string;
}

interface LabeledTypeaheadProps {
  label: string;
  value: string;
  placeholder: string;
  listId: string;
  options: TypeaheadOption[];
  onChange: (value: string) => void;
  focusColor?: 'emerald' | 'sky';
}

function LabeledTypeahead({
  label,
  value,
  placeholder,
  listId,
  options,
  onChange,
  focusColor = 'sky',
}: LabeledTypeaheadProps) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const focusClasses = focusColor === 'emerald'
    ? 'focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100'
    : 'focus:border-sky-400 focus:ring-4 focus:ring-sky-100';

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-black uppercase tracking-wide text-zinc-500">{label}</label>
      <input
        id={id}
        list={listId}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          'h-12 w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 text-base font-bold outline-none transition placeholder:text-zinc-300',
          focusClasses,
        )}
      />
      <datalist id={listId}>
        {options.map(option => (
          <option key={option.value} value={option.value} label={option.label} />
        ))}
      </datalist>
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


