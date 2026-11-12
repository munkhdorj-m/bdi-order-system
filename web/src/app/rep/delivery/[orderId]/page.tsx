import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { loadDeliveryOrder } from "@/lib/delivery-runs";
import { RepHeader } from "@/components/rep/rep-header";
import { DeliveryOrderView } from "@/components/rep/delivery-order";

type Params = Promise<{ orderId: string }>;

/** One order of the delivery person's run: hand over, adjust, mark delivered. */
export default async function DeliveryOrderPage({ params }: { params: Params }) {
  const { orderId } = await params;
  const session = await requireSession();
  const loaded = await loadDeliveryOrder(orderId, session.userId);
  if ("error" in loaded) notFound();
  const order = loaded.order;

  return (
    <div className="min-h-screen bg-background">
      <RepHeader
        title={order.store.name}
        subtitle={`${order.order_number} · Ачилт №${order.shipment.shipment_no}`}
        backHref="/rep/delivery"
      />
      <DeliveryOrderView order={order} />
    </div>
  );
}
