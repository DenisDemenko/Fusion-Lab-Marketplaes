"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { MyClassBooking } from "@fusion-lab/shared-types";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

export default function AccountBookingsPage() {
  return (
    <RequireAuth>
      <BookingsScreen />
    </RequireAuth>
  );
}

function BookingsScreen() {
  const t = useTranslations("accountBookings");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [bookings, setBookings] = useState<MyClassBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setBookings(await api.get<MyClassBooking[]>("/me/bookings"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadFailed"));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cancel(scheduleId: string) {
    setBusyId(scheduleId);
    try {
      await api.delete(`/schedule/${scheduleId}/book`);
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

      {error ? (
        <p className="mt-4 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p>
      ) : null}

      {!bookings ? (
        <p className="mt-6 text-[var(--muted)]">{tCommon("loading")}</p>
      ) : bookings.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="text-[var(--muted)]">{t("empty")}</p>
          <Link href="/schedule" className="btn-primary mt-4 inline-flex">
            {t("browseSchedule")}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {bookings.map((booking) => (
            <li key={booking.id} className="card flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-mono text-xs text-[var(--muted)]">
                  {formatDateTime(booking.schedule.startsAt, locale)}
                </p>
                <p className="font-semibold text-[var(--foreground)]">{booking.schedule.title}</p>
              </div>
              <button
                type="button"
                className="btn-ghost shrink-0"
                disabled={busyId === booking.schedule.id}
                onClick={() => void cancel(booking.schedule.id)}
              >
                {busyId === booking.schedule.id ? t("cancelling") : t("cancel")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
