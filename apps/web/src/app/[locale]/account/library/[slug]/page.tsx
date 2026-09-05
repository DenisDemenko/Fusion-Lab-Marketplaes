"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { LessonProgressEntry, LibraryItemDetail } from "@fusion-lab/shared-types";
import { DownloadButton } from "@/components/download-button";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
import type { Locale } from "@/i18n/routing";
import { formatBytes } from "@/lib/format";
import { youtubeEmbedUrl } from "@/lib/youtube";

export default function LibraryItemPage() {
  return (
    <RequireAuth>
      <LibraryItemScreen />
    </RequireAuth>
  );
}

function progressKey(moduleIndex: number, lessonIndex: number): string {
  return `${moduleIndex}:${lessonIndex}`;
}

function LibraryItemScreen() {
  const t = useTranslations("accountLibraryItem");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [item, setItem] = useState<LibraryItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function load() {
    try {
      setItem(await api.get<LibraryItemDetail>(`/me/library/${slug}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadFailed"));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function toggleLesson(moduleIndex: number, lessonIndex: number, completed: boolean) {
    const key = progressKey(moduleIndex, lessonIndex);
    setBusyKey(key);
    try {
      const progress = await api.post<LessonProgressEntry[]>(
        `/me/library/${slug}/progress`,
        { moduleIndex, lessonIndex, completed },
      );
      setItem((current) => (current ? { ...current, progress } : current));
    } catch {
      // A failed toggle just leaves the checkbox where it was — no
      // separate error banner for something this low-stakes.
    } finally {
      setBusyKey(null);
    }
  }

  if (error) {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-center text-[var(--danger)]">{error}</p>;
  }

  if (!item) {
    return <p className="mx-auto max-w-3xl px-4 py-16 text-[var(--muted)]">{tCommon("loading")}</p>;
  }

  const files = item.files ?? [];
  const isBook = item.listing.kind === "book";

  const filesSection =
    files.length > 0 ? (
      <section className="card mb-8 p-5">
        <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
          {isBook ? t("bookFilesTitle") : t("materialsTitle")}
        </h2>
        <ul className="mt-3 divide-y divide-[var(--line)]">
          {files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">
                  {file.filename}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {formatBytes(file.sizeBytes, locale)} · {file.mimeType}
                </p>
              </div>
              <DownloadButton
                file={file}
                label={isBook && files.length === 1 ? t("downloadBook") : undefined}
                className={isBook && files.length === 1 ? "btn-primary" : "btn-ghost"}
              />
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  const modules = item.listing.curriculum?.modules ?? [];
  const totalLessons = modules.reduce((sum, module) => sum + (module.lessons?.length ?? 0), 0);
  const completedSet = new Set(item.progress.map((p) => progressKey(p.moduleIndex, p.lessonIndex)));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/account/library" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        {t("backToLibrary")}
      </Link>

      <PageHeader title={item.listing.title} />

      {/* Progress used to live as one line of PageHeader description text —
          a fraction buried in a sentence. A filled bar (same shape as the
          schedule page's capacity bar) makes "almost done" legible before
          the numbers are read. */}
      {totalLessons > 0 ? (
        <div className="mb-8 max-w-sm">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-mono text-[var(--foreground)]">
              {t("progressLabel", { done: completedSet.size, total: totalLessons })}
            </span>
            <span className="font-mono text-xs text-[var(--muted)]">
              {Math.round((completedSet.size / totalLessons) * 100)}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--neutral-bg)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width]"
              style={{
                width: `${Math.min(100, Math.round((completedSet.size / totalLessons) * 100))}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {/*
        Файли покупця. Досі ця сторінка вміла показувати ЛИШЕ програму
        занять — тобто книга, куплена й відкрита, не давала жодного способу
        її отримати: буквально порожня сторінка з написом «немає програми
        занять». Файли й так приходили з `/me/library/:slug`, їх просто
        ніхто не малював.

        Порядок залежить від того, що це за товар. У книги файл — єдина
        причина, чому покупець сюди зайшов, тож він іде першим і головною
        кнопкою. У курсу головне — заняття, а матеріали доповнюють їх, тож
        там перелік стоїть нижче.
      */}
      {files.length > 0 && modules.length === 0 ? filesSection : null}

      <div className="space-y-6">
        {modules.map((module, moduleIndex) => (
          <section key={moduleIndex} className="card p-5">
            <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">
              {module.title}
            </h2>

            <ol className="mt-3 space-y-4">
              {(module.lessons ?? []).map((lesson, lessonIndex) => {
                const key = progressKey(moduleIndex, lessonIndex);
                const done = completedSet.has(key);
                const embedUrl = lesson.videoUrl ? youtubeEmbedUrl(lesson.videoUrl) : null;

                return (
                  <li key={lessonIndex} className="border-t border-[var(--line)] pt-4 first:border-0 first:pt-0">
                    <div className="flex items-start justify-between gap-3">
                      {/* A watched lesson used to look identical to an
                          unwatched one except for the checkbox itself —
                          the muted/strikethrough pair lets a returning
                          student scan the module for what's left. */}
                      <p
                        className={
                          done
                            ? "font-medium text-[var(--muted)] line-through decoration-[var(--line)]"
                            : "font-medium text-[var(--foreground)]"
                        }
                      >
                        {lesson.title}
                      </p>
                      <label className="flex shrink-0 items-center gap-2 text-sm text-[var(--muted)]">
                        <input
                          type="checkbox"
                          checked={done}
                          disabled={busyKey === key}
                          onChange={(event) =>
                            void toggleLesson(moduleIndex, lessonIndex, event.target.checked)
                          }
                        />
                        {t("watched")}
                      </label>
                    </div>

                    {embedUrl ? (
                      <div className="mt-3 aspect-video overflow-hidden rounded-xl border border-[var(--line)]">
                        <iframe
                          src={embedUrl}
                          title={lesson.title}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : lesson.videoUrl ? (
                      <p className="mt-2 text-xs text-[var(--muted)]">{t("videoUnavailable")}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}

        {/*
          «Немає програми занять» доречне лише там, де програму й очікують.
          Книзі цей напис нічого не пояснював — вона й не мала занять; тому
          він лишається тільки для випадку, коли немає ні занять, ні файлів.
        */}
        {modules.length === 0 && files.length === 0 ? (
          <p className="card p-8 text-center text-[var(--muted)]">{t("noFilesYet")}</p>
        ) : null}
      </div>

      {files.length > 0 && modules.length > 0 ? <div className="mt-8">{filesSection}</div> : null}
    </div>
  );
}
