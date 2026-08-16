import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Clock, Crown, GripVertical, Trash2, Trophy, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatCountdown, getSubLotteryCoins, getSubLotteryWorkflowState, getWorkflowScheduleWeekLabel, SUB_LOTTERY_TIME_ZONE } from './workflow';
import type { SubLotteryPlayer, SubLotteryPool, SubLotteryPublicState, SubLotteryRequest } from './types';

type SubLotteryAudience = 'sub' | 'captain';

interface CreateRequestPayload {
  captainPin: string;
  scheduleEntryId: string;
  pool: SubLotteryPool;
  slotsNeeded: number;
}

interface CancelRequestPayload {
  requestId: string;
  captainPin: string;
}
interface UpdateRequestPayload extends CancelRequestPayload { pool: SubLotteryPool; slotsNeeded: number; confirmMerge?: boolean }

interface SubLotteryWorkspaceProps {
  state: SubLotteryPublicState;
  onCreateRequest?: (payloads: CreateRequestPayload[]) => void;
  onMarkAvailable?: (requestId: string, playerId: string) => void;
  onUpdatePreferences?: (playerId: string, requestIds: string[]) => void;
  onCancelRequest?: (payload: CancelRequestPayload) => void;
  onUpdateRequest?: (payload: UpdateRequestPayload) => void;
  isBusy?: boolean;
  currentDate?: Date;
  demoMode?: boolean;
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

function getResultText(request: SubLotteryRequest, players: SubLotteryPlayer[]): string {
  if (request.status === 'void') {
    return 'This request was cancelled before the draw.';
  }

  if (request.status === 'pending-confirmation') {
    const names = getPlayerNames(players, request.assignedPlayerIds ?? (request.assignedPlayerId ? [request.assignedPlayerId] : []));
    return `${names} selected; awaiting acceptance.`;
  }
  if (request.status !== 'assigned') {
    return 'Waiting for the draw.';
  }

  const assignedPlayerIds = request.assignedPlayerIds ?? (request.assignedPlayerId ? [request.assignedPlayerId] : []);
  if (assignedPlayerIds.length === 0) {
    return 'No eligible subs entered.';
  }

  const shortfall = Math.max(0, (request.slotsNeeded ?? 1) - assignedPlayerIds.length);
  return `${getPlayerNames(players, assignedPlayerIds)} won the draw.${shortfall > 0 ? ` ${shortfall} spot${shortfall === 1 ? '' : 's'} still unfilled.` : ''}`;
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

function CountdownBadge({
  label,
  targetIso,
  tone = 'sky',
}: {
  label: string;
  targetIso?: string;
  tone?: 'sky' | 'emerald' | 'amber' | 'purple';
}) {
  const toneClasses = {
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    purple: 'border-purple-200 bg-purple-50 text-purple-800',
  }[tone];

  return (
    <div className={cn('rounded-2xl border-2 px-4 py-3', toneClasses)}>
      <div className="text-xs font-black uppercase tracking-wide">{label}</div>
      <div className="text-xl font-black">{formatCountdown(targetIso)}</div>
    </div>
  );
}

function StaticStatusBadge({
  label,
  value,
  detail,
  tone = 'emerald',
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: 'emerald' | 'amber' | 'purple';
}) {
  const toneClasses = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    purple: 'border-purple-200 bg-purple-50 text-purple-800',
  }[tone];

  return (
    <div className={cn('rounded-3xl border-2 px-5 py-4 text-center', toneClasses)}>
      <div className="text-xs font-black uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-black">{value}</div>
      {detail && <div className="text-xs font-bold">{detail}</div>}
    </div>
  );
}

export function SubLotteryWorkspace({
  state,
  onCreateRequest,
  onMarkAvailable,
  onUpdatePreferences,
  onCancelRequest,
  onUpdateRequest,
  isBusy = false,
  currentDate = new Date(),
  demoMode = false,
}: SubLotteryWorkspaceProps) {
  const [selectedPlayerName, setSelectedPlayerName] = useState('');
  const [captainPin, setCaptainPin] = useState('');
  const [selectedCaptainName, setSelectedCaptainName] = useState('');
  const [selectedScheduleEntryId, setSelectedScheduleEntryId] = useState('');
  const [selectedRequestPools, setSelectedRequestPools] = useState<SubLotteryPool[]>([]);
  const [slotsNeededByPool, setSlotsNeededByPool] = useState<Record<SubLotteryPool, string>>({
    open: '1',
    female: '1',
  });
  const [selectedAudience, setSelectedAudience] = useState<SubLotteryAudience | null>(null);

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
  const scheduleEntriesForWeek = useMemo(
    () => activeScheduleEntries.filter(entry => entry.weekLabel === currentWeekLabel),
    [activeScheduleEntries, currentWeekLabel]
  );
  const captainOptions = useMemo(
    () => uniqueSorted(scheduleEntriesForWeek.map(entry => entry.captainName)),
    [scheduleEntriesForWeek]
  );
  const scheduleEntriesForCaptain = useMemo(
    () => scheduleEntriesForWeek.filter(entry => normalizeName(entry.captainName) === normalizeName(selectedCaptainName)),
    [scheduleEntriesForWeek, selectedCaptainName]
  );
  const selectedScheduleEntry = scheduleEntriesForCaptain.find(entry => entry.id === selectedScheduleEntryId) ?? null;
  const isCaptainPhase = workflow.phase === 'captain';
  const isPlayerPhase = workflow.phase === 'player';
  const openRequests = state.requests.filter(request => request.status === 'open');
  const recommendedAudience: SubLotteryAudience = isCaptainPhase ? 'captain' : 'sub';
  const activeAudience = selectedAudience ?? recommendedAudience;
  const showCaptainForm = activeAudience === 'captain' && isCaptainPhase;
  const showSubEntry = activeAudience === 'sub' && isPlayerPhase;
  const showResults = workflow.phase === 'results';
  const slotsAreValid = selectedRequestPools.every(pool => {
    const requestedSlots = Number(slotsNeededByPool[pool]);
    return Number.isInteger(requestedSlots) && requestedSlots >= 1;
  });
  const subCountdownLabel = isPlayerPhase ? 'Sub entries close in' : 'Sub lottery opens in';
  const subCountdownTarget = isPlayerPhase ? workflow.availabilityClosesAt : workflow.availabilityOpensAt;

  useEffect(() => {
    if (scheduleEntriesForCaptain.length === 1) {
      setSelectedScheduleEntryId(scheduleEntriesForCaptain[0]!.id);
      return;
    }

    if (!scheduleEntriesForCaptain.some(entry => entry.id === selectedScheduleEntryId)) {
      setSelectedScheduleEntryId('');
    }
  }, [scheduleEntriesForCaptain, selectedScheduleEntryId]);

  const selectedPlayer = activePlayers.find(player => normalizeName(player.name) === normalizeName(selectedPlayerName));
  const matchingOpenRequests = selectedPlayer
    ? openRequests.filter(request => request.pool === selectedPlayer.pool)
    : openRequests;
  const rankedEntries = selectedPlayer ? state.availability
    .filter(entry => entry.playerId === selectedPlayer.id && matchingOpenRequests.some(request => request.id === entry.requestId))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.enteredAt.localeCompare(b.enteredAt)) : [];
  const rankedRequestIds = rankedEntries.map(entry => entry.requestId);
  const saveRanked = (ids: string[]) => selectedPlayer && onUpdatePreferences?.(selectedPlayer.id, ids);
  const captainDisableReason = !isCaptainPhase
    ? 'Captain requests are closed for this week.'
    : !selectedCaptainName
      ? 'Choose your captain name to load your game.'
      : scheduleEntriesForCaptain.length > 1 && !selectedScheduleEntryId
        ? 'Choose the exact scheduled game.'
      : !selectedScheduleEntry
        ? 'Choose your captain name to load your game.'
      : selectedRequestPools.length === 0
        ? 'Choose open matching, female matching, or both.'
        : !slotsAreValid
          ? 'Enter a whole number of 1 or more.'
          : '';
  const getEntryCount = (request: SubLotteryRequest) => state.availability
    .filter(entry => entry.requestId === request.id)
    .length;

