import { Loader2, Plus, Sparkles, SquarePen } from 'lucide-react';

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
  onAddManualIteration: () => void;
  onAddAiIteration: () => void;
  className?: string;
}

function getIterationIcon(iteration: TeamIteration) {
  if (iteration.status === 'generating') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  }

  if (iteration.type === 'manual') {
    return <SquarePen className="h-3.5 w-3.5" />;
  }

  return <Sparkles className="h-3.5 w-3.5" />;
}

export function TeamIterationTabs({
  iterations,
  activeIterationId,
  onSelectIteration,
  onAddManualIteration,
  onAddAiIteration,
  className,
}: TeamIterationTabsProps) {
  if (iterations.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2 overflow-x-auto pb-1', className)}>
      {iterations.map(iteration => {
        const isActive = iteration.id === activeIterationId;

        return (
          <button
            key={iteration.id}
            type="button"
            onClick={() => onSelectIteration(iteration.id)}
            className={cn(
              'inline-flex min-w-fit items-center gap-2 rounded-t-xl border border-b-0 px-4 py-2 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-white text-slate-900 border-slate-200 shadow-sm'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-50'
            )}
          >
            {getIterationIcon(iteration)}
            <span>{iteration.name}</span>
            {iteration.status === 'failed' && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                Failed
              </span>
            )}
          </button>
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
          <DropdownMenuItem onClick={onAddAiIteration}>
            <Sparkles className="h-4 w-4" />
            New AI Iteration
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
