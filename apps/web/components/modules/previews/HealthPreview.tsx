// apps/web/components/modules/previews/HealthPreview.tsx
'use client';

import Link from 'next/link';
import { useRealtimeModuleList } from '@/lib/modules/client';
import { useCampusScope } from '@/lib/use-campus-scope';
import { withCampusScope } from '@/lib/campus-scope';
import { Badge, EmptyState, SkeletonList, statusTone } from '../ui';
import { formatDateTime } from '@/lib/utils';
import { asArray } from '@/lib/render-safe';

export default function HealthPreview() {
  const { scope } = useCampusScope();
  const requests = useRealtimeModuleList('blood-requests', { limit: 3 });

  if (requests.loading) return <SkeletonList rows={1} />;
  if (asArray(requests.data).length === 0) {
    return <EmptyState icon="🩸" title="No open blood requests" description="Requests broadcast to matching donors instantly." />;
  }

  return (
    <div className="space-y-2">
      {asArray(requests.data).map((request) => (
        <Link
          key={String(request.id)}
          href={withCampusScope("/health", scope)}
          className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs hover:border-emerald-500/40 border border-transparent transition"
        >
          <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-extrabold text-[11px]">
            {request.blood_group}
          </span>
          <span className="font-semibold">
            {request.bags_needed} bag(s) • {request.hospital_name}
          </span>
          <Badge tone={statusTone(request.urgency)}>{String(request.urgency)}</Badge>
          <span className="text-[10px] text-slate-400 ml-auto">needed {formatDateTime(request.needed_by)}</span>
        </Link>
      ))}
    </div>
  );
}
