import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Clock, Crown, GripVertical, Trash2, Trophy, Users } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatCountdown, getSubLotteryCoins, getSubLotteryWorkflowState, getWorkflowScheduleWeekLabel, SUB_LOTTERY_TIME_ZONE } from './workflow';
import type { SubLotteryPlayer, SubLotteryPool, SubLotteryPublicState, SubLotteryRequest } from './types';
import { loadAccessStatus, requestAccessCode, verifyAccessCode } from './api';
import type { SubLotteryIdentityKind } from './apiContracts';
import { SubLotteryWeekWindows } from './SubLotteryWeekWindows';

type SubLotteryTab = 'captain' | 'sub' | 'results';

interface CreateRequestPayload {
  captainPin: string;
  scheduleEntryId: string;
  submissionId: string;
  needs: Array<{ pool: SubLotteryPool; slotsNeeded: number }>;
}

interface CancelRequestPayload {
  requestId: string;
  captainPin: string;
}
interface UpdateRequestPayload extends CancelRequestPayload { pool: SubLotteryPool; slotsNeeded: number; confirmMerge?: boolean }

interface SubLotteryWorkspaceProps {
  state: SubLotteryPublicState;
  onCreateRequest?: (payload: CreateRequestPayload) => Promise<boolean>;
  onMarkAvailable?: (requestId: string, playerId: string) => void;
  onUpdatePreferences?: (playerId: string, requestIds: string[]) => void;
  onCancelRequest?: (payload: CancelRequestPayload) => void;
  onUpdateRequest?: (payload: UpdateRequestPayload) => Promise<boolean>;
  onRefresh?: () => void;
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
    return `${names} won the draw.`;
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

function formatWeekStart(date: string | undefined): string {
  if (!date) return 'the previous week';
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })
    .format(new Date(`${date}T12:00:00Z`));
}