  const handleCreateRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedScheduleEntry || selectedRequestPools.length === 0 || !slotsAreValid) return;
    onCreateRequest?.(selectedRequestPools.map(pool => ({
      captainPin,
      scheduleEntryId: selectedScheduleEntry.id,
      pool,
      slotsNeeded: Number(slotsNeededByPool[pool]),
    })));
  };

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#3c3c3c]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {demoMode && (
          <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-4 text-center text-sm font-black text-amber-900">
            Firebase testing week: changes are saved week by week in a separate testing season and never mixed with the live lottery.
          </div>
        )}
        <WorkflowStepper workflow={workflow} />

        {showResults ? (
          <ResultsHero requestCount={state.requests.length} />
        ) : (
          <RoleChooser
            activeAudience={activeAudience}
            selectedAudience={selectedAudience}
            isCaptainPhase={isCaptainPhase}
            isPlayerPhase={isPlayerPhase}
            nextDeadlineLabel={workflow.nextDeadlineLabel}
            nextDeadlineAt={workflow.nextDeadlineAt}
            onSelect={setSelectedAudience}
          />
        )}

        {!showResults && (
        <div className="grid gap-6">
          {activeAudience === 'sub' && (showSubEntry ? (
          <section className="rounded-[2rem] border-2 border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
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
              <CountdownBadge label={subCountdownLabel} targetIso={subCountdownTarget} tone="emerald" />
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
              <div className="rounded-2xl border-2 border-amber-100 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                Rank every game you can play. Reorder or remove choices any time before entries close. You can win only one game this week.
              </div>
              {selectedPlayer && rankedEntries.length > 0 && (
                <div className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-4">
                  <h3 className="mb-2 font-black text-emerald-900">Your ranked choices</h3>
                  <ol className="space-y-2">
                    {rankedEntries.map((entry, index) => {
                      const request = state.requests.find(item => item.id === entry.requestId);
                      if (!request) return null;
                      const move = (nextIndex: number) => { const ids = [...rankedRequestIds]; const [id] = ids.splice(index, 1); ids.splice(nextIndex, 0, id!); saveRanked(ids); };
                      return <li key={entry.requestId} draggable onDragStart={event => event.dataTransfer.setData('text/plain', String(index))} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const source = Number(event.dataTransfer.getData('text/plain')); const ids = [...rankedRequestIds]; const [id] = ids.splice(source, 1); if (id) { ids.splice(index, 0, id); saveRanked(ids); } }} className="flex items-center gap-2 rounded-2xl bg-white p-3 font-bold">
                        <GripVertical className="h-4 w-4 text-zinc-400" /><span className="w-6 text-emerald-700">{index + 1}.</span><span className="min-w-0 flex-1">{request.teamName} · {request.gameLabel}</span>
                        <button aria-label={`Move ${request.teamName} up`} disabled={index === 0 || isBusy} onClick={() => move(index - 1)} className="p-2 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                        <button aria-label={`Move ${request.teamName} down`} disabled={index === rankedEntries.length - 1 || isBusy} onClick={() => move(index + 1)} className="p-2 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                        <button aria-label={`Remove ${request.teamName}`} disabled={isBusy} onClick={() => saveRanked(rankedRequestIds.filter(id => id !== entry.requestId))} className="p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </li>;
                    })}
                  </ol>
                </div>
              )}
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
                        onClick={() => selectedPlayer && (onUpdatePreferences ? saveRanked([...rankedRequestIds, request.id]) : onMarkAvailable?.(request.id, selectedPlayer.id))}
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
          ) : (
            <ClosedRolePanel
              audience="sub"
              title="Sub players: your entry window is closed"
              message={isCaptainPhase
                ? `Captains are adding needs now. Sub players can enter from ${formatDeadline(workflow.availabilityOpensAt)} to ${formatDeadline(workflow.availabilityClosesAt)}.`
                : workflow.phase === 'lottery'
                  ? 'The lottery is running now. Results will post shortly.'
                  : 'This week’s results are posted below.'}
              countdownLabel={subCountdownLabel}
              countdownTarget={subCountdownTarget}
              tone="emerald"
            />
          ))}

          {activeAudience === 'captain' && (showCaptainForm ? (
          <section className="rounded-[2rem] border-2 border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Crown className="h-6 w-6" /></div>
              <div>
                <h2 className="text-2xl font-black">Captains: add a sub need</h2>
                <p className="font-semibold text-zinc-500">
                  {isCaptainPhase ? `Add your sub needs before ${formatDeadline(workflow.captainClosesAt)}.` : 'Captain requests are closed for this week.'}
                </p>
              </div>
              </div>
              <CountdownBadge label="Requests close in" targetIso={workflow.captainClosesAt} tone="sky" />
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
              {scheduleEntriesForCaptain.length > 1 && (
                <LabeledSelect
                  label="Scheduled game"
                  value={selectedScheduleEntryId}
                  onChange={setSelectedScheduleEntryId}
                  options={scheduleEntriesForCaptain.map(entry => ({
                    value: entry.id,
                    label: `${entry.teamName} · ${entry.gameLabel}`,
                  }))}
                />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField label="Team name" value={selectedScheduleEntry?.teamName ?? ''} />
                <ReadOnlyField label="Game time" value={selectedScheduleEntry?.gameLabel ?? ''} />
              </div>
              <PoolCheckboxes
                selectedPools={selectedRequestPools}
                onToggle={(pool) => setSelectedRequestPools(current => current.includes(pool)
                  ? current.filter(selectedPool => selectedPool !== pool)
                  : [...current, pool])}
              />
              {selectedRequestPools.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {selectedRequestPools.map(pool => (
                    <LabeledInput
                      key={pool}
                      label={`Number of ${getPoolLabel(pool).toLowerCase()} subs needed`}
                      value={slotsNeededByPool[pool]}
                      onChange={(value) => setSlotsNeededByPool(current => ({ ...current, [pool]: value }))}
                      type="number"
                      min={1}
                    />
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy || !isCaptainPhase || !selectedScheduleEntry || selectedRequestPools.length === 0 || !slotsAreValid}
                className="mt-1 rounded-2xl border-2 border-sky-700 bg-[#1cb0f6] px-5 py-4 text-base font-black text-white shadow-[0_4px_0_#1899d6] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none"
              >
                {!isCaptainPhase
                  ? 'Captain window closed'
                  : selectedRequestPools.length > 1
                      ? `Add ${selectedRequestPools.length} sub needs`
                      : 'Add sub need'}
              </button>
              {captainDisableReason && (
                <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                  {captainDisableReason}
                </div>
              )}
            </form>
            {openRequests.length > 0 && (
              <div className="mt-6 rounded-3xl border-2 border-zinc-200 bg-zinc-50 p-4">
                <h3 className="text-lg font-black text-zinc-800">Open sub needs</h3>
                <p className="mb-3 text-sm font-bold text-zinc-500">Use your captain PIN above if you need to cancel a request before the draw.</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {openRequests.map(request => {
                    const canCancel = !request.drawAt || currentDate.getTime() < new Date(request.drawAt).getTime();
                    return (
                      <article key={request.id} className="rounded-2xl border-2 border-zinc-200 bg-white p-3">
                        <div className="font-black">{request.teamName}</div>
                        <div className="text-sm font-bold text-zinc-500">
                          {request.weekLabel ? `${request.weekLabel} · ` : ''}{request.gameLabel} · {getPoolLabel(request.pool)} · {request.slotsNeeded ?? 1} needed
                        </div>
                        {canCancel && (
                      <div className="flex gap-2">
                      <button type="button" disabled={isBusy || !canCancel} onClick={() => {
                        const quantity = Number(window.prompt('How many subs are needed?', String(request.slotsNeeded ?? 1)));
                        if (!Number.isInteger(quantity) || quantity < 1) return;
                        const pool = window.prompt('Pool: open or female', request.pool)?.toLowerCase();
                        if (pool !== 'open' && pool !== 'female') return;
                        onUpdateRequest?.({ requestId: request.id, captainPin, slotsNeeded: quantity, pool });
                      }} className="rounded-xl border-2 border-sky-600 px-3 py-2 text-xs font-black text-sky-700">Edit</button>
                      <button
                        type="button"
                            disabled={isBusy || !captainPin}
                            onClick={() => onCancelRequest?.({ requestId: request.id, captainPin })}
                            className="mt-3 rounded-2xl border-2 border-red-200 bg-white px-4 py-2 text-sm font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                        Cancel request
                      </button>
                      </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
          ) : (
            <ClosedRolePanel
              audience="captain"
              title="Captains: your request window is closed"
              message={isPlayerPhase
                ? 'Sub players are entering the lottery now. If you already added a need, watch results after the draw.'
                : workflow.phase === 'lottery'
                  ? 'The draw is running now. Results will post shortly.'
                  : 'This week’s draw is complete. Use the results list below.'}
              countdownLabel="Requests close in"
              countdownTarget={workflow.captainClosesAt}
              tone="sky"
            />
          ))}
        </div>
        )}

        {showResults && (
        <section className="rounded-[2rem] border-2 border-amber-200 bg-white p-5 shadow-md ring-4 ring-amber-50 sm:p-6" aria-labelledby="sub-lottery-results-heading">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><Trophy className="h-7 w-7" /></div>
            <div>
              <div className="text-sm font-black uppercase tracking-wide text-amber-700">Part 3 · Results</div>
              <h2 id="sub-lottery-results-heading" className="text-3xl font-black text-zinc-950">Draw results</h2>
              <p className="font-semibold text-zinc-500">See which subs were picked after the Monday draw.</p>
            </div>
            </div>
            <StaticStatusBadge label="Draw status" value="Complete" detail={formatDeadline(workflow.drawAt)} tone="amber" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {state.requests.map(request => {
              const canCancel = request.status === 'open' && (!request.drawAt || currentDate.getTime() < new Date(request.drawAt).getTime());
              return (
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
                      {request.status === 'assigned' || request.status === 'pending-confirmation'
                        ? getResultText(request, state.players)
                    : request.status === 'void'
                      ? getResultText(request, state.players)
                      : `${getEntryCount(request)} sub player${getEntryCount(request) === 1 ? '' : 's'} entered. Waiting for the draw.`}
                  {request.assignedAt && (
                    <div className="mt-1 text-xs font-bold text-zinc-500">Draw completed {formatDeadline(request.assignedAt)}</div>
                  )}
                  {request.cancelledAt && (
                    <div className="mt-1 text-xs font-bold text-zinc-500">Cancelled {formatDeadline(request.cancelledAt)}</div>
                  )}
                </div>
                {canCancel && (
                  <button
                    type="button"
                    disabled={isBusy || !captainPin}
                    onClick={() => onCancelRequest?.({ requestId: request.id, captainPin })}
                    className="mt-3 rounded-2xl border-2 border-red-200 bg-white px-4 py-2 text-sm font-black text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel request
                  </button>
                )}
              </article>
              );
            })}
          </div>
          <p className="mt-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            Lottery note: every sub player starts with 5 coins. Each time they sub, they use 1 coin. Everyone always keeps at least 1 coin, so everyone still has a chance.
          </p>
        </section>
        )}

        <details className="rounded-[2rem] border-2 border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <summary className="cursor-pointer text-2xl font-black">Sub history</summary>
          <p className="mb-4 mt-2 font-semibold text-zinc-500">See who has subbed this season and how many lottery coins they have left.</p>
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
        </details>
      </div>
    </main>
  );
}

function ResultsHero({ requestCount }: { requestCount: number }) {
  return (
    <section className="rounded-[2rem] border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 shadow-lg ring-4 ring-amber-100 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-3xl bg-amber-100 p-4 text-amber-700 shadow-inner">
            <Trophy className="h-9 w-9" />
          </div>
          <div>
            <div className="mb-2 inline-flex rounded-full border-2 border-amber-500 bg-amber-100 px-4 py-2 text-sm font-black uppercase tracking-wide text-amber-800">
              Part 3 · Draw complete
            </div>
            <h1 className="text-4xl font-black tracking-tight text-zinc-950 sm:text-5xl">
              Lottery results are posted
            </h1>
            <p className="mt-2 max-w-2xl text-lg font-semibold text-zinc-600">
              The sub entry window is closed and the draw has run. Check the cards below to see who was selected.
            </p>
          </div>
        </div>
        <StaticStatusBadge
          label={requestCount === 1 ? 'Game request' : 'Game requests'}
          value={String(requestCount)}
          detail="Results below"
          tone="emerald"
        />
      </div>
      <div className="mt-5 grid gap-3 text-sm font-bold text-zinc-600 md:grid-cols-2">
        <div className="rounded-2xl border-2 border-zinc-100 bg-white/80 p-3">
          Captains: use the results list below for your team’s selected subs.
        </div>
        <div className="rounded-2xl border-2 border-zinc-100 bg-white/80 p-3">
          Subs: winners are listed below. If your email is on file, you may also receive a winner email.
        </div>
      </div>
    </section>
  );
}

function RoleChooser({
  activeAudience,
  selectedAudience,
  isCaptainPhase,
  isPlayerPhase,
  nextDeadlineLabel,
  nextDeadlineAt,
  onSelect,
}: {
  activeAudience: SubLotteryAudience;
  selectedAudience: SubLotteryAudience | null;
  isCaptainPhase: boolean;
  isPlayerPhase: boolean;
  nextDeadlineLabel: string;
  nextDeadlineAt?: string;
  onSelect: (audience: SubLotteryAudience) => void;
}) {
  const nowText = isCaptainPhase
    ? 'Captains are up now.'
    : isPlayerPhase
      ? 'Sub players are up now.'
      : 'The lottery/results window is active.';

  return (
    <section className="rounded-[2rem] border-2 border-emerald-300 bg-white p-5 shadow-md ring-4 ring-emerald-50 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 inline-flex rounded-full border-2 border-emerald-600 bg-emerald-100 px-4 py-2 text-sm font-black uppercase tracking-wide text-emerald-800">
            Part 1 · Start here
          </div>
          <h2 className="text-3xl font-black text-zinc-900">Are you a sub or a captain?</h2>
          <p className="mt-1 font-semibold text-zinc-500">{nowText} Choose your role and we’ll only show the useful action.</p>
        </div>
        <div className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 px-5 py-3 text-center">
          <div className="text-xs font-black uppercase tracking-wide text-emerald-700">{nextDeadlineLabel}</div>
          <div className="text-2xl font-black text-emerald-800">{formatCountdown(nextDeadlineAt)}</div>
          <div className="text-xs font-bold text-emerald-700">{formatDeadline(nextDeadlineAt)}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <AudienceButton
          audience="sub"
          activeAudience={activeAudience}
          selectedAudience={selectedAudience}
          onSelect={onSelect}
          icon={<Users className="h-6 w-6" />}
          title="I’m a sub player"
          detail={isPlayerPhase ? 'Enter the lottery for games you can play.' : 'Check when the sub entry window opens.'}
          status={isPlayerPhase ? 'Open now' : 'Not open now'}
          tone="emerald"
        />
        <AudienceButton
          audience="captain"
          activeAudience={activeAudience}
          selectedAudience={selectedAudience}
          onSelect={onSelect}
          icon={<Crown className="h-6 w-6" />}
          title="I’m a captain"
          detail={isCaptainPhase ? 'Add the sub needs for your scheduled game.' : 'Your request window is closed.'}
          status={isCaptainPhase ? 'Open now' : 'Closed'}
          tone="sky"
        />
      </div>
    </section>
  );
}

function AudienceButton({
  audience,
  activeAudience,
  selectedAudience,
  onSelect,
  icon,
  title,
  detail,
  status,
  tone,
}: {
  audience: SubLotteryAudience;
  activeAudience: SubLotteryAudience;
  selectedAudience: SubLotteryAudience | null;
  onSelect: (audience: SubLotteryAudience) => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
  status: string;
  tone: 'emerald' | 'sky';
}) {
  const isActive = activeAudience === audience;
  const colorClasses = tone === 'emerald'
    ? {
      active: 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100',
      icon: 'bg-emerald-100 text-emerald-700',
      pill: 'bg-emerald-100 text-emerald-800',
    }
    : {
      active: 'border-sky-500 bg-sky-50 ring-4 ring-sky-100',
      icon: 'bg-sky-100 text-sky-700',
      pill: 'bg-sky-100 text-sky-800',
    };

  return (
    <button
      type="button"
      onClick={() => onSelect(audience)}
      className={cn(
        'rounded-3xl border-2 p-4 text-left transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-sky-100',
        isActive ? colorClasses.active : 'border-zinc-200 bg-zinc-50',
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('rounded-2xl p-3', colorClasses.icon)}>{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xl font-black text-zinc-900">{title}</div>
            <span className={cn('rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide', colorClasses.pill)}>
              {status}
            </span>
            {!selectedAudience && isActive && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-wide text-zinc-500">
                Suggested
              </span>
            )}
          </div>
          <p className="mt-1 font-semibold text-zinc-600">{detail}</p>
        </div>
      </div>
    </button>
  );
}

function ClosedRolePanel({
  audience,
  title,
  message,
  countdownLabel,
  countdownTarget,
  tone,
}: {
  audience: SubLotteryAudience;
  title: string;
  message: string;
  countdownLabel: string;
  countdownTarget?: string;
  tone: 'emerald' | 'sky';
}) {
  const Icon = audience === 'sub' ? Users : Crown;
  const iconClasses = audience === 'sub' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700';

  return (
    <section className="rounded-[2rem] border-2 border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-2xl p-3', iconClasses)}><Icon className="h-6 w-6" /></div>
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-zinc-500">Current action</div>
            <h2 className="text-2xl font-black">{title}</h2>
            <p className="mt-1 font-semibold text-zinc-500">{message}</p>
          </div>
        </div>
        <CountdownBadge label={countdownLabel} targetIso={countdownTarget} tone={tone} />
      </div>
    </section>
  );
}

function WorkflowStepper({ workflow }: { workflow: ReturnType<typeof getSubLotteryWorkflowState> }) {
  const displayStepIndex = Math.min(workflow.activeStepIndex, 2);
  const steps = [
    { title: 'Captains ask', detail: `Until ${formatDeadline(workflow.captainClosesAt)}` },
    { title: 'Subs enter', detail: `${formatDeadline(workflow.availabilityOpensAt)}–${formatDeadline(workflow.availabilityClosesAt)}` },
    {
      title: 'Drawn results',
      detail: workflow.phase === 'results'
        ? 'Visible until Monday 11:59 PM'
        : `Revealed in ${formatCountdown(workflow.drawAt)}`,
    },
  ];

  return (
    <section
      aria-label="This week's timeline"
      className="sticky top-0 z-30 rounded-none border-y-2 border-sky-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur sm:rounded-2xl sm:border-2 sm:px-4"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex shrink-0 items-center justify-between gap-3 lg:w-52 lg:justify-start">
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-sky-700">This week's timeline</div>
            <div className="text-sm font-black text-zinc-900">Sub lottery</div>
          </div>
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 px-3 py-1 text-right lg:hidden">
            <div className="text-[10px] font-black uppercase tracking-wide text-emerald-700">{workflow.nextDeadlineLabel}</div>
            <div className="text-base font-black text-emerald-800">{formatCountdown(workflow.nextDeadlineAt)}</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 lg:pb-0">
        {steps.map((step, index) => {
          const isActive = displayStepIndex === index;
          const isComplete = displayStepIndex > index;
          return (
            <div
              key={step.title}
              className={cn(
                'min-w-[11rem] flex-1 rounded-xl border-2 px-3 py-2',
                isActive && 'border-sky-600 bg-sky-50 ring-2 ring-sky-100',
                isComplete && 'border-emerald-200 bg-emerald-50',
                !isActive && !isComplete && 'border-zinc-200 bg-zinc-50'
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <div className={cn(
                  'text-xs font-black uppercase tracking-wide',
                  isActive ? 'text-sky-800' : 'text-zinc-500',
                )}>
                  Part {index + 1}
                </div>
                {isComplete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock className="h-4 w-4 text-sky-600" />}
              </div>
              <div className="truncate text-sm font-black text-zinc-800">{step.title}</div>
              <div className="text-xs font-bold text-zinc-500">{step.detail}</div>
            </div>
          );
        })}
        </div>

        <div className="hidden shrink-0 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-2 text-center lg:block">
          <div className="text-[10px] font-black uppercase tracking-wide text-emerald-700">{workflow.nextDeadlineLabel}</div>
          <div className="text-lg font-black leading-tight text-emerald-800">{formatCountdown(workflow.nextDeadlineAt)}</div>
          <div className="text-[10px] font-bold text-emerald-700">{formatDeadline(workflow.nextDeadlineAt)}</div>
        </div>
      </div>
    </section>
  );
}

function PoolCheckboxes({
  selectedPools,
  onToggle,
}: {
  selectedPools: SubLotteryPool[];
  onToggle: (pool: SubLotteryPool) => void;
}) {
  const options: Array<{ pool: SubLotteryPool; label: string; help: string }> = [
    { pool: 'open', label: 'Open matching sub', help: 'Players listed as open matching can enter.' },
    { pool: 'female', label: 'Female matching sub', help: 'Only players listed as female matching can enter.' },
  ];

  return (
    <fieldset className="rounded-2xl border-2 border-sky-100 bg-sky-50 p-4">
      <legend className="sr-only">Choose the kind of sub you need</legend>
      <div className="mb-3 text-sm font-black uppercase tracking-wide text-sky-800">Choose the kind of sub you need</div>
      <p className="mb-3 text-sm font-bold text-sky-900">All games are mixed. Open and female matching requests are available for every scheduled game.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map(option => (
          <label
            key={option.pool}
            className={cn(
              'flex cursor-pointer gap-3 rounded-2xl border-2 bg-white p-4 transition',
              selectedPools.includes(option.pool) ? 'border-sky-500 ring-4 ring-sky-100' : 'border-zinc-200'
            )}
          >
            <input
              type="checkbox"
              checked={selectedPools.includes(option.pool)}
              onChange={() => onToggle(option.pool)}
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

interface SelectOption {
  value: string;
  label: string;
}

function LabeledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
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
        <option value="">Choose a game</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
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
