import { LockButton } from "@/components/LockButton";
import { OfflineStatusBadge } from "@/components/OfflineStatusBadge";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-blue-100 bg-white/85 px-4 py-4 text-zinc-950 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">Financiero</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OfflineStatusBadge />
          <LockButton />
        </div>
      </div>
    </header>
  );
}
