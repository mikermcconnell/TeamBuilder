import type { SubLotteryWorkflowState } from './workflow';
import { SUB_LOTTERY_TIME_ZONE } from './workflow';

interface SubLotteryWeekWindowsProps {
  workflow: SubLotteryWorkflowState;
  currentDate: Date;
}

type WindowStage = 'captain' | 'sub' | 'draw' | 'games';

const timelineColumns = 'repeat(6, minmax(0, 1fr)) repeat(3, minmax(0, 2fr))';

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatMonthDay(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(date);
}

function formatTorontoTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SUB_LOTTERY_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

function getCurrentStage(workflow: SubLotteryWorkflowState, currentDate: Date): WindowStage {
  if (workflow.phase === 'captain') return 'captain';
  if (workflow.phase === 'player') return 'sub';
  if (workflow.phase === 'lottery') return 'draw';

  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: SUB_LOTTERY_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(currentDate));
  return hour >= 18 ? 'games' : 'draw';
}

export function SubLotteryWeekWindows({ workflow, currentDate }: SubLotteryWeekWindowsProps) {
  const monday = new Date(`${workflow.targetWeekStartDate}T12:00:00Z`);
  const sunday = addUtcDays(monday, 6);
  const captainDays = Array.from({ length: 6 }, (_, index) => addUtcDays(monday, index - 6));
  const activeStage = getCurrentStage(workflow, currentDate);
  const lanes: Array<{
    stage: WindowStage;
    label: string;
    detail: string;
    column: string;
    color: string;
    activeRing: string;
    accessibleText: string;
  }> = [
    {
      stage: 'captain',
      label: 'Captains',
      detail: `Closes Sun ${formatTorontoTime(workflow.captainClosesAt)}`,
      column: '1 / 7',
      color: 'bg-[#0071bb]',
      activeRing: 'ring-[#0071bb]/30',
      accessibleText: `Captains add sub needs through Sunday, closing at ${formatTorontoTime(workflow.captainClosesAt)} Toronto time.`,
    },
    {
      stage: 'sub',
      label: 'Subs',
      detail: `Mon ${formatTorontoTime(workflow.availabilityOpensAt)}–${formatTorontoTime(workflow.availabilityClosesAt)}`,
      column: '7 / 8',
      color: 'bg-[#15966f]',
      activeRing: 'ring-[#15966f]/30',
      accessibleText: `Subs enter Monday morning from ${formatTorontoTime(workflow.availabilityOpensAt)} through ${formatTorontoTime(workflow.availabilityClosesAt)} Toronto time.`,
    },
    {
      stage: 'draw',
      label: 'Draw + results',
      detail: `Mon ${formatTorontoTime(workflow.drawAt)}`,
      column: '8 / 9',
      color: 'bg-[#b76a05]',
      activeRing: 'ring-[#b76a05]/30',
      accessibleText: `The draw runs Monday afternoon at ${formatTorontoTime(workflow.drawAt)} Toronto time; results follow.`,
    },
    {
      stage: 'games',
      label: 'Games',
      detail: 'Mon evening onward',
      column: '9 / 10',
      color: 'bg-[#405a9b]',
      activeRing: 'ring-[#405a9b]/30',
      accessibleText: 'The games stage begins Monday evening. Check your team schedule for actual game dates and times.',
    },
  ];

  return (
    <section aria-labelledby="sub-lottery-week-windows-heading" className="rounded-2xl border border-[#dbe7ee] bg-white px-3 py-4 shadow-sm sm:px-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="sub-lottery-week-windows-heading" className="text-lg font-black tracking-tight text-[#17334a]">Week windows</h2>
        <p className="text-xs font-bold text-[#62798b]">{workflow.phase === 'captain' ? 'Next game week' : 'This game week'} · {formatMonthDay(monday)}–{formatMonthDay(sunday)}</p>
      </div>
      <p className="sr-only">Current stage: {lanes.find(lane => lane.stage === activeStage)?.label}. All times are in Toronto.</p>
      <ol className="sr-only">
        {lanes.map(lane => <li key={lane.stage}>{lane.accessibleText}</li>)}
      </ol>

      <div aria-hidden="true" className="space-y-2.5">
        <div className="grid grid-cols-[76px_minmax(0,1fr)] items-end gap-2 sm:grid-cols-[106px_minmax(0,1fr)] sm:gap-3">
          <span />
          <div className="grid gap-[3px] text-center text-[8px] font-extrabold leading-tight text-[#62798b] sm:text-[10px]" style={{ gridTemplateColumns: timelineColumns }}>
            {captainDays.map(day => (
              <span key={day.toISOString()} className="min-w-0 py-1">
                <span className="block">{new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(day)}</span>
                <span className="block">{day.getUTCDate()}</span>
              </span>
            ))}
            {(['Morning', 'Afternoon', 'Evening'] as const).map(period => (
              <span key={period} className="min-w-0 rounded bg-[#f0f5f8] px-0.5 py-1 text-[#17334a]">
                <span className="block">Mon</span>
                <span className="block tracking-[-0.04em]">{period}</span>
              </span>
            ))}
          </div>
        </div>
        {lanes.map(lane => (
          <div key={lane.stage} className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[106px_minmax(0,1fr)] sm:gap-3">
            <div className="min-w-0 leading-tight">
              <div className="text-[11px] font-black text-[#17334a] sm:text-xs">{lane.label}</div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#62798b] sm:text-[10px]">{lane.detail}</div>
            </div>
            <div className="grid min-h-8 gap-[3px] rounded-lg bg-[repeating-linear-gradient(90deg,#edf2f5_0,#edf2f5_calc(8.333%_-_3px),transparent_calc(8.333%_-_3px),transparent_8.333%)]" style={{ gridTemplateColumns: timelineColumns }}>
              <span className={`my-[3px] rounded-md ${lane.color} ${activeStage === lane.stage ? `ring-[3px] ring-offset-1 ${lane.activeRing}` : ''}`} style={{ gridColumn: lane.column }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] font-semibold text-[#62798b]">Times shown in Toronto. Game times follow your team schedule.</p>
    </section>
  );
}
