"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { LessonProgressEntry, LibraryItemDetail } from "@fusion-lab/shared-types";
import { RequireAuth } from "@/components/require-auth";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api-client";
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

  const modules = item.listing.curriculum?.modules ?? [];
  const totalLessons = modules.reduce((sum, module) => sum + (module.lessons?.length ?? 0), 0);
  const completedSet = new Set(item.progress.map((p) => progressKey(p.moduleIndex, p.lessonIndex)));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/account/library" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        {t("backToLibrary")}
      </Link>

      <h1 className="section-title mt-3">{item.listing.title}</h1>

      {totalLessons > 0 ? (
        <p className="mt-1 text-sm text-[var(--muted)]">
          {t("progressLabel", { done: completedSet.size, total: totalLessons })}
        </p>
      ) : null}

      <div className="mt-6 space-y-6">
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
                      <p className="font-medium text-[var(--foreground)]">{lesson.title}</p>
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

        {modules.length === 0 ? (
          <p className="card p-8 text-center text-[var(--muted)]">{t("noCurriculum")}</p>
        ) : null}
      </div>
    </div>
  );
}
