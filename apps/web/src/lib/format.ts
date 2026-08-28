// Prices arrive from the API already formatted (`priceLabel`), so this is
// only for the places that compute a total client-side — a cart line, a
// payout estimate.
export function formatUah(minor: number): string {
  return `${(Math.round(minor) / 100).toFixed(2)} грн`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const KIND_LABELS: Record<string, string> = {
  course: "Курс",
  product: "Виріб",
  book: "Книга",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Чернетка",
  pending_review: "На модерації",
  published: "Опубліковано",
  rejected: "Відхилено",
  archived: "В архіві",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Очікує оплати",
  paid: "Оплачено",
  failed: "Оплата не пройшла",
  cancelled: "Скасовано",
};
