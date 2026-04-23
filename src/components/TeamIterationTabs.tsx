import { Copy, FileText, Flag, Loader2, MoreHorizontal, Plus, SquarePen, Star, Trash2 } from 'lucide-react';

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
  onDeleteIteration: (iterationId: string) => void;
  onEditIteration?: (iterationId: string) => void;
  onMarkPreferred?: (iterationId: string) => void;
  onMarkFinal?: (iterationId: string) => void;
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
  onDeleteIteration,
  onEditIteration,
  onMarkPreferred,
  onMarkFinal,
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
        const isReady = iteration.status === 'ready';

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
              {iteration.isPreferred && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Preferred
                </span>
              )}
              {iteration.isFinal && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  Final
                </span>
              )}
              {iteration.note && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                  <FileText className="h-3 w-3" />
                  Note
                </span>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title={`More actions for ${iterationLabel}`}
                  className={cn(
                    'inline-flex items-center justify-center rounded-r-xl border border-b-0 border-l-0 px-3 transition-colors',
                    isActive
                      ? 'bg-white text-slate-500 border-slate-200 hover:text-slate-900'
                      : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  )}
                  aria-label={`More actions for ${iterationLabel}`}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem disabled={!onEditIteration} onClick={() => onEditIteration?.(iteration.id)}>
                  <SquarePen className="h-4 w-4" />
                  Edit Name &amp; Note
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!isReady} onClick={() => onCopyIteration(iteration.id)}>
                  <Copy className="h-4 w-4" />
                  Duplicate Draft
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!isReady || !onMarkPreferred} onClick={() => onMarkPreferred?.(iteration.id)}>
                  <Star className="h-4 w-4" />
                  Mark Preferred
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!isReady || !onMarkFinal} onClick={() => onMarkFinal?.(iteration.id)}>
                  <Flag className="h-4 w-4" />
                  Mark Final
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => onDeleteIteration(iteration.id)}>
                  <Trash2 className="h-4 w-4" />
                  Delete Draft
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
