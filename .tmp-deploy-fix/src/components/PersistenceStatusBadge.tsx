import { Cloud, HardDrive, LoaderCircle, TriangleAlert } from 'lucide-react';

import { PersistenceStatusModel } from '@/hooks/useAppPersistence';

interface PersistenceStatusBadgeProps {
  status: PersistenceStatusModel;
}

const toneStyles: Record<PersistenceStatusModel['tone'], string> = {
  neutral: 'border-slate-200 bg-white text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-800',
};

export function PersistenceStatusBadge({ status }: PersistenceStatusBadgeProps) {
  const iconClassName = 'h-4 w-4 shrink-0';

  const icon = status.icon === 'cloud'
    ? <Cloud className={iconClassName} />
    : status.icon === 'local'
      ? <HardDrive className={iconClassName} />
      : status.icon === 'saving'
        ? <LoaderCircle className={`${iconClassName} animate-spin`} />
        : <TriangleAlert className={iconClassName} />;

  return (
    <div
      data-testid="persistence-status"
      className={`min-w-[210px] rounded-xl border px-3 py-2 shadow-sm transition-colors ${toneStyles[status.tone]}`}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">{status.title}</div>
          <div className="text-xs opacity-80 leading-tight">{status.detail}</div>
        </div>
      </div>
    </div>
  );
}
