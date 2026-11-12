"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCheck,
  FileSpreadsheet,
  Loader2,
  Lock,
  LockOpen,
  PackageCheck,
  Plus,
  Printer,
  Trash2,
  Truck,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderStatusPill } from "@/components/admin/order-status-pill";
import {
  assignOrders,
  closeShipment,
  createShipment,
  deleteShipment,
  markDelivered,
  markShipmentDelivered,
  reopenShipment,
  returnToQueue,
  setShipmentDistributor,
  unassignOrders,
  undoDelivered,
} from "@/app/admin/dispatch/actions";
import { addDays, formatDateTimeUb, SHIPMENT_STATUS_LABELS, ubDayOf, type ShipmentStatus } from "@/lib/dispatch";
import { WEEKDAY_LABELS_MN, type Weekday } from "@/lib/delivery";
import { formatMnt } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payment-method";
import type { OrderStatus } from "@/lib/order-status";

export type BoardOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  created_at: string;
  delivery_date: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  amount: number;
  pieces: number;
  boxes: number;
  lines: number;
  store: {
    name: string;
    address: string | null;
    phone: string | null;
    registry: string | null;
    district: string | null;
    weekday: number | null;
  };
  placedBy: string | null;
  placedByBuyer: boolean;
};

export type BoardShipment = {
  id: string;
  shipment_no: number;
  status: ShipmentStatus;
  notes: string | null;
  created_at: string;
  closed_at: string | null;
  distributor: { id: string; name: string; phone: string | null } | null;
  orderCount: number;
  amount: number;
};

export type BoardProductLine = {
  product_id: string;
  name: string;
  code: string | null;
  qty: number;
  boxes: number;
  loose: number;
  amount: number;
};

export type BoardDistributor = { id: string; name: string; phone: string | null; active?: boolean };

type ActionResult = { error?: string; count?: number; id?: string };

type Confirm =
  | { kind: "close" | "reopen" | "delete" | "deliverAll" }
  | { kind: "assignAll"; ids: string[] }
  | { kind: "unassign"; ids: string[] }
  | { kind: "return"; ids: string[]; store: string }
  | null;

const NEW_DISTRIBUTOR = "__new__";
/** Unplanned orders older than this are folded away on the board. */
const OLD_AFTER_DAYS = 14;
/** Weekday filter value for stores without a delivery day. */
const NO_DAY = "none";
const ALL = "all";

/** A 40px tap target around a small checkbox. */
function CheckBox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="-m-2 flex size-10 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        className="size-4 accent-[var(--primary)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
    </label>
  );
}

