import Link from "next/link";

type EmptyAction = {
  href: string;
  label: string;
};

type EmptyStateProps = {
  title: string;
  description: string;
  actions?: EmptyAction[];
};

export function EmptyState({ title, description, actions = [] }: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-dashed border-emerald-400/30 bg-emerald-400/10 p-8 text-center shadow-2xl shadow-emerald-950/10">
      <div className="mx-auto grid size-12 place-items-center rounded-lg bg-emerald-400 text-lg font-black text-black">F</div>
      <h2 className="mt-5 text-2xl font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-300">{description}</p>
      {actions.length > 0 ? (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-lg border border-white/10 bg-black px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-emerald-400/40 hover:text-emerald-200"
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
