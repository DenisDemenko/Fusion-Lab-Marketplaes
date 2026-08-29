"use client";

import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { uk: "UA", en: "EN" };

// Swaps the locale prefix while staying on the same page — including
// dynamic routes: useParams() supplies the current [slug]/[id]/[number]
// so `/catalog/[slug]` stays on the same listing instead of bouncing to
// the catalog root when a French... er, English visitor toggles language.
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();

  return (
    <div className="flex items-center rounded-xl border border-[var(--line)] p-0.5 text-sm">
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          disabled={code === locale}
          onClick={() =>
            router.replace(
              // @ts-expect-error — pathname is one of next-intl's known
              // routes at runtime; the exact union is more specific than
              // TypeScript can verify through this generic wrapper.
              { pathname, params },
              { locale: code },
            )
          }
          className={`rounded-lg px-2 py-1 font-medium transition-colors ${
            code === locale
              ? "bg-[var(--foreground)] text-white"
              : "text-[var(--muted)] hover:bg-[var(--neutral-bg)]"
          }`}
          aria-label={`${LABELS[code]}`}
          aria-current={code === locale ? "true" : undefined}
        >
          {LABELS[code] ?? code}
        </button>
      ))}
    </div>
  );
}