function OrderLine({
  o,
  date,
  checked,
  onCheck,
  onRemove,
  onDelivered,
  onReturn,
  busy,
}: {
  o: BoardOrder;
  date: string;
  checked?: boolean;
  onCheck?: (v: boolean) => void;
  onRemove?: () => void;
  /** The run has left: this order reached the store. */
  onDelivered?: () => void;
  /** The run has left: this order came back undelivered. */
  onReturn?: () => void;
  busy: boolean;
}) {
  const planned = o.delivery_date;
  const plannedOther = planned && planned !== date;
  return (
    <li className={`flex gap-3 px-3 py-2.5 ${checked ? "bg-primary/5" : ""}`}>
      {onCheck && (
        <div className="pt-0.5">
          <CheckBox checked={!!checked} onChange={onCheck} label={`${o.store.name} сонгох`} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/admin/orders/${o.id}`} className="text-[13.5px] font-semibold hover:underline">
            {o.store.name}
          </Link>
          <OrderStatusPill status={o.status} />
          <span className="font-mono text-[11px] text-muted-foreground">{o.order_number}</span>
        </div>
        <div className="text-[11.5px] text-muted-foreground truncate">
          {[o.store.district, o.store.address, o.store.phone && `☎ ${o.store.phone}`, o.store.registry && `РД ${o.store.registry}`]
            .filter(Boolean)
            .join(" · ") || "—"}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px] text-muted-foreground tabular-nums">
          <span>
            {o.lines} бараа · {o.pieces}ш{o.boxes ? ` · ${o.boxes} хайрцаг` : ""}
          </span>
          {o.payment_method && <span>· {PAYMENT_METHOD_LABELS[o.payment_method]}</span>}
          <span>· {formatDateTimeUb(o.created_at)}</span>
          {planned && (
            <span className={plannedOther ? "text-amber-700 dark:text-amber-400" : ""}>
              · Хүргэх {planned}
            </span>
          )}
          {!planned && o.store.weekday && (
            <span>· Хуваарь: {WEEKDAY_LABELS_MN[o.store.weekday as Weekday]}</span>
          )}
          {o.placedBy && <span>· {o.placedByBuyer ? "Дэлгүүр" : o.placedBy}</span>}
        </div>
        {o.notes && (
          <div className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[11.5px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {o.notes}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="text-[13.5px] font-bold tabular-nums">{formatMnt(o.amount)}</div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 px-2.5 text-muted-foreground sm:h-8"
            onClick={onRemove}
            disabled={busy}
            title="Ачилтаас хасах"
          >
            <X className="h-3.5 w-3.5" />
            Хасах
          </Button>
        )}
        {onDelivered && (
          <Button type="button" size="sm" className="h-10 px-2.5 sm:h-8" onClick={onDelivered} disabled={busy}>
            <PackageCheck className="h-3.5 w-3.5" />
            Хүргэсэн
          </Button>
        )}
        {onReturn && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 px-2.5 text-muted-foreground sm:h-8"
            onClick={onReturn}
            disabled={busy}
            title="Хүргэж чадаагүй — дараагийн ачилтад оруулахаар буцаах"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Буцаах
          </Button>
        )}
      </div>
    </li>
  );
}

export function DispatchBoard({
  date,
  today,
  unassigned,
  shipments,
  selectedId,
  selectedOrders,
  productLines,
  distributors,
}: {
  date: string;
  today: string;
  unassigned: BoardOrder[];
  shipments: BoardShipment[];
  selectedId: string | null;
  selectedOrders: BoardOrder[];
  productLines: BoardProductLine[];
  distributors: BoardDistributor[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pickedOnRun, setPickedOnRun] = useState<Set<string>>(new Set());
  const [showLater, setShowLater] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [creating, setCreating] = useState(shipments.length === 0);
  const [newDist, setNewDist] = useState<string>(distributors[0]?.id ?? NEW_DISTRIBUTOR);
  const [newDistName, setNewDistName] = useState("");
  const [newDistPhone, setNewDistPhone] = useState("");
  const [dayFilter, setDayFilter] = useState<string>(ALL);
  const [districtFilter, setDistrictFilter] = useState<string>(ALL);

  // Switching to another run drops a pending confirmation and the run's
  // ticked orders, so "Тийм, хаах" can never land on a run you didn't pick.
  const [prevSelected, setPrevSelected] = useState(selectedId);
  if (prevSelected !== selectedId) {
    setPrevSelected(selectedId);
    setConfirm(null);
    setPickedOnRun(new Set());
  }

  const selected = shipments.find((s) => s.id === selectedId) ?? null;
  const open = selected?.status === "open";

  // Tucked away unless asked for: orders planned for a later day, and old
  // unplanned ones (likely delivered through Mercury before this screen existed).
  const oldCutoff = addDays(today, -OLD_AFTER_DAYS);
  const isLater = (o: BoardOrder) => !!o.delivery_date && o.delivery_date > date;
  const isOld = (o: BoardOrder) => !o.delivery_date && ubDayOf(o.created_at) < oldCutoff;
  const later = unassigned.filter(isLater);
  const old = unassigned.filter(isOld);

  // Route building: narrow the list to one delivery weekday and/or district.
  const districts = [...new Set(unassigned.map((o) => o.store.district).filter((d): d is string => !!d))].sort(
    (a, b) => a.localeCompare(b, "mn"),
  );
  const matchesRoute = (o: BoardOrder) =>
    (dayFilter === ALL ||
      (dayFilter === NO_DAY ? !o.store.weekday : String(o.store.weekday) === dayFilter)) &&
    (districtFilter === ALL || o.store.district === districtFilter);
  const visible = unassigned.filter(
    (o) => (showLater || !isLater(o)) && (showOld || !isOld(o)) && matchesRoute(o),
  );
  const pickedVisible = visible.filter((o) => picked.has(o.id));
  const pickedRunOrders = selectedOrders.filter((o) => pickedOnRun.has(o.id));
  const filtered = dayFilter !== ALL || districtFilter !== ALL;

  // Once the run has left: what is still on the road, and what has arrived.
  const outForDelivery = selectedOrders.filter((o) => o.status === "shipped");
  const deliveredCount = selectedOrders.filter((o) => o.status === "delivered").length;

  function href(next: { date?: string; shipment?: string | null }) {
    const q = new URLSearchParams({ date: next.date ?? date });
    const sh = next.shipment === undefined ? selectedId : next.shipment;
    if (sh) q.set("shipment", sh);
    return `/admin/dispatch?${q}`;
  }

  function run(fn: () => Promise<ActionResult>, onOk?: (r: ActionResult) => void) {
    start(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      if (!r.error || (r.count ?? 0) > 0) onOk?.(r);
      setConfirm(null);
      router.refresh();
    });
  }

  function assign(ids: string[]) {
    if (!selected) return toast.error("Эхлээд ачилт үүсгэнэ үү.");
    if (!open) return toast.error("Энэ ачилт хаагдсан. Шинэ ачилт үүсгэх эсвэл буцааж нээнэ үү.");
    if (ids.length === 0) return toast.error("Захиалга сонгоно уу.");
    run(
      () => assignOrders(selected.id, ids),
      (r) => {
        if (r.count) toast.success(`${r.count} захиалга №${selected.shipment_no} ачилтад орлоо`);
        setPicked(new Set());
      },
    );
  }

  function unassign(ids: string[]) {
    run(
      () => unassignOrders(ids),
      (r) => {
        if (r.count) toast.success(`${r.count} захиалга ачилтаас хасагдлаа`);
        setPickedOnRun(new Set());
      },
    );
  }

  function create() {
    if (newDist === NEW_DISTRIBUTOR && !newDistName.trim()) return toast.error("Түгээгчийн нэрийг бичнэ үү.");
    run(
      () =>
        createShipment({
          deliveryDate: date,
          distributorId: newDist === NEW_DISTRIBUTOR ? null : newDist,
          newDistributorName: newDist === NEW_DISTRIBUTOR ? newDistName : null,
          newDistributorPhone: newDist === NEW_DISTRIBUTOR ? newDistPhone : null,
        }),
      (r) => {
        setCreating(false);
        setNewDistName("");
        setNewDistPhone("");
        if (r.id) router.push(href({ shipment: r.id }));
      },
    );
  }

  function delivered(ids: string[]) {
    run(
      () => markDelivered(ids),
      (r) =>
        // One tap, no question asked — so a slip can be taken straight back.
        toast.success(r.count === 1 ? "Хүргэгдсэн гэж тэмдэглэлээ" : `${r.count} захиалга хүргэгдсэн боллоо`, {
          action: {
            label: "Буцаах",
            onClick: () => run(() => undoDelivered(ids), () => toast.success("Буцаалаа — хүргэлтэнд яваа хэвээр")),
          },
        }),
    );
  }

  function confirmNow() {
    if (!confirm || !selected) return;
    switch (confirm.kind) {
      case "deliverAll":
        return run(
          () => markShipmentDelivered(selected.id),
          (r) => toast.success(`${r.count} захиалга хүргэгдсэн боллоо`),
        );
      case "return":
        return run(
          () => returnToQueue(confirm.ids),
          () => toast.success("Захиалга «Хуваарлагдаагүй» жагсаалтад буцлаа"),
        );
      case "close":
        return run(
          () => closeShipment(selected.id),
          (r) => toast.success(`Ачилт хаагдлаа · ${r.count} захиалга хүргэлтэнд гарлаа`),
        );
      case "reopen":
        return run(() => reopenShipment(selected.id), () => toast.success("Ачилт буцааж нээгдлээ"));
      case "delete":
        return run(() => deleteShipment(selected.id), () => router.push(href({ shipment: null })));
      case "assignAll":
        return assign(confirm.ids);
      case "unassign":
        return unassign(confirm.ids);
    }
  }

  const confirmText: Record<string, { title: string; description: string; label: string; destructive?: boolean }> = {
    close: {
      title: `Ачилт №${selected?.shipment_no ?? ""}-г хаах уу?`,
      description: `${selectedOrders.length} захиалга "Хүргэлтэнд гарсан" болж, Е-баримт илгээх боломжтой болно. Дэлгүүрүүдэд мэдэгдэл очно.`,
      label: "Тийм, хаах",
    },
    reopen: {
      title: `Ачилт №${selected?.shipment_no ?? ""}-г буцааж нээх үү?`,
      description: "Захиалгууд дахин «Баталгаажсан» болж, ачилтад нэмж хасах боломжтой болно.",
      label: "Тийм, нээх",
    },
    delete: {
      title: `Хоосон ачилт №${selected?.shipment_no ?? ""}-г устгах уу?`,
      description: "Буцаах боломжгүй.",
      label: "Тийм, устгах",
      destructive: true,
    },
    assignAll: {
      title: `${confirm && "ids" in confirm ? confirm.ids.length : 0} захиалгыг №${selected?.shipment_no ?? ""} ачилтад оруулах уу?`,
      description: filtered
        ? "Шүүлтүүрт харагдаж буй бүх захиалга. Хүлээгдэж буй захиалгууд баталгаажна."
        : "Жагсаалтад харагдаж буй бүх захиалга. Хүлээгдэж буй захиалгууд баталгаажна.",
      label: "Тийм, оруулах",
    },
    unassign: {
      title: `${confirm && "ids" in confirm ? confirm.ids.length : 0} захиалгыг ачилтаас хасах уу?`,
      description: "Захиалгууд «Хуваарлагдаагүй» жагсаалт руу буцна.",
      label: "Тийм, хасах",
    },
    deliverAll: {
      title: `Ачилт №${selected?.shipment_no ?? ""}-ийн ${outForDelivery.length} захиалгыг хүргэгдсэн болгох уу?`,
      description:
        "Дэлгүүрүүдэд мэдэгдэл очно. Хүргэж чадаагүй захиалга байвал эхлээд түүнийг «Буцаах» дарна уу. Тоо зөрсөн бол захиалгаа нээж «Засах»-аар засна.",
      label: "Тийм, бүгд хүргэгдсэн",
    },
    return: {
      title: `«${confirm && "store" in confirm ? confirm.store : ""}» захиалгыг буцаах уу?`,
      description:
        "Хүргэж чадаагүй захиалга «Хуваарлагдаагүй» жагсаалтад буцаж, дараагийн ачилтад оруулах боломжтой болно.",
      label: "Тийм, буцаах",
    },
  };
  const dialog = confirm ? confirmText[confirm.kind] : null;

  const totalPieces = productLines.reduce((s, p) => s + p.qty, 0);
  const totalBoxes = productLines.reduce((s, p) => s + p.boxes, 0);
  const hasOrders = selectedOrders.length > 0;

  return (
    <div className="space-y-4">
      {/* Day picker + day-wide export */}
      <Card className="p-3 flex flex-row flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-muted-foreground">Хүргэх өдөр</span>
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && router.push(href({ date: e.target.value, shipment: null }))}
          className="h-9 w-40"
        />
        <Button asChild variant={date === today ? "default" : "outline"} size="sm">
          <Link href={href({ date: today, shipment: null })}>Өнөөдөр</Link>
        </Button>
        <Button asChild variant={date === addDays(today, 1) ? "default" : "outline"} size="sm">
          <Link href={href({ date: addDays(today, 1), shipment: null })}>Маргааш</Link>
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/admin/export?date=${date}`}>
              <FileSpreadsheet className="h-4 w-4" />
              Өдрийн бүх захиалга (Excel)
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/shipments">Ачилтын жагсаалт</Link>
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        {/* Unassigned orders */}
        <Card className="gap-0 p-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
            <CheckBox
              checked={visible.length > 0 && pickedVisible.length === visible.length}
              onChange={(v) => setPicked(v ? new Set(visible.map((o) => o.id)) : new Set())}
              label="Бүгдийг сонгох"
            />
            <div className="font-semibold text-[14px]">
              Хуваарлагдаагүй <span className="text-muted-foreground tabular-nums">({visible.length})</span>
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || pickedVisible.length === 0}
                onClick={() => assign(pickedVisible.map((o) => o.id))}
              >
                Сонгосныг ({pickedVisible.length}) <ArrowRight className="h-3.5 w-3.5" />
                {selected ? ` №${selected.shipment_no}` : ""}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || visible.length === 0}
                onClick={() => {
                  if (!selected) return toast.error("Эхлээд ачилт үүсгэнэ үү.");
                  if (!open) return toast.error("Энэ ачилт хаагдсан. Шинэ ачилт үүсгэх эсвэл буцааж нээнэ үү.");
                  setConfirm({ kind: "assignAll", ids: visible.map((o) => o.id) });
                }}
              >
                Бүгдийг хуваарлах
              </Button>
            </div>
          </div>

          {/* Route filter: one delivery weekday and/or district at a time. */}
          <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
            {[
              { key: ALL, label: "Бүх өдөр" },
              ...([1, 2, 3, 4, 5, 6, 7] as Weekday[])
                .filter((d) => unassigned.some((o) => o.store.weekday === d))
                .map((d) => ({ key: String(d), label: WEEKDAY_LABELS_MN[d] })),
              ...(unassigned.some((o) => !o.store.weekday) ? [{ key: NO_DAY, label: "Хуваарьгүй" }] : []),
            ].map((c) => (
              <button
                key={c.key}
                type="button"
                className="chip h-9 px-3"
                data-active={dayFilter === c.key || undefined}
                onClick={() => setDayFilter(c.key)}
              >
                {c.label}
              </button>
            ))}
            {districts.length > 0 && (
              <div className="ml-auto w-48">
                <Select value={districtFilter} onValueChange={setDistrictFilter}>
                  <SelectTrigger size="default" className="h-9 w-full rounded-xl text-[12.5px]" aria-label="Дүүрэг">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Бүх дүүрэг</SelectItem>
                    {districts.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {filtered ? "Энэ шүүлтүүрт захиалга алга." : "Хуваарлах захиалга алга."}
            </div>
          ) : (
            <ul className="divide-y">
              {visible.map((o) => (
                <OrderLine
                  key={o.id}
                  o={o}
                  date={date}
                  busy={busy}
                  checked={picked.has(o.id)}
                  onCheck={(v) =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(o.id);
                      else next.delete(o.id);
                      return next;
                    })
                  }
                />
              ))}
            </ul>
          )}
          {later.length > 0 && (
            <button
              type="button"
              onClick={() => setShowLater((v) => !v)}
              className="min-h-10 w-full border-t px-3 py-2 text-left text-[12px] text-muted-foreground hover:bg-muted/50"
            >
              {showLater ? "Дараагийн өдрүүдийнхийг нуух" : `+ ${later.length} захиалга дараагийн өдрүүдэд төлөвлөгдсөн — харуулах`}
            </button>
          )}
          {old.length > 0 && (
            <button
              type="button"
              onClick={() => setShowOld((v) => !v)}
              className="min-h-10 w-full border-t px-3 py-2 text-left text-[12px] text-muted-foreground hover:bg-muted/50"
            >
              {showOld
                ? "Хуучин захиалгуудыг нуух"
                : `+ ${old.length} хуучин захиалга (${OLD_AFTER_DAYS}-с олон хоногийн өмнөх, хүргэх өдөргүй) — харуулах`}
            </button>
          )}
        </Card>

        {/* The day's shipments */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {shipments.map((s) => (
              <Link
                key={s.id}
                href={href({ shipment: s.id })}
                className="chip h-10 font-medium"
                data-active={s.id === selectedId || undefined}
              >
                <span className="font-semibold">№{s.shipment_no}</span>
                {s.distributor ? ` · ${s.distributor.name}` : ""} · {s.orderCount}
                {s.status === "closed" && <Lock className="ml-1 inline h-3 w-3 align-[-1px]" />}
              </Link>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setCreating((v) => !v)}>
              <Plus className="h-3.5 w-3.5" />
              Шинэ ачилт
            </Button>
          </div>

          {creating && (
            <Card className="p-3 space-y-2">
              <div className="text-[13px] font-semibold">Шинэ ачилт · {date}</div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-52">
                  <div className="mb-1 text-[11px] text-muted-foreground">Түгээгч</div>
                  <Select value={newDist} onValueChange={setNewDist}>
                    <SelectTrigger size="default" className="h-9 w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {distributors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                          {d.phone ? ` ${d.phone}` : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value={NEW_DISTRIBUTOR}>+ Шинэ түгээгч…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newDist === NEW_DISTRIBUTOR && (
                  <>
                    <Input
                      value={newDistName}
                      onChange={(e) => setNewDistName(e.target.value)}
                      placeholder="Нэр"
                      className="h-9 w-36"
                    />
                    <Input
                      value={newDistPhone}
                      onChange={(e) => setNewDistPhone(e.target.value)}
                      placeholder="Утас"
                      inputMode="numeric"
                      className="h-9 w-32"
                    />
                  </>
                )}
                <Button type="button" size="sm" className="h-9" onClick={create} disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Үүсгэх
                </Button>
              </div>
            </Card>
          )}

          {!selected ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              <Truck className="mx-auto mb-2 h-6 w-6" />
              {date}-нд ачилт алга. &quot;Шинэ ачилт&quot; үүсгээд захиалгаа хуваарилна уу.
            </Card>
          ) : (
            <Card className="gap-0 p-0 overflow-hidden">
              <div className="space-y-2 border-b px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[16px] font-bold">Ачилт №{selected.shipment_no}</div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      open
                        ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
                        : "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                    }`}
                  >
                    {SHIPMENT_STATUS_LABELS[selected.status]}
                    {selected.closed_at ? ` · ${formatDateTimeUb(selected.closed_at)}` : ""}
                  </span>
                  <div className="ml-auto w-48">
                    <Select
                      value={selected.distributor?.id ?? ""}
                      onValueChange={(v) => run(() => setShipmentDistributor(selected.id, v || null))}
                      disabled={busy}
                    >
                      <SelectTrigger size="default" className="h-9 w-full rounded-xl text-[12.5px]">
                        <SelectValue placeholder="Түгээгч сонгох" />
                      </SelectTrigger>
                      <SelectContent>
                        {distributors.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                            {d.phone ? ` ${d.phone}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 text-[12.5px] text-muted-foreground tabular-nums">
                  <span>
                    <b className="text-foreground">{selectedOrders.length}</b> захиалга
                  </span>
                  <span>
                    <b className="text-foreground">{totalPieces}</b> ширхэг
                  </span>
                  <span>
                    <b className="text-foreground">{totalBoxes}</b> хайрцаг
                  </span>
                  <span>
                    <b className="text-foreground">{formatMnt(selected.amount)}</b>
                  </span>
                  {!open && hasOrders && (
                    <span>
                      <b className="text-foreground">
                        {deliveredCount}/{selectedOrders.length}
                      </b>{" "}
                      хүргэгдсэн
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {hasOrders ? (
                    <>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/print/invoices?shipment=${selected.id}`} target="_blank" rel="noreferrer">
                          <Printer className="h-4 w-4" />
                          Падаан
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/print/picklist?shipment=${selected.id}`} target="_blank" rel="noreferrer">
                          <Printer className="h-4 w-4" />
                          Нэгтгэл
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/admin/export?shipment=${selected.id}`}>
                          <FileSpreadsheet className="h-4 w-4" />
                          Excel
                        </a>
                      </Button>
                    </>
                  ) : (
                    <span className="self-center text-[12px] text-muted-foreground">Захиалгагүй ачилтын баримт хэвлэхгүй.</span>
                  )}
                  <div className="ml-auto flex gap-2">
                    {open ? (
                      <>
                        {pickedRunOrders.length > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setConfirm({ kind: "unassign", ids: pickedRunOrders.map((o) => o.id) })}
                          >
                            <X className="h-4 w-4" />
                            Сонгосныг хасах ({pickedRunOrders.length})
                          </Button>
                        )}
                        {!hasOrders && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirm({ kind: "delete" })}
                            title="Хоосон ачилтыг устгах"
                            aria-label="Хоосон ачилтыг устгах"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          disabled={busy || !hasOrders}
                          onClick={() => setConfirm({ kind: "close" })}
                        >
                          <Lock className="h-4 w-4" />
                          Ачилт хаах
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={() => setConfirm({ kind: "reopen" })}>
                          <LockOpen className="h-4 w-4" />
                          Буцааж нээх
                        </Button>
                        {outForDelivery.length > 0 && (
                          <Button type="button" size="sm" disabled={busy} onClick={() => setConfirm({ kind: "deliverAll" })}>
                            <CheckCheck className="h-4 w-4" />
                            Бүгд хүргэгдсэн
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {!hasOrders ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Ачилт хоосон. Зүүн талаас захиалга сонгож нэмнэ үү.
                </div>
              ) : (
                <ul className="divide-y">
                  {selectedOrders.map((o) => (
                    <OrderLine
                      key={o.id}
                      o={o}
                      date={date}
                      busy={busy}
                      checked={open ? pickedOnRun.has(o.id) : undefined}
                      onCheck={
                        open
                          ? (v) =>
                              setPickedOnRun((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(o.id);
                                else next.delete(o.id);
                                return next;
                              })
                          : undefined
                      }
                      onRemove={open ? () => unassign([o.id]) : undefined}
                      onDelivered={!open && o.status === "shipped" ? () => delivered([o.id]) : undefined}
                      onReturn={
                        !open && o.status === "shipped"
                          ? () => setConfirm({ kind: "return", ids: [o.id], store: o.store.name })
                          : undefined
                      }
                    />
                  ))}
                </ul>
              )}

              {productLines.length > 0 && (
                <details className="border-t">
                  <summary className="flex min-h-10 cursor-pointer items-center px-3 py-2.5 text-[13px] font-semibold">
                    Барааны нэгтгэл ({productLines.length} бараа)
                  </summary>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12.5px]">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-medium">Бараа</th>
                          <th className="px-2 py-1.5 text-right font-medium">Хайрцаг</th>
                          <th className="px-2 py-1.5 text-right font-medium">Задгай</th>
                          <th className="px-2 py-1.5 text-right font-medium">Нийт ш</th>
                          <th className="px-3 py-1.5 text-right font-medium">Дүн</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y tabular-nums">
                        {productLines.map((p) => (
                          <tr key={p.product_id}>
                            <td className="px-3 py-1.5">
                              {p.name}
                              {p.code && <span className="ml-1 text-muted-foreground">{p.code}</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right">{p.boxes || "—"}</td>
                            <td className="px-2 py-1.5 text-right">{p.loose || "—"}</td>
                            <td className="px-2 py-1.5 text-right font-semibold">{p.qty}</td>
                            <td className="px-3 py-1.5 text-right">{formatMnt(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={dialog !== null}
        onOpenChange={(o) => {
          if (!o && !busy) setConfirm(null);
        }}
        title={dialog?.title ?? ""}
        description={dialog?.description}
        confirmLabel={dialog?.label}
        destructive={dialog?.destructive}
        pending={busy}
        onConfirm={confirmNow}
      />
    </div>
  );
}
