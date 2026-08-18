import React, { useEffect, useState } from 'react';

import { loadSubLotteryState, respondToSelection } from './api';
import { SubLotteryBrandHeader } from './SubLotteryBrandHeader';

export function SubLotteryRespond() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [message, setMessage] = useState('');
  const [seasonName, setSeasonName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void loadSubLotteryState()
      .then(state => {
        if (active) setSeasonName(state.seasonName);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const respond = async (response: 'accept' | 'decline') => {
    setBusy(true);
    try {
      const result = await respondToSelection({ token, response });
      setMessage(result.message);
    } catch (responseError) {
      setMessage(responseError instanceof Error ? responseError.message : 'Response failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#333333]">
      <SubLotteryBrandHeader seasonName={seasonName} sectionLabel="Sub Lottery" />
      <main className="p-6">
        <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-zinc-200 bg-white p-7 text-center shadow-lg">
          <h1 className="text-3xl font-black">Your sub spot</h1>
          {message ? (
            <>
              <p className="my-5 font-bold">{message}</p>
              <a className="font-black text-[#0071bb]" href="/sub-lottery">View lottery</a>
            </>
          ) : (
            <>
              <p className="my-5 font-bold text-zinc-600">Please accept or decline by the deadline shown in your email.</p>
              <div className="grid grid-cols-2 gap-3">
                <button disabled={busy || !token} onClick={() => void respond('accept')} className="rounded-xl bg-emerald-600 p-4 font-black text-white focus:outline-none focus:ring-4 focus:ring-emerald-200">Accept</button>
                <button disabled={busy || !token} onClick={() => void respond('decline')} className="rounded-xl border-2 border-red-500 p-4 font-black text-red-700 focus:outline-none focus:ring-4 focus:ring-red-200">Decline</button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
