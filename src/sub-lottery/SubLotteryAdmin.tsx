import React, { useState } from 'react';
import { ArrowLeft, Mail, RefreshCw, ShieldCheck } from 'lucide-react';

import {
  adminImportPlayers,
  adminImportSchedule,
  adminLogin,
  adminRetryEmail,
  adminRunReplacement,
  adminSendTestEmail,
  loadAdminOperations,
} from './api';
import type { AdminOperationsResponse } from './apiContracts';
import { parseSubPlayerCsv, parseSubScheduleCsv } from './core';
import { SubLotteryBrandHeader } from './SubLotteryBrandHeader';

const primaryButtonClasses = 'rounded-xl border-2 border-[#005288] bg-[#0071bb] px-4 py-3 font-black text-white transition hover:bg-[#0062a2] focus:outline-none focus:ring-4 focus:ring-[#bfe6ff] disabled:opacity-40';

export function SubLotteryAdmin() {
  const [pin, setPin] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [data, setData] = useState<AdminOperationsResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [playersCsv, setPlayersCsv] = useState('');
  const [scheduleCsv, setScheduleCsv] = useState('');
  const [seasonName, setSeasonName] = useState('Current season');

  const refresh = async () => setData(await loadAdminOperations(data?.state?.seasonId));
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#f8f8f8] text-[#333333]">
        <SubLotteryBrandHeader sectionLabel="Sub Lottery Admin" />
        <main className="p-6">
          <form
            onSubmit={async event => {
              event.preventDefault();
              setBusy(true);
              try {
                await adminLogin(pin);
                setAuthenticated(true);
                setData(await loadAdminOperations());
              } catch (loginError) {
                setError(loginError instanceof Error ? loginError.message : 'Login failed.');
              } finally {
                setBusy(false);
              }
            }}
            className="mx-auto mt-12 max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg"
          >
            <ShieldCheck className="mb-3 h-10 w-10 text-[#0071bb]" />
            <h1 className="text-2xl font-black">Administrator sign in</h1>
            <p className="mb-4 text-sm font-bold text-zinc-500">Secure 30-minute operations session.</p>
            <input
              autoFocus
              type="password"
              value={pin}
              onChange={event => setPin(event.target.value)}
              placeholder="Admin PIN"
              aria-label="Admin PIN"
              className="mb-3 w-full rounded-xl border-2 border-zinc-200 p-3 outline-none focus:border-[#0071bb] focus:ring-4 focus:ring-[#bfe6ff]"
            />
            <button disabled={busy} className={`w-full ${primaryButtonClasses}`}>Sign in</button>
            {error ? <p className="mt-3 font-bold text-red-600">{error}</p> : null}
            <a href="/sub-lottery" className="mt-4 block text-center text-sm font-bold text-[#005288]">Back to lottery</a>
          </form>
        </main>
      </div>
    );
  }

  const assignments = data?.assignments ?? [];
  const emails = data?.emails ?? [];
  const audit = data?.audit ?? [];
  const playerPreview = (() => {
    try { return parseSubPlayerCsv(playersCsv).length; } catch { return 0; }
  })();
  const schedulePreview = (() => {
    try { return parseSubScheduleCsv(scheduleCsv).length; } catch { return 0; }
  })();

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#333333]">
      <SubLotteryBrandHeader
        sectionLabel="Sub Lottery Admin"
        seasonName={data?.state?.seasonName}
        utility={(
          <>
            <a href="/sub-lottery" aria-label="Back to lottery" className="rounded-lg border border-[#0071bb] bg-white p-3 text-[#005288] focus:outline-none focus:ring-4 focus:ring-[#bfe6ff]"><ArrowLeft /></a>
            <button type="button" aria-label="Refresh operations" onClick={() => void act(refresh)} className="rounded-lg border border-[#0071bb] bg-white p-3 text-[#005288] focus:outline-none focus:ring-4 focus:ring-[#bfe6ff]"><RefreshCw /></button>
          </>
        )}
      />
      <main className="p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-5">
          <header>
            <h1 className="text-3xl font-black">Operations dashboard</h1>
            <p className="font-bold text-zinc-500">Week {data?.state?.weekStartDate ?? '—'} · {data?.state?.seasonName}</p>
          </header>
          {error ? <div className="rounded-xl bg-red-50 p-3 font-bold text-red-700">{error}</div> : null}

          <section className="grid gap-3 sm:grid-cols-4">
            {[
              ['Requests', data?.state?.requests?.length],
              ['Assignments', assignments.length],
              ['Email failures', emails.filter(item => item.status === 'failed').length],
              ['Draw records', data?.draws?.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="text-xs font-black uppercase text-[#005288]">{label}</div>
                <div className="text-3xl font-black">{value ?? 0}</div>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 text-xl font-black">Replacement vacancies</h2>
            {assignments.filter(item => item.status === 'declined' || item.status === 'expired').length === 0 ? (
              <p className="font-bold text-zinc-500">No replacements needed.</p>
            ) : assignments.filter(item => item.status === 'declined' || item.status === 'expired').map(item => (
              <div key={item.id} className="mb-2 flex items-center justify-between rounded-xl bg-amber-50 p-3">
                <span className="font-bold">{item.teamName} · {item.playerId} · {item.status}</span>
                <button disabled={busy} onClick={() => void act(() => adminRunReplacement(item.id!))} className="rounded-lg bg-amber-500 px-3 py-2 font-black">Run replacement</button>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><Mail /> Email operations</h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {['winner', 'winner-confirmation', 'captain-confirmation', 'decline', 'replacement'].map(template => (
                <button key={template} disabled={busy} onClick={() => void act(() => adminSendTestEmail(template))} className="rounded-lg border-2 border-zinc-200 px-3 py-2 text-sm font-black hover:border-[#0071bb]">Test {template}</button>
              ))}
            </div>
            {emails.slice(0, 20).map(item => (
              <div key={item.id} className="flex items-center justify-between border-t py-2 text-sm">
                <span>{item.kind ?? 'winner'} · {item.status} · {item.recipientEmail ?? item.playerEmail}</span>
                {item.status === 'failed' ? <button onClick={() => void act(() => adminRetryEmail(item.id))} className="font-black text-[#0071bb]">Retry</button> : null}
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="text-xl font-black">Import preview</h2>
            <p className="mb-3 text-sm font-bold text-zinc-500">Imports preserve season counts by normalized player email. Missing records become inactive.</p>
            <input value={seasonName} onChange={event => setSeasonName(event.target.value)} aria-label="Season name" className="mb-2 w-full rounded-xl border-2 border-zinc-200 p-2 focus:border-[#0071bb]" />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="font-black">Players CSV ({playerPreview} valid)<textarea value={playersCsv} onChange={event => setPlayersCsv(event.target.value)} rows={6} className="mt-1 w-full rounded-xl border-2 border-zinc-200 p-2 font-mono text-xs focus:border-[#0071bb]" /></label>
              <label className="font-black">Schedule CSV ({schedulePreview} valid)<textarea value={scheduleCsv} onChange={event => setScheduleCsv(event.target.value)} rows={6} className="mt-1 w-full rounded-xl border-2 border-zinc-200 p-2 font-mono text-xs focus:border-[#0071bb]" /></label>
            </div>
            <button
              disabled={busy || !playerPreview || !schedulePreview}
              onClick={() => void act(async () => {
                const nextState = await adminImportPlayers({ seasonId: data.state.seasonId, seasonName, adminPin: pin, csvText: playersCsv });
                await adminImportSchedule({ seasonId: nextState.seasonId, seasonName, adminPin: pin, csvText: scheduleCsv });
              })}
              className={`mt-3 ${primaryButtonClasses}`}
            >
              Import reviewed files
            </button>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 text-xl font-black">Historical weeks</h2>
            <div className="flex flex-wrap gap-2">
              {(data?.weeks ?? []).map(week => <span key={week} className="rounded-lg border-2 border-zinc-200 px-3 py-2 text-sm font-bold">Week of {week} · {(data.historicalRequests ?? []).filter(request => request.weekStartDate === week).length} requests</span>)}
            </div>
            <h3 className="mb-2 mt-4 font-black">Seasons</h3>
            <div className="flex flex-wrap gap-2">
              {(data?.seasons ?? []).map(season => (
                <button
                  key={season.id}
                  onClick={async () => {
                    setBusy(true);
                    try { setData(await loadAdminOperations(season.id)); } finally { setBusy(false); }
                  }}
                  className="rounded-lg border-2 border-zinc-200 px-3 py-2 text-sm font-bold hover:border-[#0071bb]"
                >
                  {season.name ?? season.id}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 text-xl font-black">Audit log</h2>
            {audit.slice(0, 50).map(item => <div key={item.id} className="border-t py-2 text-sm"><strong>{item.action}</strong> · {item.actor} · {item.createdAt}</div>)}
          </section>
        </div>
      </main>
    </div>
  );
}
