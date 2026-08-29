"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { MyReview, ReviewSummary } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { ApiError, api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";

// Fetched client-side rather than passed down from the server-rendered
// listing page: reviews depend on the signed-in visitor's own review and
// purchase state, which a server component (no client auth token) cannot
// see — and review data changes often enough that revalidating the whole
// page just to show one new review would be wasteful.
export function ListingReviews({ listingId }: { listingId: string }) {
  const t = useTranslations("reviews");
  const locale = useLocale() as Locale;
  const { firebaseUser } = useAuth();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [mine, setMine] = useState<MyReview | null>(null);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api.get<ReviewSummary>(`/reviews/${listingId}`, {
      token: null,
    });
    setSummary(data);

    if (firebaseUser) {
      try {
        const own = await api.get<MyReview | null>(`/reviews/${listingId}/mine`);
        setMine(own);
        if (own) {
          setRating(own.rating);
          setBody(own.body ?? "");
        }
      } catch {
        setMine(null);
      }
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, firebaseUser]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.put(`/reviews/${listingId}`, { rating, body: body.trim() || undefined });
      setEditing(false);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.delete(`/reviews/${listingId}`);
      setMine(null);
      setBody("");
      setRating(5);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!summary) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-zinc-900">{t("title")}</h2>
        {summary.count > 0 ? (
          <span className="text-sm text-zinc-500">
            {"★".repeat(Math.round(summary.average))}
            {"☆".repeat(5 - Math.round(summary.average))} {summary.average.toFixed(1)} (
            {summary.count})
          </span>
        ) : null}
      </div>

      {firebaseUser ? (
        mine && !editing ? (
          <div className="card mt-3 p-4">
            <p className="text-sm text-amber-600">{"★".repeat(mine.rating)}</p>
            {mine.body ? <p className="mt-1 text-sm text-zinc-700">{mine.body}</p> : null}
            <div className="mt-2 flex gap-3 text-sm">
              <button
                type="button"
                className="text-zinc-600 hover:underline"
                onClick={() => setEditing(true)}
              >
                {t("edit")}
              </button>
              <button
                type="button"
                className="text-red-700 hover:underline"
                onClick={() => void remove()}
              >
                {t("delete")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="card mt-3 space-y-3 p-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-2xl ${star <= rating ? "text-amber-500" : "text-zinc-300"}`}
                  aria-label={t("starRating", { star })}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              className="input min-h-20"
              placeholder={t("bodyPlaceholder")}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={busy}>
                {mine ? t("save") : t("leaveReview")}
              </button>
              {mine ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setEditing(false)}
                >
                  {t("cancelEdit")}
                </button>
              ) : null}
            </div>
          </form>
        )
      ) : null}

      {summary.reviews.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{t("noReviewsYet")}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {summary.reviews.map((review) => (
            <div key={review.id} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-zinc-900">{review.authorName}</p>
                <p className="text-xs text-zinc-400">
                  {formatDate(review.createdAt, locale)}
                </p>
              </div>
              <p className="text-sm text-amber-600">{"★".repeat(review.rating)}</p>
              {review.body ? (
                <p className="mt-1 text-sm text-zinc-700">{review.body}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
