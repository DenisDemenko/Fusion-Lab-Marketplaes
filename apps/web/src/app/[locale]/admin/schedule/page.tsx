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
          {slots.map((slot) => (
            <div key={slot.id} className="card flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-mono text-xs text-[var(--muted)]">
                  {formatDateTime(slot.startsAt, locale)}
                </p>
                <p className="font-semibold text-[var(--foreground)]">{slot.title}</p>
                <p className="text-sm text-[var(--muted)]">
                  {t("bookedOf", { booked: slot.bookedCount, capacity: slot.capacity })}
                  {slot.status === "cancelled" ? ` · ${t("cancelledLabel")}` : ""}
                </p>
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
          ))}
        </div>
      )}
    </div>
  );
}
