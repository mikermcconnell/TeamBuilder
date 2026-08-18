import type { ReactNode } from 'react';

interface SubLotteryBrandHeaderProps {
  seasonName?: string;
  sectionLabel?: string;
  utility?: ReactNode;
}

export function SubLotteryBrandHeader({
  seasonName,
  sectionLabel = 'Sub Lottery',
  utility,
}: SubLotteryBrandHeaderProps) {
  const visibleSeasonName = seasonName?.trim();

  return (
    <header className="border-b-4 border-[#0071bb] bg-white shadow-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <a href="/sub-lottery" className="flex min-w-0 items-center gap-3 rounded-lg focus:outline-none focus:ring-4 focus:ring-[#bfe6ff]">
          <img
            src="/barrie-ultimate-logo.jpg"
            alt="Barrie Ultimate League"
            className="h-auto w-44 shrink-0 object-contain sm:w-56"
          />
          <span className="min-w-0 border-l border-zinc-200 pl-3">
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-[#005288]">Barrie Ultimate League</span>
            <span className="block text-xl font-black leading-tight text-[#333333]">{sectionLabel}</span>
            {visibleSeasonName ? (
              <span className="block truncate text-sm font-bold text-[#0071bb]">{visibleSeasonName}</span>
            ) : null}
          </span>
        </a>
        {utility ? <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">{utility}</div> : null}
      </div>
    </header>
  );
}
