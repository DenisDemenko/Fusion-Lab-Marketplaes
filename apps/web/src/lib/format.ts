// Prices arrive from the API already formatted (`priceLabel`) in Ukrainian
// — that string is server-computed once and shared by every locale, since
// re-deriving it per locale would mean two systems that can disagree on
// rounding. These helpers are only for the places that compute a fresh
// value client-side (a cart line, a payout estimate) and therefore do need
// to follow the page's own locale.
import type { Locale } from "@/i18n/routing";

function intlLocale(locale: Locale): string {
  return locale === "en" ? "en-US" : "uk-UA";
}

export function formatUah(minor: number, locale: Locale = "uk"): string {
  const major = (Math.round(minor) / 100).toFixed(2);
  return locale === "en" ? `${major} UAH` : `${major} грн`;
}

export function formatBytes(bytes: number, locale: Locale = "uk"): string {
  const units = locale === "en" ? ["B", "KB", "MB"] : ["Б", "КБ", "МБ"];
  if (bytes < 1024) return `${bytes} ${units[0]}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ${units[1]}`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${units[2]}`;
}

export function formatDate(
  value: string | null | undefined,
  locale: Locale = "uk",
): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(intlLocale(locale), {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(
  value: string | null | undefined,
  locale: Locale = "uk",
): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(intlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
