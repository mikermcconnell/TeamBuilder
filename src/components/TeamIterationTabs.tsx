import { Copy, Loader2, Plus, SquarePen } from 'lucide-react';

import { TeamIteration } from '@/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface TeamIterationTabsProps {
  iterations: TeamIteration[];
  activeIterationId: string | null;
  onSelectIteration: (iterationId: string) => void;
  onCopyIteration: (iterationId: string) => void;
  onAddManualIteration: () => void;
  className?: string;
}

function getIterationIcon(iteration: TeamIteration) {
  if (iteration.status === 'generating') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  }

  return <SquarePen className="h-3.5 w-3.5" />;
}

function getIterationLabel(iteration: TeamIteration) {
  if (iteration.type === 'ai') {
    return iteration.name.replace(/^AI\b/i, 'Team');
  }

  return iteration.name;
}

export function TeamIterationTabs({
  iterations,
  activeIterationId,
  onSelectIteration,
  onCopyIteration,
  onAddManualIteration,
  className,
}: TeamIterationTabsProps) {
  if (iterations.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2 overflow-x-auto pb-1', className)}>
      {iterations.map(iteration => {
        const isActive = iteration.id === activeIterationId;
        const iterationLabel = getIterationLabel(iteration);

        return (
          <div key={iteration.id} className="inline-flex items-stretch">
            <button
              type="button"
              onClick={() => onSelectIteration(iteration.id)}
              className={cn(
                'inline-flex min-w-fit items-center gap-2 rounded-l-xl border border-b-0 px-4 py-2 text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-white text-slate-900 border-slate-200 shadow-sm'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
            >
              {getIterationIcon(iteration)}
              <span>{iterationLabel}</span>
              {iteration.status === 'failed' && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                  Failed
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onCopyIteration(iteration.id)}
              disabled={iteration.status !== 'ready'}
              title={iteration.status === 'ready' ? `Copy ${iterationLabel}` : 'Only ready tabs can be copied'}
              className={cn(
                'inline-flex items-center justify-center rounded-r-xl border border-b-0 border-l-0 px-3 transition-colors',
                isActive
                  ? 'bg-white text-slate-500 border-slate-200 hover:text-slate-900'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900',
                iteration.status !== 'ready' && 'cursor-not-allowed opacity-50 hover:bg-inherit hover:text-slate-500'
              )}
              aria-label={`Copy ${iterationLabel}`}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-dashed border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={onAddManualIteration}>
            <SquarePen className="h-4 w-4" />
            New Manual Iteration
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
