"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  ChevronRight,
  CreditCard,
  Gift,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCart,
  updateQty,
  removeFromCart,
  removeManyFromCart,
  restoreCartItem,
  totalAmount,
  totalQty,
  clearCart,
  formatMnt,
  type CartItem,
  type CartProductInfo,
  type CartScope,
} from "@/lib/cart";
import { placeOrder, type PlaceOrderResult } from "@/app/(buyer)/cart/actions";
import { useCartPriceSync } from "@/components/catalog/use-cart-price-sync";
import { useCheckoutId } from "@/lib/checkout-id";
import { useMounted } from "@/lib/use-mounted";
import { ProductPlaceholder, categoryVisual } from "@/lib/category-visual";
import { Button } from "@/components/ui/button";
import { MobileListSkeleton } from "@/components/page-skeletons";
import { bestProductRule, computeDiscount, CASH_DISCOUNT_PCT, type DiscountRule } from "@/lib/discount";
import type { PaymentMethod } from "@/lib/payment-method";

const CASH_PCT_LABEL = `${Math.round(CASH_DISCOUNT_PCT * 100)}%`;

/**
 * Client cart view — owns local UI state (cart, notes, submit). The
 * server page hands over the delivery label, the store's deals and
 * today's catalog (price, category, photo, stock per product): the cart is
 * re-synced with it on open, and sold-out lines are marked before sending.
 */