export function SubLotteryWorkspace({
  state,
  onCreateRequest,
  onMarkAvailable,
  onUpdatePreferences,
  onCancelRequest,
  onUpdateRequest,
  onRefresh,
  isBusy = false,
  currentDate = new Date(),
  demoMode = false,
}: SubLotteryWorkspaceProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [captainPin, setCaptainPin] = useState('');
  const [selectedCaptainName, setSelectedCaptainName] = useState('');
  const [selectedScheduleEntryId, setSelectedScheduleEntryId] = useState('');
  const [selectedRequestPools, setSelectedRequestPools] = useState<SubLotteryPool[]>([]);
  const [slotsNeededByPool, setSlotsNeededByPool] = useState<Record<SubLotteryPool, string>>({
    open: '1',
    female: '1',
  });
  const [selectedTab, setSelectedTab] = useState<SubLotteryTab | null>(null);
  const [authorizedCaptainEntryId, setAuthorizedCaptainEntryId] = useState('');
  const [editingRequestId, setEditingRequestId] = useState('');
  const [editPool, setEditPool] = useState<SubLotteryPool>('open');
  const [editSlots, setEditSlots] = useState('1');
  const submissionRef = useRef({ id: crypto.randomUUID(), fingerprint: '' });
  const authorizeCaptain = useCallback((id: string, verified: boolean) => setAuthorizedCaptainEntryId(verified ? id : ''), []);

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
  const captainVerified = demoMode || Boolean(selectedScheduleEntry && authorizedCaptainEntryId === selectedScheduleEntry.id);
  const effectiveCaptainPin = demoMode ? 'testing' : captainPin;
  const isCaptainPhase = workflow.phase === 'captain';
  const isPlayerPhase = workflow.phase === 'player';
  const openRequests = state.requests.filter(request => request.status === 'open');
  const ownOpenRequests = openRequests.filter(request => request.scheduleEntryId === selectedScheduleEntry?.id);
  const hasCurrentResults = state.requests.some(request => request.status === 'assigned')
    || (workflow.phase === 'results' && state.requests.some(request => request.status === 'void'));
  const showingRecentResults = !hasCurrentResults && Boolean(state.recentRequests?.length);
  const resultRequests = showingRecentResults ? state.recentRequests ?? [] : state.requests;
  const recommendedTab: SubLotteryTab = isCaptainPhase
    ? 'captain'
    : isPlayerPhase
      ? 'sub'
      : 'results';
  const activeTab = selectedTab ?? recommendedTab;
  const showCaptainForm = activeTab === 'captain' && isCaptainPhase;
  const showSubEntry = activeTab === 'sub' && isPlayerPhase;
  const slotsAreValid = selectedRequestPools.every(pool => {
    const requestedSlots = Number(slotsNeededByPool[pool]);
    return Number.isInteger(requestedSlots) && requestedSlots >= 1;
  });
  useEffect(() => {
    if (scheduleEntriesForCaptain.length === 1) {
      setSelectedScheduleEntryId(scheduleEntriesForCaptain[0]!.id);
      return;
    }

    if (!scheduleEntriesForCaptain.some(entry => entry.id === selectedScheduleEntryId)) {
      setSelectedScheduleEntryId('');
    }
  }, [scheduleEntriesForCaptain, selectedScheduleEntryId]);

  const selectedPlayer = activePlayers.find(player => player.id === selectedPlayerId);
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
    : !demoMode && !captainPin
      ? 'Enter the captain PIN.'
    : !selectedCaptainName
      ? 'Choose your captain name to load your game.'
      : scheduleEntriesForCaptain.length > 1 && !selectedScheduleEntryId
        ? 'Choose the exact scheduled game.'
      : !selectedScheduleEntry
        ? 'Choose your captain name to load your game.'
      : !captainVerified
        ? 'Verify the email on your scheduled game before adding a need.'
      : selectedRequestPools.length === 0
        ? 'Choose open matching, female matching, or both.'
        : !slotsAreValid
          ? 'Enter a whole number of 1 or more.'
          : '';
  const getEntryCount = (request: SubLotteryRequest) => state.availability
    .filter(entry => entry.requestId === request.id)
    .length;

  const handleCreateRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedScheduleEntry || !captainVerified || selectedRequestPools.length === 0 || !slotsAreValid) return;
    const needs = selectedRequestPools.map(pool => ({ pool, slotsNeeded: Number(slotsNeededByPool[pool]) }));
    const fingerprint = JSON.stringify([selectedScheduleEntry.id, needs]);
    if (submissionRef.current.fingerprint !== fingerprint) submissionRef.current = { id: crypto.randomUUID(), fingerprint };
    const saved = await onCreateRequest?.({
      captainPin: effectiveCaptainPin,
      scheduleEntryId: selectedScheduleEntry.id,
      submissionId: submissionRef.current.id,
      needs,
    });
    if (saved) {
      submissionRef.current = { id: crypto.randomUUID(), fingerprint: '' };
      setSelectedRequestPools([]);
      setSlotsNeededByPool({ open: '1', female: '1' });
    }
  };

  useEffect(() => { setSelectedTab(null); }, [workflow.phase, workflow.targetWeekStartDate]);

  return (
    <main className="min-h-[calc(100vh-6rem)] bg-[#f8f8f8] text-[#333333]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
        {demoMode && (
          <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-4 text-center text-sm font-black text-amber-900">
            Firebase testing week: changes are saved week by week in a separate testing season and never mixed with the live lottery.
          </div>
        )}
        <SubLotteryTabs
          activeTab={activeTab}
          workflow={workflow}
          currentDate={currentDate}
          onSelect={setSelectedTab}
        />
        <SubLotteryWeekWindows workflow={workflow} currentDate={currentDate} />
        {!demoMode && onRefresh && <button type="button" onClick={onRefresh} className="self-end text-sm font-bold text-[#005288] underline">Refresh lottery</button>}

        {activeTab !== 'results' && (
        <div
          id={`sub-lottery-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`sub-lottery-tab-${activeTab}`}
          className="grid gap-6"
        >
          {activeTab === 'sub' && (showSubEntry ? (
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
            </div>

            <div className="mb-5">
              <LabeledSelect
                label={demoMode ? 'Dummy player' : 'Pick your name'}
                value={selectedPlayerId}
                onChange={setSelectedPlayerId}
                placeholder={demoMode ? 'Choose a dummy player' : 'Choose your name'}
                options={activePlayers.map(player => ({
                  value: player.id,
                  label: `${player.name} · ${getPoolLabel(player.pool)}`,
                }))}
              />
            </div>
            <p className="mb-5 text-sm font-semibold text-zinc-600">Choose your own name. Your entry and rankings will be saved under that name.</p>

            <div className="space-y-3">
              <div className="rounded-2xl border-2 border-amber-100 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                Rank every game you can play. Reorder or remove choices before entries close. You can win only one game this week. If you win, you are assigned to that game and emailed; there is no acceptance step.
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
                        <button type="button" aria-label={`Move ${request.teamName} up`} disabled={index === 0 || isBusy} onClick={() => move(index - 1)} className="p-2 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" aria-label={`Move ${request.teamName} down`} disabled={index === rankedEntries.length - 1 || isBusy} onClick={() => move(index + 1)} className="p-2 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                        <button type="button" aria-label={`Remove ${request.teamName}`} disabled={isBusy} onClick={() => saveRanked(rankedRequestIds.filter(id => id !== entry.requestId))} className="p-2 text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
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
                            : 'border-[#005288] bg-[#0071bb] text-white shadow-[0_4px_0_#005288] hover:-translate-y-0.5 hover:bg-[#0062a2] active:translate-y-0 active:shadow-none',
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
            />
          ))}

          {activeTab === 'captain' && (showCaptainForm ? (
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
            </div>

            <form className="grid gap-4" onSubmit={handleCreateRequest}>
              {demoMode ? (
                <div className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-4 text-sm font-black text-purple-800">
                  Testing uses dummy captains, so no captain PIN is required.
                </div>
              ) : (
                <LabeledInput label="Captain PIN" value={captainPin} onChange={setCaptainPin} type="password" />
              )}
              <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4 text-sm font-black text-emerald-800">
                Game week: {currentWeekLabel ?? 'No games found for this week'}
              </div>
              {demoMode ? (
                <LabeledSelect
                  label="Dummy captain"
                  value={selectedCaptainName}
                  onChange={(value) => { setSelectedCaptainName(value); setAuthorizedCaptainEntryId(''); }}
                  placeholder="Choose a dummy captain"
                  options={captainOptions.map(name => ({ value: name, label: name }))}
                />
              ) : (
                <LabeledTypeahead
                  label="Captain name"
                  listId="captain-name-suggestions"
                  value={selectedCaptainName}
                  onChange={(value) => { setSelectedCaptainName(value); setAuthorizedCaptainEntryId(''); }}
                  placeholder="Start typing captain name"
                  options={captainOptions.map(name => ({ value: name }))}
                  focusColor="sky"
                />
              )}
              {scheduleEntriesForCaptain.length > 1 && (
                <LabeledSelect
                  label="Scheduled game"
                  value={selectedScheduleEntryId}
                  onChange={(value) => { setSelectedScheduleEntryId(value); setAuthorizedCaptainEntryId(''); }}
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
              {!demoMode && selectedScheduleEntry && captainPin && (
                <IdentityVerification kind="captain" subjectId={selectedScheduleEntry.id} captainPin={captainPin} onVerified={authorizeCaptain} />
              )}
              <PoolCheckboxes
                selectedPools={selectedRequestPools}
                onToggle={(pool) => setSelectedRequestPools(current => current.includes(pool)
                  ? current.filter(selectedPool => selectedPool !== pool)
                  : [...current, pool])}
              />
              {selectedRequestPools.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {selectedRequestPools.map(pool => (
                    <div key={pool}>
                      <LabeledInput
                        label={`Number of ${getPoolLabel(pool).toLowerCase()} subs needed`}
                        value={slotsNeededByPool[pool]}
                        onChange={(value) => setSlotsNeededByPool(current => ({ ...current, [pool]: value }))}
                        type="number"
                        min={1}
                      />
                      {ownOpenRequests.some(request => request.pool === pool) && (
                        <p className="mt-2 text-sm font-semibold text-sky-800">This game already has {ownOpenRequests.find(request => request.pool === pool)?.slotsNeeded ?? 1} {getPoolLabel(pool).toLowerCase()} requested. Submitting adds more spots.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy || !isCaptainPhase || !captainVerified || !selectedScheduleEntry || selectedRequestPools.length === 0 || !slotsAreValid}
                className="mt-1 rounded-2xl border-2 border-[#005288] bg-[#0071bb] px-5 py-4 text-base font-black text-white shadow-[0_4px_0_#005288] transition hover:-translate-y-0.5 hover:bg-[#0062a2] active:translate-y-0 active:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none"
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
            {selectedScheduleEntry && ownOpenRequests.length > 0 && (
              <div className="mt-6 rounded-3xl border-2 border-zinc-200 bg-zinc-50 p-4">
                <h3 className="text-lg font-black text-zinc-800">Sub needs for this game</h3>
                <p className="mb-3 text-sm font-bold text-zinc-500">
                  {demoMode ? 'Testing requests can be edited or cancelled.' : 'Verify your game email above to edit or cancel before the captain deadline.'}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {ownOpenRequests.map(request => {
                    const canCancel = !request.drawAt || currentDate.getTime() < new Date(request.drawAt).getTime();
                    return (
                      <article key={request.id} className="rounded-2xl border-2 border-zinc-200 bg-white p-3">
                        <div className="font-black">{request.teamName}</div>
                        <div className="text-sm font-bold text-zinc-500">
                          {request.weekLabel ? `${request.weekLabel} · ` : ''}{request.gameLabel} · {getPoolLabel(request.pool)} · {request.slotsNeeded ?? 1} needed
                        </div>
                        {canCancel && (
                          <div className="mt-3 space-y-3">
                            <div className="flex gap-2">
                              <button type="button" disabled={isBusy || !captainVerified} onClick={() => {
                                setEditingRequestId(request.id); setEditPool(request.pool); setEditSlots(String(request.slotsNeeded ?? 1));
                              }} className="rounded-xl border-2 border-sky-600 px-3 py-2 text-sm font-black text-sky-700 disabled:opacity-40">Edit need</button>
                              <button type="button" disabled={isBusy || !captainVerified} onClick={() => {
                                if (window.confirm(`Cancel the ${getPoolLabel(request.pool).toLowerCase()} need for ${request.teamName} at ${request.gameLabel}?`)) {
                                  onCancelRequest?.({ requestId: request.id, captainPin: effectiveCaptainPin });
                                }
                              }} className="rounded-xl border-2 border-red-200 px-3 py-2 text-sm font-black text-red-700 disabled:opacity-40">Cancel need</button>
                            </div>
                            {editingRequestId === request.id && (
                              <form onSubmit={async event => {
                                event.preventDefault();
                                const slotsNeeded = Number(editSlots);
                                if (!Number.isInteger(slotsNeeded) || slotsNeeded < 1) return;
                                if (await onUpdateRequest?.({ requestId: request.id, captainPin: effectiveCaptainPin, pool: editPool, slotsNeeded })) setEditingRequestId('');
                              }} className="grid gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:grid-cols-2">
                                <label className="text-sm font-bold">Matching pool
                                  <select value={editPool} onChange={event => setEditPool(event.target.value as SubLotteryPool)} className="mt-1 block w-full rounded-lg border p-2">
                                    <option value="open">Open matching</option><option value="female">Female matching</option>
                                  </select>
                                </label>
                                <label className="text-sm font-bold">Subs needed
                                  <input type="number" min="1" step="1" value={editSlots} onChange={event => setEditSlots(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" />
                                </label>
                                <div className="flex gap-2 sm:col-span-2">
                                  <button type="submit" disabled={isBusy || !captainVerified || !Number.isInteger(Number(editSlots)) || Number(editSlots) < 1} className="rounded-lg bg-[#0071bb] px-3 py-2 font-bold text-white disabled:opacity-40">Save change</button>
                                  <button type="button" onClick={() => setEditingRequestId('')} className="rounded-lg border px-3 py-2 font-bold">Keep current need</button>
                                </div>
                              </form>
                            )}
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
            />
          ))}
        </div>
        )}

        {activeTab === 'results' && (
        <section
          id="sub-lottery-panel-results"
          role="tabpanel"
          aria-labelledby="sub-lottery-tab-results"
          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700"><Trophy className="h-7 w-7" /></div>
            <div>
              <h2 id="sub-lottery-results-heading" className="text-2xl font-black text-zinc-950">Results</h2>
              <p className="font-semibold text-zinc-500">
                {showingRecentResults
                  ? `Latest completed draw: week of ${formatWeekStart(state.recentWeekStartDate)}. New requests appear in the captain and sub tabs.`
                  : workflow.phase === 'results'
                  ? 'See which subs were assigned after the Monday draw.'
                  : workflow.phase === 'lottery'
                    ? 'The draw is running now. Results will appear here shortly.'
                    : 'Results will appear here after the Monday draw.'}
              </p>
            </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {resultRequests.map(request => {
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
              </article>
              );
            })}
          </div>
          {resultRequests.length === 0 && <p className="rounded-2xl bg-zinc-50 p-4 font-semibold text-zinc-600">No draw results are available yet. Check back after Monday’s draw.</p>}
          <p className="mt-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            Lottery note: every sub player starts with 5 coins. Each draw they win uses 1 coin. Everyone always keeps at least 1 coin, so everyone still has a chance.
          </p>
        </section>
        )}

        {activeTab === 'results' && <details className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
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
        </details>}
      </div>
    </main>
  );
}

function SubLotteryTabs({
  activeTab,
  workflow,
  currentDate,
  onSelect,
}: {
  activeTab: SubLotteryTab;
  workflow: ReturnType<typeof getSubLotteryWorkflowState>;
  currentDate: Date;
  onSelect: (tab: SubLotteryTab) => void;
}) {
  const tabs: Array<{ id: SubLotteryTab; label: string; icon: typeof Crown }> = [
    { id: 'captain', label: 'Need a sub', icon: Crown },
    { id: 'sub', label: 'Can sub', icon: Users },
    { id: 'results', label: 'Results', icon: Trophy },
  ];

  return (
    <section className="sticky top-0 z-30 overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-sm backdrop-blur" aria-label="Sub lottery navigation">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-zinc-700">{workflow.nextDeadlineLabel}</p>
          <p className="text-xs font-semibold text-zinc-500">{formatDeadline(workflow.nextDeadlineAt)}</p>
        </div>
        <div className="shrink-0 rounded-lg bg-[#eef8ff] px-3 py-2 text-right text-[#005288]">
          <p className="text-xs font-bold">Time remaining</p>
          <p className="text-base font-black leading-tight">{formatCountdown(workflow.nextDeadlineAt, currentDate)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3" role="tablist" aria-label="Choose a sub lottery task">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`sub-lottery-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`sub-lottery-panel-${tab.id}`}
              onClick={() => onSelect(tab.id)}
              className={cn(
                'relative flex min-h-14 items-center justify-center gap-1.5 border-r border-zinc-200 px-2 py-3 text-sm font-bold transition last:border-r-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0071bb]',
                isActive ? 'bg-[#0071bb] text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function IdentityVerification({ kind, subjectId, captainPin, onVerified }: {
  kind: SubLotteryIdentityKind;
  subjectId: string;
  captainPin?: string;
  onVerified: (subjectId: string, verified: boolean) => void;
}) {
  const [verified, setVerified] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setVerified(false);
    setSent(false);
    setCode('');
    setError('');
    void loadAccessStatus({ kind, subjectId }).then(result => {
      if (active) { setVerified(result.verified); onVerified(subjectId, result.verified); }
    }).catch(() => { if (active) setError('Could not check your verification. You can request a new code.'); });
    return () => { active = false; };
  }, [kind, subjectId, onVerified]);

  const label = kind === 'player' ? 'player' : 'captain';
  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-sm" aria-live="polite">
      <div className="font-black">{verified ? `Your ${label} email is verified for this session` : `Verify your ${label} email`}</div>
      {!verified && <>
        <p className="mt-1 font-semibold">We will send a six-digit code to the email on file for this {label}. Verification is needed before you can change lottery entries.</p>
        <button type="button" disabled={busy} onClick={async () => {
          setBusy(true); setError('');
          try { await requestAccessCode({ kind, subjectId, captainPin }); setSent(true); }
          catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Code could not be sent.'); }
          finally { setBusy(false); }
        }} className="mt-3 rounded-xl border-2 border-emerald-700 bg-white px-3 py-2 font-black text-emerald-800 disabled:opacity-40">{sent ? 'Send a new code' : 'Email me a code'}</button>
        {sent && <form onSubmit={async event => {
          event.preventDefault(); setBusy(true); setError('');
          try { await verifyAccessCode({ kind, subjectId, code }); setVerified(true); onVerified(subjectId, true); }
          catch (verifyError) { setError(verifyError instanceof Error ? verifyError.message : 'Code could not be verified.'); }
          finally { setBusy(false); }
        }} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="font-bold">Email code
            <input value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="mt-1 block w-36 rounded-lg border p-2" />
          </label>
          <button type="submit" disabled={busy || code.length !== 6} className="rounded-xl bg-emerald-700 px-3 py-2 font-black text-white disabled:opacity-40">Verify code</button>
        </form>}
      </>}
      {error && <p role="alert" className="mt-2 font-bold text-red-700">{error}</p>}
    </div>
  );
}

function ClosedRolePanel({
  audience,
  title,
  message,
}: {
  audience: Exclude<SubLotteryTab, 'results'>;
  title: string;
  message: string;
}) {
  const Icon = audience === 'sub' ? Users : Crown;
  const iconClasses = audience === 'sub' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700';

  return (
    <section className="rounded-[2rem] border-2 border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-2xl p-3', iconClasses)}><Icon className="h-6 w-6" /></div>
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-zinc-500">Current action</div>
            <h2 className="text-2xl font-black">{title}</h2>
            <p className="mt-1 font-semibold text-zinc-500">{message}</p>
          </div>
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
        className="h-12 w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 text-base font-bold outline-none transition placeholder:text-zinc-300 focus:border-[#0071bb] focus:ring-4 focus:ring-[#bfe6ff]"
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
  placeholder = 'Choose a game',
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-black uppercase tracking-wide text-zinc-500">{label}</label>
      <select
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border-2 border-zinc-200 bg-white px-4 text-base font-bold outline-none transition focus:border-[#0071bb] focus:ring-4 focus:ring-[#bfe6ff]"
      >
        <option value="">{placeholder}</option>
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
    : 'focus:border-[#0071bb] focus:ring-4 focus:ring-[#bfe6ff]';

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
