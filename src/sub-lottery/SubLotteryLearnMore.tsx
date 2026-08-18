import { CircleHelp } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const PROCESS_STEPS = [
  {
    title: 'Captains add their sub needs',
    timing: 'Before Sunday at 11:59 PM',
    details: 'A captain chooses their scheduled game, requests an open matching or female matching sub, and enters how many players are needed. The request can be edited or cancelled before the captain deadline.',
  },
  {
    title: 'Subs enter and rank games',
    timing: 'Monday from 12:00 AM to 11:59 AM',
    details: 'A sub picks their name and sees only the games that match their player pool. They enter every game they can attend, then arrange those choices from first to last. Choices can be changed until entries close.',
  },
  {
    title: 'The lottery runs',
    timing: 'Monday at 12:01 PM',
    details: 'The draw uses secure, saved randomness. Players with fewer accepted sub games this season receive more lottery entries. Rankings are considered, and one person can win no more than one game that week.',
  },
  {
    title: 'Winners are assigned and notified',
    timing: 'Right after the draw',
    details: 'Winning the lottery is the final assignment, so no response is required. The winner receives an email and the captain is copied. If no eligible sub is available, the captain receives an unfilled-request email instead.',
  },
] as const;

export function SubLotteryLearnMore() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#0071bb] bg-[#eef8ff] px-3 py-2 text-xs font-black text-[#005288] transition hover:bg-[#dff2ff] focus:outline-none focus:ring-4 focus:ring-[#bfe6ff]"
          aria-label="Learn how the sub lottery works"
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
          Learn more
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-3xl overflow-y-auto rounded-2xl border-2 border-[#bfe6ff] p-0 text-[#333333] sm:rounded-2xl">
        <DialogHeader className="border-b border-zinc-200 bg-[#eef8ff] px-5 py-5 pr-12 text-left sm:px-7">
          <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#0071bb]">
            <CircleHelp className="h-4 w-4" aria-hidden="true" /> How it works
          </div>
          <DialogTitle className="text-2xl font-black text-[#333333]">The sub lottery, in simple terms</DialogTitle>
          <DialogDescription className="max-w-2xl text-sm font-semibold leading-6 text-zinc-600">
            Captains say which games need subs. Eligible players rank the games they can attend. A fair draw assigns the subs and emails the result.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-5 sm:px-7 sm:py-6">
          {PROCESS_STEPS.map((step, index) => (
            <section key={step.title} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm" aria-labelledby={`sub-lottery-process-step-${index + 1}`}>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0071bb] text-sm font-black text-white">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <h3 id={`sub-lottery-process-step-${index + 1}`} className="text-base font-black text-zinc-900">{step.title}</h3>
                  <div className="mt-1 text-xs font-black uppercase tracking-wide text-[#0071bb]">{step.timing}</div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{step.details}</p>
                </div>
              </div>
            </section>
          ))}

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">
            The goal is simple: fill each open roster spot fairly while giving more opportunities to players who have subbed less often this season.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
