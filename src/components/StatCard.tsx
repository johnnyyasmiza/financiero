import { formatMoney } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: number;
  trend?: string;
  tone?: string;
};

const toneClasses: Record<string, string> = {
  emerald: "from-emerald-400/20 to-emerald-500/5 text-emerald-300",
  blue: "from-sky-400/20 to-sky-500/5 text-sky-300",
  amber: "from-amber-400/20 to-amber-500/5 text-amber-300",
  violet: "from-violet-400/20 to-violet-500/5 text-violet-300",
};

export function StatCard({ label, value, trend, tone = "emerald" }: StatCardProps) {
  return (
    <article className="rounded-lg border border-white/10 bg-zinc-950/70 p-5 shadow-2xl shadow-black/20">
      <div className={`mb-5 h-1.5 w-16 rounded-full bg-gradient-to-r ${toneClasses[tone]}`} />
      <p className="text-sm text-zinc-400">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight text-white">{formatMoney(value)}</p>
        {trend ? (
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            {trend}
          </span>
        ) : null}
      </div>
    </article>
  );
}
