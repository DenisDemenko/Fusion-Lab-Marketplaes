"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ClassSchedule } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

// docs/migration-plan.md Phase F2 — port of site/kontakty.html's booking
// intent, but as a real schedule with checked capacity (the design
// system's own "4 з 12 місць" pattern) instead of a free-text request
// form that can't actually reserve a seat.
export default function SchedulePage() {
  const t = useTranslations("schedulePage");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const { firebaseUser } = useAuth();

  const [slots, setSlots] = useState<ClassSchedule[] | null>(null);
  const [myScheduleIds, setMyScheduleIds] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const list = await api.get<ClassSchedule[]>("/schedule");
      setSlots(list);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadFailed"));
    }
  }

  async function loadMine() {
    if (!firebaseUser) {
      setMyScheduleIds(new Set());
      return;
    }
    try {
      const mine = await api.get<{ schedule: { id: string } }[]>("/me/bookings");
      setMyScheduleIds(new Set(mine.map((booking) => booking.schedule.id)));
    } catch {
      setMyScheduleIds(new Set());
    }
  }

  useEffect(() => {
    void load();
    void loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  async function book(scheduleId: string) {
    setBusyId(scheduleId);
    setError(null);
    try {
      await api.post(`/schedule/${scheduleId}/book`);
      await Promise.all([load(), loadMine()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("actionFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(scheduleId: string) {
    setBusyId(scheduleId);
    setError(null);
    try {
      await api.delete(`/schedule/${scheduleId}/book`);
      await Promise.all([load(), loadMine()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("actionFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("subtitle")}
      />

      {/* Was on literal Tailwind reds, which ignore the palette B1
          established and left this box the one cold thing on a warm page.
          The danger tokens are the same idea, tuned to the rest. */}
      {error ? (
        <p
          role="alert"
          className="mb-6 rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}

      {!slots || !myScheduleIds ? (
        <p className="mt-6 text-[var(--muted)]">{tCommon("loading")}</p>
      ) : slots.length === 0 ? (
        <p className="card mt-6 p-8 text-center text-[var(--muted)]">{t("empty")}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {slots.map((slot) => {
            const seatsLeft = slot.capacity - slot.bookedCount;
            const isMine = myScheduleIds.has(slot.id);

            return (
              <li
                key={slot.id}
                /* A booked slot gets an accent edge so "mine" is visible
                   while scanning, without reading every button. A full one
                   fades instead of disappearing — it still says when the
                   lab is busy. */
                className={`card flex flex-wrap items-center gap-4 border-l-4 p-5 transition-opacity ${
                  isMine
                    ? "border-l-[var(--accent)]"
                    : seatsLeft <= 0
                      ? "border-l-transparent opacity-65"
                      : "border-l-transparent"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-medium text-[var(--foreground)]">
                      {formatDateTime(slot.startsAt, locale)}
                    </p>
                    {isMine ? (
                      <span className="badge bg-[var(--success-soft)] text-[var(--success)]">
                        {t("slotMine")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-display font-semibold text-[var(--foreground)]">
                    {slot.title}
                  </p>
                  {slot.direction ? (
                    <span className="badge mt-1.5 bg-[var(--accent-soft)] text-[var(--accent)]">
                      {slot.direction}
                    </span>
                  ) : null}
                  {slot.description ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
                      {slot.description}
                    </p>
                  ) : null}

                  {/* Capacity was a grey caption, easy to miss on the one
                      decision this page asks for. A bar makes "almost full"
                      legible before the number is read. */}
                  <div className="mt-3 max-w-56">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-[var(--muted)]">{t("seatsLabel")}</span>
                      <span
                        className={
                          seatsLeft > 0
                            ? "font-mono text-[var(--foreground)]"
                            : "font-mono text-[var(--danger)]"
                        }
                      >
                        {seatsLeft > 0
                          ? t("seatsLeft", { left: seatsLeft, total: slot.capacity })
                          : t("slotFull")}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--neutral-bg)]">
                      <div
                        className={`h-full rounded-full transition-[width] ${
                          seatsLeft > 0 ? "bg-[var(--accent)]" : "bg-[var(--danger)]"
                        }`}
                        style={{
                          width: `${Math.min(100, Math.round((slot.bookedCount / Math.max(1, slot.capacity)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {!firebaseUser ? (
                  <Link href="/login" className="btn-ghost shrink-0">
                    {t("signInToBook")}
                  </Link>
                ) : isMine ? (
                  <button
                    type="button"
                    className="btn-ghost shrink-0"
                    disabled={busyId === slot.id}
                    onClick={() => void cancel(slot.id)}
                  >
                    {busyId === slot.id ? t("cancelling") : t("cancelBooking")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary shrink-0"
                    disabled={busyId === slot.id || seatsLeft <= 0}
                    onClick={() => void book(slot.id)}
                  >
                    {busyId === slot.id ? t("booking") : t("book")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
