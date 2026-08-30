import { useTranslations } from "next-intl";
import type { OrderStatus } from "@fusion-lab/shared-types";

const STYLES: Record<OrderStatus, string> = {
  paid: "bg-[var(--success-soft)] text-[var(--success)]",
  pending: "bg-[var(--warning-soft)] text-[var(--warning)]",
  failed: "bg-[var(--danger-soft)] text-[var(--danger)]",
  cancelled: "bg-[var(--neutral-bg)] text-[var(--muted)]",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("enums.orderStatus");

  return (
    <span className={`badge ${STYLES[status] ?? "bg-[var(--neutral-bg)] text-[var(--muted)]"}`}>
      {t(status)}
    </span>
  );
}