export function CartView({
  storeId,
  deliveryLabel,
  storeName,
  rules = [],
  productInfoById = {},
  catalog,
}: {
  /** The store's supermarket id — its cart is kept under it on the phone. */
  storeId: string;
  deliveryLabel: string | null;
  storeName: string | null;
  rules?: DiscountRule[];
  /** Today's catalog for this store (missing = could not be loaded). */
  catalog?: Record<string, CartProductInfo>;
  /** Bonus-product lookup: name + photo of each deal's free item. */
  productInfoById?: Record<string, { name: string; image_url: string | null }>;
}) {
  const scope = useMemo<CartScope>(() => ({ storeId, owner: "buyer" }), [storeId]);
  const mounted = useMounted();
  const liveCart = useCart(scope);
  useCartPriceSync(catalog, scope);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [snapshot, setSnapshot] = useState<CartItem[] | null>(null);
  // Lines the server refused because they're sold out right now.
  const [soldOutIds, setSoldOutIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const checkoutId = useCheckoutId(scope);
  const router = useRouter();

  const cart = pending || submitted ? (snapshot ?? liveCart) : liveCart;
  const total = totalAmount(cart);
  const qty = totalQty(cart);

  // Live discount breakdown — the same engine the server runs inside
  // placeOrder, so the cart number == the order number.
  const breakdown = computeDiscount(
    cart.map((c) => ({
      product_id: c.product_id,
      qty: c.qty,
      unit_price: c.unit_price,
      category_id: c.category_id ?? null,
    })),
    paymentMethod,
    rules,
  );

  // Gift thresholds are checked after ALL product deals (not just the
  // first), exactly like the engine does.
  const productDeals = breakdown.steps
    .filter((s) => s.kind === "product")
    .reduce((sum, s) => sum + s.amount, 0);
  const subtotalAfterProduct = breakdown.gross - productDeals;
  const nextThreshold = rules
    .filter(
      (r) =>
        r.kind === "threshold_bonus" &&
        Number(r.step_amount) > 0 &&
        Number(r.step_amount) > subtotalAfterProduct,
    )
    .sort((a, b) => Number(a.step_amount) - Number(b.step_amount))[0];

  // Sold out: per today's catalog (stock ≤ 0) or per the server's answer.
  const isSoldOut = (id: string) => {
    const stock = catalog?.[id]?.stock;
    return soldOutIds.includes(id) || (stock !== undefined && stock <= 0);
  };
  const blockedIds = cart.filter((i) => isSoldOut(i.product_id)).map((i) => i.product_id);

  function removeLine(item: CartItem, index: number) {
    removeFromCart(item.product_id, scope);
    toast(`«${item.name}» сагснаас хасагдлаа`, {
      action: { label: "Буцаах", onClick: () => restoreCartItem(item, index, scope) },
    });
  }

  function removeBlocked() {
    removeManyFromCart(blockedIds, scope);
    setSoldOutIds([]);
    setError(null);
    toast.success(`${blockedIds.length} дууссан бараа хасагдлаа`);
  }

  function handleSubmit() {
    if (blockedIds.length > 0) return;
    setError(null);
    setSnapshot([...liveCart]);
    const items = liveCart.map((i) => ({ product_id: i.product_id, qty: i.qty }));
    const note = notes.trim() || null;
    // Same cart re-sent → same id → the server won't make a second order.
    const requestId = checkoutId(JSON.stringify([items, note, paymentMethod]));
    startTransition(async () => {
      let result: PlaceOrderResult;
      try {
        result = await placeOrder({ items, notes: note, payment_method: paymentMethod, requestId });
      } catch {
        // Dropped connection. Re-sending is safe: it can't make a second order.
        result = { error: "Холболт тасарлаа. Дахин илгээнэ үү — захиалга давхардахгүй." };
      }
      if (result.error) {
        if (result.problems?.length) {
          // No longer sold: dropped. Sold out: marked, the store decides.
          const gone = result.problems.filter((p) => p.reason === "unavailable").map((p) => p.product_id);
          if (gone.length > 0) removeManyFromCart(gone, scope);
          setSoldOutIds(result.problems.filter((p) => p.reason === "sold_out").map((p) => p.product_id));
        }
        // Visible even though the bottom bar covers the page's error box.
        setError(result.error);
        toast.error(result.error);
        setSnapshot(null);
        return;
      }
      setSubmitted(true);
      clearCart(scope);
      // replace: Back from the new order shouldn't land on an empty cart.
      if (result.orderId) router.replace(`/orders/${result.orderId}?new=1`);
    });
  }

  // The cart lives on the phone: until it has been read, show the page's
  // shape instead of a false "Сагс хоосон байна".
  if (!mounted) return <MobileListSkeleton rows={3} />;

  if (liveCart.length === 0 && !submitted && !pending) {
    return (
      <div className="px-4 py-20 text-center max-w-md mx-auto">
        <div className="size-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-5">
          <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <h1 className="text-xl font-bold mb-1">Сагс хоосон байна</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Каталогоос бараа сонгож сагсандаа нэмнэ үү.
        </p>
        <Button asChild size="lg">
          <Link href="/catalog">Каталог руу</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 py-4 max-w-2xl mx-auto pb-48 lg:pb-40">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[20px] font-bold tracking-tight">Миний сагс</h1>
        <span className="text-[13px] text-muted-foreground tabular-nums">
          {qty} ширхэг бараа
        </span>
      </div>

      {/* Delivery card — the next run for this store. No weekday
          (Налайх/Багануур/Багахангай deliver on demand) → a neutral note. */}
      <div className="mt-3 rounded-2xl ring-1 ring-border bg-accent/40 p-3 flex items-center gap-3">
        <div className="size-10 rounded-xl bg-card ring-1 ring-border flex items-center justify-center text-primary shrink-0">
          <Truck className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-muted-foreground">Хүргэлт</div>
          <div className="text-[13.5px] font-semibold">
            {deliveryLabel
              ? `Дараагийн хүргэлт · ${deliveryLabel}`
              : "Тохиролцоогоор · бэлэн болоход мэдэгдэх болно"}
          </div>
          {storeName && (
            <div className="text-[12px] text-muted-foreground truncate">{storeName}</div>
          )}
        </div>
      </div>

      {blockedIds.length > 0 && (
        <div className="mt-3 rounded-2xl bg-rose-50 ring-1 ring-rose-200 p-3 flex items-center gap-3 dark:bg-rose-950/40 dark:ring-rose-900/60">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <p className="flex-1 min-w-0 text-[13px] font-medium text-rose-900 dark:text-rose-100">
            {blockedIds.length} бараа дууссан байна. Хасаад захиалгаа илгээнэ үү.
          </p>
          <Button type="button" size="sm" variant="destructive" className="h-10 shrink-0" onClick={removeBlocked}>
            Хасах
          </Button>
        </div>
      )}

      {/* Cart line cards */}
      <div className="mt-3 flex flex-col gap-2">
        {cart.map((item, index) => {
          // The line's one best deal — the same choice the engine makes
          // (deals don't add up), so badge × qty matches the breakdown.
          const best = bestProductRule(item.product_id, item.category_id ?? null, rules);
          const lineNet = best ? Math.round(item.unit_price * (1 - best.pct / 100)) : item.unit_price;
          const lineTotal = best
            ? Math.round(item.unit_price * item.qty * (1 - best.pct / 100))
            : item.unit_price * item.qty;
          const soldOut = isSoldOut(item.product_id);
          return (
            <div
              key={item.product_id}
              className={`flex gap-3 p-3 rounded-2xl bg-card ring-1 ${soldOut ? "ring-rose-300 dark:ring-rose-800" : "ring-border"}`}
            >
              <div className="size-20 rounded-2xl overflow-hidden relative shrink-0 ring-1 ring-border/40 bg-gradient-to-b from-muted/50 to-muted">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    sizes="80px"
                    quality={85}
                    className={`object-cover ${soldOut ? "grayscale opacity-60" : ""}`}
                  />
                ) : (
                  <ProductPlaceholder visual={categoryVisual({ name: "", icon: item.category_icon })} dim={soldOut} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {item.brand && (
                  <div className="text-[11px] uppercase tracking-[0.08em] font-bold text-primary">
                    {item.brand}
                  </div>
                )}
                <Link
                  href={`/catalog/${item.product_id}`}
                  className="text-[13.5px] font-semibold leading-snug line-clamp-2 hover:underline"
                >
                  {item.name}
                </Link>
                {soldOut && (
                  <div className="mt-1 inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[12px] font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                    Дууссан
                  </div>
                )}
                <div className="mt-1.5 text-[12.5px] tabular-nums flex items-baseline gap-1.5 flex-wrap">
                  {best ? (
                    <>
                      <span className="text-muted-foreground line-through">
                        {formatMnt(item.unit_price)}
                      </span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatMnt(lineNet)}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-600 text-white">
                        −{best.pct}%
                      </span>
                      <span className="text-muted-foreground">× {item.qty} =</span>
                      <span className="font-bold text-foreground">{formatMnt(lineTotal)}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {formatMnt(item.unit_price)} × {item.qty} ={" "}
                      <span className="font-bold text-foreground">{formatMnt(lineTotal)}</span>
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <CartLineQtyStepper productId={item.product_id} name={item.name} qty={item.qty} scope={scope} />
                  <button
                    type="button"
                    onClick={() => removeLine(item, index)}
                    aria-label={`${item.name} — сагснаас хасах`}
                    className="ml-auto size-10 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Bonus lines — free items earned via threshold rules, in the
            shopping colour so they read as "you didn't pay for these". */}
        {breakdown.bonuses.map((b) => {
          const info = productInfoById[b.product_id];
          const displayName = info?.name ?? "Бэлэг бараа";
          const imageUrl = info?.image_url ?? null;
          return (
            <div
              key={b.source_discount_id}
              className="flex items-center gap-3 p-3 rounded-2xl bg-gold/10 ring-1 ring-gold/50"
            >
              <div className="relative size-16 rounded-2xl overflow-hidden shrink-0 ring-1 ring-gold/50 bg-gold/20">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={displayName}
                    fill
                    sizes="64px"
                    quality={85}
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gold-foreground dark:text-gold">
                    <Gift className="h-7 w-7" strokeWidth={2} />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-card">
                  <Gift className="h-2.5 w-2.5" strokeWidth={2.6} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-gold-foreground dark:text-gold">Бэлэг</div>
                <div className="text-[13px] font-semibold truncate">
                  {displayName} · {b.qty} ширхэг
                </div>
                <div className="text-[12px] text-muted-foreground truncate">{b.label}</div>
              </div>
              <span className="text-[12px] font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                ҮНЭГҮЙ
              </span>
            </div>
          );
        })}
      </div>

      {/* Upsell — the closest gift threshold not reached yet: how much
          more to spend, shown BEFORE checkout. */}
      {nextThreshold && (() => {
        const step = Number(nextThreshold.step_amount);
        const nextInfo = productInfoById[nextThreshold.product_id ?? ""];
        const nextName = nextInfo?.name ?? "бараа";
        const nextImg = nextInfo?.image_url ?? null;
        return (
          <div className="mt-3 rounded-2xl bg-gold/10 ring-1 ring-gold/50 p-3 flex items-center gap-3">
            <div className="relative size-14 rounded-2xl overflow-hidden shrink-0 ring-1 ring-gold/50 bg-gold/20">
              {nextImg ? (
                <Image src={nextImg} alt={nextName} fill sizes="56px" quality={85} className="object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gold-foreground dark:text-gold">
                  <Gift className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold leading-tight">
                Дахиад{" "}
                <span className="tabular-nums font-bold text-gold-foreground dark:text-gold">
                  {formatMnt(step - subtotalAfterProduct)}
                </span>{" "}
                нэмбэл бэлэг!
              </div>
              <div className="text-[12px] text-muted-foreground mt-0.5 truncate">
                {nextThreshold.name} · {nextName} · {nextThreshold.bonus_n ?? 1} ширхэг
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-gold/20 overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, Math.round((subtotalAfterProduct / (step || 1)) * 100))}%` }}
                  className="h-full bg-gold rounded-full"
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payment method — cash takes the cash discount off the total. */}
      <div className="mt-5">
        <div className="text-[12px] font-bold text-muted-foreground mb-2">Төлбөрийн арга</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPaymentMethod("credit")}
            aria-pressed={paymentMethod === "credit"}
            className={`rounded-2xl ring-1 p-3 text-left transition-all ${
              paymentMethod === "credit"
                ? "ring-2 ring-primary bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))] shadow-sm"
                : "ring-border bg-card hover:bg-muted/40"
            }`}
          >
            <CreditCard
              className={`h-4 w-4 mb-1.5 ${paymentMethod === "credit" ? "text-primary" : "text-muted-foreground"}`}
            />
            <div className="text-[14px] font-bold">Зээл</div>
            <div className="text-[12px] text-muted-foreground leading-tight mt-0.5">
              Дараа төлбөртэйгээр
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("cash")}
            aria-pressed={paymentMethod === "cash"}
            className={`relative rounded-2xl ring-1 p-3 text-left transition-all ${
              paymentMethod === "cash"
                ? "ring-2 ring-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-sm"
                : "ring-border bg-card hover:bg-muted/40"
            }`}
          >
            <span className="absolute top-2 right-2 text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-600 text-white">
              −{CASH_PCT_LABEL}
            </span>
            <Banknote
              className={`h-4 w-4 mb-1.5 ${paymentMethod === "cash" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
            />
            <div className="text-[14px] font-bold">Бэлэн</div>
            <div className="text-[12px] text-muted-foreground leading-tight mt-0.5">
              Хүргэлтийн үед төлнө
            </div>
          </button>
        </div>
      </div>

      {/* Notes block */}
      <div className="mt-5">
        <label htmlFor="notes" className="block text-[12px] font-bold text-muted-foreground mb-2">
          Тэмдэглэл (заавал биш)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Жш: Маргааш 10 цаг хүртэл хүргэх боломжтой бол хүргэнэ үү"
          className="w-full rounded-2xl bg-muted/60 ring-1 ring-border px-4 py-3 text-[14px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-card transition-all"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Sticky submit bar — the savings itemised above the total, so the
          store sees them before it sends. */}
      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] lg:bottom-14 left-0 right-0 glass-strong border-t border-border/30 px-3 pt-3 pb-3 z-10 shadow-lg shadow-black/5">
        <div className="max-w-2xl mx-auto">
          {breakdown.steps.length > 0 ? (
            <div className="mb-2 rounded-2xl bg-gradient-to-r from-emerald-50 to-card ring-1 ring-emerald-200 px-3 py-2.5 space-y-1 dark:from-emerald-950/30 dark:to-card dark:ring-emerald-800/60">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Хямдрал
                </div>
                <div className="text-[12px] text-muted-foreground">
                  Та{" "}
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {formatMnt(breakdown.totalDiscount)}
                  </span>{" "}
                  хэмнэлээ
                </div>
              </div>
              {breakdown.steps.map((s, i) => (
                <div
                  key={`${s.kind}-${i}`}
                  className="flex items-baseline justify-between text-[12.5px] text-emerald-700 dark:text-emerald-400"
                >
                  <span className="truncate pr-2">{s.label}</span>
                  <span className="tabular-nums shrink-0 font-semibold">−{formatMnt(s.amount)}</span>
                </div>
              ))}
              <div className="flex items-baseline justify-between pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/40">
                <div className="flex flex-col">
                  <span className="text-[12px] font-bold text-muted-foreground">Нийт төлөх</span>
                  <span className="text-[12px] tabular-nums line-through text-muted-foreground/70">
                    {formatMnt(total)}
                  </span>
                </div>
                <span className="font-display text-[22px] font-semibold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-300">
                  {formatMnt(breakdown.net)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline justify-between mb-2 px-1">
              <span className="text-[12px] font-bold text-muted-foreground">Нийт</span>
              <span className="font-display text-[20px] font-semibold tabular-nums tracking-tight">
                {formatMnt(total)}
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="gold"
            size="lg"
            onClick={handleSubmit}
            disabled={pending || cart.length === 0 || blockedIds.length > 0}
            aria-busy={pending}
            className="w-full rounded-2xl"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Илгээж байна...
              </>
            ) : blockedIds.length > 0 ? (
              "Дууссан барааг хасаад илгээнэ үү"
            ) : (
              <>
                Захиалга илгээх
                <ChevronRight className="h-4 w-4 opacity-80" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Per-row quantity stepper: −/+ (40px) with the number typeable between
 * them. Each row keeps its own typing draft (the cart's qty stays the
 * source of truth); Enter/blur commits, Escape reverts, 0 removes the row.
 */
function CartLineQtyStepper({
  productId,
  name,
  qty,
  scope,
}: {
  productId: string;
  name: string;
  qty: number;
  scope: CartScope;
}) {
  const [draft, setDraft] = useState<string>(String(qty));
  // Sync external qty changes (the +/- buttons, other tabs) into the
  // draft with a render-time adjustment instead of an effect.
  const [prevQty, setPrevQty] = useState(qty);
  if (prevQty !== qty) {
    setPrevQty(qty);
    setDraft(String(qty));
  }

  function commit() {
    const trimmed = draft.trim();
    const n = Number(trimmed);
    if (trimmed === "" || !Number.isFinite(n) || n < 0) {
      setDraft(String(qty));
      return;
    }
    const floored = Math.floor(n);
    if (floored === qty) {
      setDraft(String(qty));
      return;
    }
    updateQty(productId, floored, scope);
  }

  return (
    <div className="inline-flex items-center rounded-xl bg-muted ring-1 ring-border">
      <button
        type="button"
        onClick={() => updateQty(productId, qty - 1, scope)}
        disabled={qty <= 1}
        aria-label={`${name} — нэгээр хасах`}
        className="size-10 flex items-center justify-center rounded-l-xl hover:bg-card disabled:opacity-40 active:scale-90 transition-transform"
      >
        <Minus className="h-4 w-4" strokeWidth={2.4} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setDraft(String(qty));
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label={`${name} — тоо ширхэг`}
        // Fixed width — without one the input takes HTML's default
        // size=20 (~150px) and blows the pill out across the row.
        size={1}
        maxLength={5}
        className="w-14 h-10 px-1 text-[15px] font-bold tabular-nums text-center bg-transparent border-0 outline-none focus:bg-background/60 transition-colors"
      />
      <button
        type="button"
        onClick={() => updateQty(productId, qty + 1, scope)}
        aria-label={`${name} — нэгээр нэмэх`}
        className="size-10 flex items-center justify-center rounded-r-xl hover:bg-card active:scale-90 transition-transform"
      >
        <Plus className="h-4 w-4" strokeWidth={2.4} />
      </button>
    </div>
  );
}
