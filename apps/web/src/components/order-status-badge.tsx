import { useTranslations } from "next-intl";
import type { OrderStatus } from "@fusion-lab/shared-types";

const STYLES: Record<OrderStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
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
