import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200", className)} />;
}

// Generic card-grid skeleton (for team, clients, packages etc.)
export function CardGridSkeleton({ cards = 6, cols = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" }: { cards?: number; cols?: string }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5"><Bone className="h-6 w-32" /><Bone className="h-4 w-24 bg-slate-100" /></div>
        <Bone className="h-9 w-28" />
      </div>
      <Bone className="h-10 w-full" />
      <div className={cn("grid gap-3", cols)}>
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Bone className="w-11 h-11 rounded-full flex-shrink-0 bg-slate-200" />
              <div className="flex-1 space-y-1.5">
                <Bone className="h-4 w-24" />
                <Bone className="h-3 w-16 bg-slate-100" />
              </div>
            </div>
            <div className="flex gap-1.5">
              <Bone className="h-5 w-16 rounded-full bg-slate-100" />
              <Bone className="h-5 w-20 rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Table/list skeleton (for programs, invoices, payments)
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5"><Bone className="h-6 w-32" /><Bone className="h-4 w-24 bg-slate-100" /></div>
        <Bone className="h-9 w-28" />
      </div>
      <div className="flex gap-2">
        <Bone className="h-10 flex-1" />
        <Bone className="h-10 w-24" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => <Bone key={i} className="h-7 w-20 rounded-full bg-slate-100" />)}
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={cn("flex items-center gap-4 px-4 py-3.5", i < rows - 1 && "border-b border-slate-50")}>
            <Bone className="w-8 h-8 rounded-full flex-shrink-0 bg-slate-100" />
            <div className="flex-1 space-y-1.5">
              <Bone className="h-4 w-48" />
              <Bone className="h-3 w-32 bg-slate-100" />
            </div>
            <Bone className="h-6 w-16 rounded-full bg-slate-100" />
            <Bone className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Dashboard skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Bone className="h-7 w-48" />
        <Bone className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
            <Bone className="h-3 w-20 bg-slate-100" />
            <Bone className="h-8 w-28" />
            <Bone className="h-3 w-16 bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <Bone className="h-5 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <Bone className="w-8 h-8 rounded-full flex-shrink-0 bg-slate-100" />
              <div className="flex-1 space-y-1.5"><Bone className="h-4 w-40" /><Bone className="h-3 w-24 bg-slate-100" /></div>
              <Bone className="h-6 w-16 rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <Bone className="h-5 w-32" />
          <Bone className="h-44 w-full bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
