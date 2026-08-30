import type { ReactNode } from "react";

// Every inner page opened the same way: a `.section-title` and a small grey
// line under it, which is the same weight the page then uses for section
// headings further down — so nothing announced "this is the top of the
// page". This gives that job one component: a larger display size than
// `.section-title`, an optional accent eyebrow for context, and a slot on
// the right for whatever the page counts or acts on.
//
// Deliberately not a `globals.css` class: the eyebrow/actions slots are
// structure, not styling, and a class could not carry them.
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-[var(--line)] pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="font-mono text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl leading-relaxed text-[var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}
