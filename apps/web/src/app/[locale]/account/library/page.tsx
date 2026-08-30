"use client";

import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import type { LibraryEntry } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { DownloadButton } from "@/components/download-button";
import { formatBytes, formatDate } from "@/lib/format";

export default function LibraryPage() {
  return (
    <RequireAuth>
      <LibraryScreen />
    </RequireAuth>
  );
}

function LibraryScreen() {
  const t = useTranslations("accountLibrary");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<LibraryEntry[]>("/me/library")
      .then(setEntries)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : t("loadFailed")),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-center text-[var(--danger)]">
        {error}
      </p>
    );
  }

  if (!entries) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-[var(--muted)]">{tCommon("loading")}</p>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="section-title">{t("emptyTitle")}</h1>
        <p className="mt-2 text-[var(--muted)]">{t("emptyBody")}</p>
        <Link href="/catalog" className="btn-primary mt-6">
          {t("browseCourses")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="section-title">{t("title")}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">{t("subtitle")}</p>

      <div className="mt-6 space-y-4">
        {entries.map((entry) => (
          <article key={entry.id} className="card p-5" data-testid="library-entry">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  href={`/catalog/${entry.listing.slug}`}
                  className="text-lg font-semibold text-[var(--foreground)] hover:underline"
                >
                  {entry.listing.title}
                </Link>
                <p className="text-sm text-[var(--muted)]">
                  {t("grantedAt", { date: formatDate(entry.grantedAt, locale) })}
                  {entry.orderNumber
                    ? ` · ${t("orderSuffix", { number: entry.orderNumber })}`
                    : ""}
                </p>
              </div>

              {entry.listing.kind === "course" ? (
                <Link
                  href={`/account/library/${entry.listing.slug}`}
                  className="shrink-0 text-sm font-medium text-[var(--accent)] hover:underline"
                >
                  {t("openCourse")}
                </Link>
              ) : null}
            </div>

            {entry.files.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">{t("noFilesYet")}</p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--line)]">
                {entry.files.map((file) => (
                  <li
                    key={file.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">
                        {file.filename}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatBytes(file.sizeBytes, locale)} · {file.mimeType}
                      </p>
                    </div>

                    <DownloadButton file={file} />
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
