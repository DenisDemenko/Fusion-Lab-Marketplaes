"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { AdminClassSchedule } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

export default function AdminSchedulePage() {
  return (
    <RequireAuth role="admin">
      <AdminScheduleScreen />
    </RequireAuth>
  );
}

function AdminScheduleScreen() {
  const t = useTranslations("adminSchedule");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;

  const [slots, setSlots] = useState<AdminClassSchedule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [direction, setDirection] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState("12");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      setSlots(await api.get<AdminClassSchedule[]>("/admin/schedule"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadFailed"));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api.post("/admin/schedule", {
        title: title.trim(),
        direction: direction.trim() || undefined,
        description: description.trim() || undefined,
        startsAt: new Date(startsAt).toISOString(),
        capacity: Number(capacity),
      });
      setTitle("");
      setDirection("");
      setDescription("");
      setStartsAt("");
      setCapacity("12");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("createFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function cancelSlot(id: string) {
    setBusyId(id);
    try {
      await api.post(`/admin/schedule/${id}/cancel`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : tCommon("actionFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title={t("title")} />

      <form onSubmit={create} className="card space-y-4 p-6">
        <p className="label">{t("newSlot")}</p>
        <div>
          <label className="label" htmlFor="slot-title">{t("slotTitle")}</label>
          <input
            id="slot-title"
            className="input"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="slot-starts">{t("startsAt")}</label>
            <input
              id="slot-starts"
              type="datetime-local"
              className="input"
              required
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="slot-capacity">{t("capacity")}</label>
            <input
              id="slot-capacity"
              type="number"
              min={1}
              className="input"
              required
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="slot-direction">{t("direction")}</label>
          <input
            id="slot-direction"
            className="input"
            placeholder={t("directionPlaceholder")}
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="slot-description">{t("description")}</label>
          <textarea
            id="slot-description"
            className="input min-h-20"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button type="submit" className="btn-primary" disabled={creating}>
          {creating ? t("creating") : t("create")}
        </button>
      </form>

      {!slots ? (
        <p className="mt-6 text-[var(--muted)]">{tCommon("loading")}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {slots.map((slot) => {
            const isCancelled = slot.status === "cancelled";
            const isFull = slot.bookedCount >= slot.capacity;
            const filled = Math.min(
              100,
              Math.round((slot.bookedCount / Math.max(1, slot.capacity)) * 100),
            );

            return (
              <div
                key={slot.id}
                /* A cancelled session used to differ from a live one only by
                   the word "cancelled" tacked onto the end of a grey line.
                   It keeps its place in the list but stops competing with
                   the sessions that still need running. */
                className={`card flex flex-wrap items-center justify-between gap-4 p-5 ${
                  isCancelled ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* The date is what identifies a row on a schedule, and
                        it was the faintest thing in it. Same weight as the
                        public schedule gives it. */}
                    <p className="font-mono text-sm font-medium text-[var(--foreground)]">
                      {formatDateTime(slot.startsAt, locale)}
                    </p>
                    {isCancelled ? (
                      <span className="badge bg-[var(--neutral-bg)] text-[var(--muted)]">
                        {t("cancelledLabel")}
                      </span>
                    ) : isFull ? (
                      <span className="badge bg-[var(--success-soft)] text-[var(--success)]">
                        {t("full")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-display font-semibold text-[var(--foreground)]">
                    {slot.title}
                  </p>

                  {/* Booked-of-capacity was a grey caption, though filling
                      the room is the reason this page exists. A bar shows
                      an empty session and a sold-out one at a glance; here
                      full is good news, so it reads success, not danger. */}
                  <div className="mt-3 max-w-56">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-[var(--muted)]">{t("occupancy")}</span>
                      <span
                        className={`font-mono ${
                          isFull && !isCancelled
                            ? "text-[var(--success)]"
                            : "text-[var(--foreground)]"
                        }`}
                      >
                        {slot.bookedCount} / {slot.capacity}
                      </span>
                    </div>
                    <div
                      role="img"
                      aria-label={t("bookedOf", {
                        booked: slot.bookedCount,
                        capacity: slot.capacity,
                      })}
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--neutral-bg)]"
                    >
                      <div
                        className={`h-full rounded-full ${
                          isCancelled
                            ? "bg-[var(--muted)]"
                            : isFull
                              ? "bg-[var(--success)]"
                              : "bg-[var(--accent)]"
                        }`}
                        style={{ width: `${filled}%` }}
                      />
                    </div>
                  </div>
                </div>

                {slot.status === "scheduled" ? (
                  <button
                    type="button"
                    className="btn-danger shrink-0"
                    disabled={busyId === slot.id}
                    onClick={() => void cancelSlot(slot.id)}
                  >
                    {busyId === slot.id ? tCommon("loading") : t("cancelSlot")}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
