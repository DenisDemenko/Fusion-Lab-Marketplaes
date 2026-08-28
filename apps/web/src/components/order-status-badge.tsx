import type { OrderStatus } from "@fusion-lab/shared-types";
import { ORDER_STATUS_LABELS } from "@/lib/format";

const STYLES: Record<OrderStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  cancelled: "bg-zinc-100 text-zinc-600",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`badge ${STYLES[status] ?? "bg-zinc-100 text-zinc-600"}`}>
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
