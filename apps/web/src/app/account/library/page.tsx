"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LibraryEntry } from "@fusion-lab/shared-types";
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
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<LibraryEntry[]>("/me/library")
      .then(setEntries)
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Не вдалося завантажити матеріали",
        ),
      );
  }, []);

  if (error) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-center text-red-700">
        {error}
      </p>
    );
  }

  if (!entries) {
    return (
      <p className="mx-auto max-w-3xl px-4 py-16 text-zinc-500">Завантаження…</p>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="section-title">Матеріалів поки немає</h1>
        <p className="mt-2 text-zinc-500">
          Після оплати замовлення курси й файли зʼявляться тут.
        </p>
        <Link href="/catalog" className="btn-primary mt-6">
          Обрати курс
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="section-title">Мої матеріали</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Доступ безстроковий — завантажуйте скільки потрібно.
      </p>

      <div className="mt-6 space-y-4">
        {entries.map((entry) => (
          <article key={entry.id} className="card p-5" data-testid="library-entry">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  href={`/catalog/${entry.listing.slug}`}
                  className="text-lg font-semibold text-zinc-900 hover:underline"
                >
                  {entry.listing.title}
                </Link>
                <p className="text-sm text-zinc-500">
                  Відкрито {formatDate(entry.grantedAt)}
                  {entry.orderNumber ? ` · замовлення ${entry.orderNumber}` : ""}
                </p>
              </div>
            </div>

            {entry.files.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                Продавець ще не додав файлів до цього матеріалу.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--line)]">
                {entry.files.map((file) => (
                  <li
                    key={file.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-800">
                        {file.filename}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatBytes(file.sizeBytes)} · {file.mimeType}
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
