import { Link } from "react-router-dom";

import type { OrderSummary } from "../types";
import { formatDate, formatOrderRef, formatPrice, statusPresentation } from "../utils/format";
import { Badge } from "./ui";

export function OrderCard({ order }: { order: OrderSummary }) {
  const status = statusPresentation(order.status);

  return (
    <li className="group relative rounded-[6px] border border-hairline bg-paper p-5 transition-colors hover:border-ink/30">
      <span aria-hidden className="crosshair" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="tabular display-wide text-[15px] font-bold text-ink">
            <Link to={`/orders/${order.id}`} className="after:absolute after:inset-0">
              {formatOrderRef(order.id)}
            </Link>
          </h3>
          <p className="mt-1 text-xs text-muted">{formatDate(order.created_at)}</p>
        </div>
        <Badge className={status.className}>{status.label}</Badge>
      </div>

      <dl className="mt-4 flex items-end justify-between border-t border-hairline pt-3">
        <div>
          <dt className="eyebrow label-narrow">Items</dt>
          <dd className="tabular mt-0.5 text-sm text-ink">{order.item_count}</dd>
        </div>
        <div className="text-right">
          <dt className="eyebrow label-narrow">Total</dt>
          <dd className="tabular display-wide mt-0.5 text-lg font-bold text-ink">
            {formatPrice(order.total_amount)}
          </dd>
        </div>
      </dl>
    </li>
  );
}
