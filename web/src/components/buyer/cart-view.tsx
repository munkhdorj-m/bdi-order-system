"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  ChevronRight,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import {
  useCart,
  updateQty,
  removeFromCart,
  totalAmount,
  totalQty,
  clearCart,
  formatMnt,
  type CartItem,
} from "@/lib/cart";
import { placeOrder } from "@/app/(buyer)/cart/actions";
import { Button } from "@/components/ui/button";
import { computeDiscount, type DiscountRule } from "@/lib/discount";
import type { PaymentMethod } from "@/lib/payment-method";
import { Gift, Sparkles } from "lucide-react";

/**
 * Client cart view — owns local UI state (cart, notes, submit).
 * Receives delivery info as a prop so the server can resolve the
 * district → weekday default + per-store override without having to
 * marshal it through cart-state.
 */
export function CartView({
  deliveryLabel,
  storeName,
  rules = [],
  productInfoById = {},
}: {
  deliveryLabel: string | null;
  storeName: string | null;
  rules?: DiscountRule[];
  /** Bonus-product lookup. Server pre-fetches name + image_url for any
   *  product referenced by a threshold_bonus rule so the cart's free-item
   *  rows can render the actual product thumbnail. */
  productInfoById?: Record<string, { name: string; image_url: string | null }>;
}) {
  const liveCart = useCart();
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [snapshot, setSnapshot] = useState<CartItem[] | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const cart = pending || submitted ? (snapshot ?? liveCart) : liveCart;
  const total = totalAmount(cart);
  const qty = totalQty(cart);

  // Live discount breakdown — recomputes as the user toggles payment
  // method or edits qty. Mirrors the server-side calculation that runs
  // inside placeOrder so the cart number == the order number.
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

  // Threshold-bonus "next reward" hint — find the nearest threshold the
  // buyer hasn't crossed yet, so we can surface "180,000₮ авбал бэлэг
  // авна!" upsell card right before the totals.
  const subtotalAfterProduct = total - (breakdown.steps.find(
    (s) => s.kind === "product",
  )?.amount ?? 0);
  const nextThreshold = rules
    .filter(
      (r) =>
        r.kind === "threshold_bonus" &&
        r.step_amount != null &&
        r.step_amount > subtotalAfterProduct,
    )
    .sort((a, b) => (a.step_amount ?? 0) - (b.step_amount ?? 0))[0];

  function handleSubmit() {
    setError(null);
    setSnapshot([...liveCart]);
    startTransition(async () => {
      const result = await placeOrder({
        items: liveCart.map((i) => ({ product_id: i.product_id, qty: i.qty })),
        notes: notes.trim() || null,
        payment_method: paymentMethod,
      });
      if (result.error) {
        setError(result.error);
        setSnapshot(null);
        return;
      }
      setSubmitted(true);
      if (result.orderId) router.push(`/orders/${result.orderId}?new=1`);
      clearCart();
    });
  }

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
        <Button
          asChild
          className="rounded-xl gradient-primary shadow-md shadow-primary/20"
        >
          <Link href="/catalog">Каталог руу</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 py-4 max-w-2xl mx-auto pb-44 lg:pb-36">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[20px] font-bold tracking-tight">Миний сагс</h1>
        <span className="text-[12.5px] text-muted-foreground tabular-nums">
          {qty} ширхэг бараа
        </span>
      </div>

      {/* Delivery card — shows the resolved weekday for the buyer's store.
          When delivery_day is null (Налайх/Багануур/Багахангай → on-demand)
          we fall back to a neutral "товлоомжтой" note. */}
      <div className="mt-3 rounded-2xl ring-1 ring-border bg-accent/40 p-3 flex items-center gap-3">
        <div className="size-9 rounded-xl bg-card ring-1 ring-border flex items-center justify-center text-primary">
          <Truck className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
            Хүргэлт
          </div>
          <div className="text-[12.5px] font-semibold">
            {deliveryLabel
              ? `Дараагийн хүргэлт · ${deliveryLabel}`
              : "Тохиролцоогоор · бэлэн болоход мэдэгдэх болно"}
          </div>
          {storeName && (
            <div className="text-[10.5px] text-muted-foreground truncate">
              {storeName}
            </div>
          )}
        </div>
      </div>

      {/* Cart line cards */}
      <div className="mt-3 flex flex-col gap-2">
        {cart.map((item) => {
          // Aggregate EVERY per-product rule that matches this line so
          // the badge + strikethrough reflect the same total discount
          // the engine applies in the breakdown below. Previously we
          // showed only the first matching rule, which made
          // `lineNet × qty ≠ cart total` whenever two rules stacked
          // (e.g. a category 6% + a per-product 3% leaving the line
          // claiming -6% while the breakdown subtracted both).
          const matchedRules = rules.filter((r) => {
            if (r.kind !== "product") return false;
            const pct = Number(r.pct);
            if (!Number.isFinite(pct) || pct <= 0) return false;
            const pMatch = !r.product_id || r.product_id === item.product_id;
            const cMatch =
              !r.category_id || r.category_id === (item.category_id ?? null);
            return pMatch && cMatch;
          });
          const totalPct = matchedRules.reduce(
            (sum, r) => sum + (Number(r.pct) || 0),
            0,
          );
          const hasSale = totalPct > 0;
          const lineNet = hasSale
            ? Math.round(item.unit_price * (1 - totalPct / 100))
            : item.unit_price;
          return (
          <div
            key={item.product_id}
            className="flex gap-3 p-3 rounded-2xl bg-card ring-1 ring-border"
          >
            <div className="size-20 rounded-2xl overflow-hidden relative shrink-0 ring-1 ring-border/40 bg-gradient-to-b from-muted/50 to-muted">
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={item.name}
                  fill
                  sizes="80px"
                  quality={85}
                  unoptimized
                  className="object-cover"
                />
              ) : null}
            </div>
            <div className="flex-1 min-w-0">
              {item.brand && (
                <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-primary">
                  {item.brand}
                </div>
              )}
              <Link
                href={`/catalog/${item.product_id}`}
                className="text-[13px] font-semibold leading-snug line-clamp-2 hover:underline"
              >
                {item.name}
              </Link>
              <div className="mt-1.5 text-[11.5px] tabular-nums flex items-baseline gap-1.5 flex-wrap">
                {hasSale ? (
                  <>
                    <span className="text-muted-foreground line-through">
                      {formatMnt(item.unit_price)}
                    </span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatMnt(lineNet)}
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white">
                      −{Math.round(totalPct * 10) / 10}%
                    </span>
                    <span className="text-muted-foreground">
                      × {item.qty} ={" "}
                    </span>
                    <span className="font-bold text-foreground">
                      {formatMnt(lineNet * item.qty)}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    {formatMnt(item.unit_price)} × {item.qty} ={" "}
                    <span className="font-bold text-foreground">
                      {formatMnt(item.unit_price * item.qty)}
                    </span>
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <CartLineQtyStepper
                  productId={item.product_id}
                  qty={item.qty}
                />
                <button
                  type="button"
                  onClick={() => removeFromCart(item.product_id)}
                  aria-label="Барааг хасах"
                  className="ml-auto size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          );
        })}

        {/* Bonus lines — free items earned via threshold rules. Styled
            distinct from regular cart rows so they're recognizable as
            "you didn't pay for these". When the bonus product has an
            image we show it as the thumbnail; otherwise fall back to
            the Gift icon block so the row still reads as a freebie. */}
        {breakdown.bonuses.map((b) => {
          const info = productInfoById[b.product_id];
          const displayName = info?.name ?? "Бэлэг бараа";
          const imageUrl = info?.image_url ?? null;
          return (
            <div
              key={b.source_discount_id}
              className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50 ring-1 ring-amber-300/60 dark:bg-amber-950/30 dark:ring-amber-800/60"
            >
              <div className="relative size-16 rounded-2xl overflow-hidden shrink-0 ring-1 ring-amber-300/60 dark:ring-amber-700/60 bg-amber-100 dark:bg-amber-900/60">
                {imageUrl ? (
                  // `unoptimized` matches what /catalog uses for product
                  // images. Without it, Next's image optimizer can fail
                  // silently for Supabase storage URLs and the thumbnail
                  // never appears.
                  <Image
                    src={imageUrl}
                    alt={displayName}
                    fill
                    sizes="64px"
                    quality={85}
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Gift
                      className="h-7 w-7 text-amber-700 dark:text-amber-300"
                      strokeWidth={2}
                    />
                  </div>
                )}
                {/* Tiny gift sticker corner — present even on the image
                    variant so the row keeps reading as a freebie. */}
                <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-amber-50 dark:ring-amber-950/30">
                  <Gift className="h-2.5 w-2.5" strokeWidth={2.6} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-amber-900 dark:text-amber-200">
                  Бэлэг
                </div>
                <div className="text-[12.5px] font-semibold text-amber-950 dark:text-amber-100 truncate">
                  {displayName} · {b.qty} ширхэг
                </div>
                <div className="text-[10.5px] text-amber-800/80 dark:text-amber-200/70 truncate">
                  {b.label}
                </div>
              </div>
              <span className="text-[11px] font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                ҮНЭГҮЙ
              </span>
            </div>
          );
        })}
      </div>

      {/* Upsell card — closest threshold the buyer hasn't crossed yet.
          Plain math: how much more they need to spend to unlock a bonus
          product. The whole point of FOMO is the user sees this BEFORE
          they checkout. */}
      {nextThreshold && nextThreshold.step_amount && (() => {
        const nextInfo = productInfoById[nextThreshold.product_id ?? ""];
        const nextName = nextInfo?.name ?? "бараа";
        const nextImg = nextInfo?.image_url ?? null;
        return (
        <div className="mt-3 rounded-2xl bg-gradient-to-br from-violet-50 via-fuchsia-50 to-rose-50 ring-1 ring-violet-200 p-3 flex items-center gap-3 dark:from-violet-950/40 dark:via-fuchsia-950/40 dark:to-rose-950/40 dark:ring-violet-800/60">
          {/* Mini thumbnail of the reward product when we have one — gives
              the upsell card a concrete "you'll get THIS" preview. */}
          <div className="relative size-14 rounded-2xl overflow-hidden shrink-0 ring-1 ring-violet-200 dark:ring-violet-800/60 bg-violet-100 dark:bg-violet-950/60">
            {nextImg ? (
              <Image
                src={nextImg}
                alt={nextName}
                fill
                sizes="56px"
                quality={85}
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-violet-700 dark:text-violet-300">
                <Sparkles className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold leading-tight">
              Дахиад{" "}
              <span className="tabular-nums font-bold text-violet-700 dark:text-violet-300">
                {formatMnt(nextThreshold.step_amount - subtotalAfterProduct)}
              </span>{" "}
              нэмбэл бэлэг!
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {nextThreshold.name} · {nextName} ·{" "}
              {nextThreshold.bonus_n ?? 1} ширхэг
            </div>
            {/* Progress bar — how close they are to the threshold. */}
            <div className="mt-1.5 h-1 rounded-full bg-violet-100 dark:bg-violet-950/60 overflow-hidden">
              <div
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (subtotalAfterProduct /
                        (nextThreshold.step_amount || 1)) *
                        100,
                    ),
                  )}%`,
                }}
                className="h-full bg-violet-500 rounded-full"
              />
            </div>
          </div>
        </div>
        );
      })()}

      {/* Payment method picker — two side-by-side cards. Selecting Бэлэн
          auto-applies the 2% cash discount which surfaces in the sticky
          totals bar below. */}
      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-2">
          Төлбөрийн арга
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPaymentMethod("credit")}
            aria-pressed={paymentMethod === "credit"}
            className={`rounded-2xl ring-1 p-3 text-left transition-all ${
              paymentMethod === "credit"
                ? "ring-primary bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))] shadow-sm"
                : "ring-border bg-card hover:bg-muted/40"
            }`}
          >
            <CreditCard
              className={`h-4 w-4 mb-1.5 ${paymentMethod === "credit" ? "text-primary" : "text-muted-foreground"}`}
            />
            <div className="text-[13px] font-bold">Зээл</div>
            <div className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">
              Дараа төлбөртэйгээр
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("cash")}
            aria-pressed={paymentMethod === "cash"}
            className={`relative rounded-2xl ring-1 p-3 text-left transition-all ${
              paymentMethod === "cash"
                ? "ring-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-sm"
                : "ring-border bg-card hover:bg-muted/40"
            }`}
          >
            <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">
              -2%
            </span>
            <Banknote
              className={`h-4 w-4 mb-1.5 ${paymentMethod === "cash" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
            />
            <div className="text-[13px] font-bold">Бэлэн</div>
            <div className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">
              Хүргэлтийн үед төлнө
            </div>
          </button>
        </div>
      </div>

      {/* Notes block */}
      <div className="mt-5">
        <label
          htmlFor="notes"
          className="block text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground mb-2"
        >
          Тэмдэглэл (заавал биш)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Жш: Маргааш 10 цаг хүртэл хүргэх боломжтой бол хүргэнэ үү"
          className="w-full rounded-2xl bg-muted/60 ring-1 ring-border px-4 py-3 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-card transition-all"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Sticky submit bar — when there are discount steps we render a
          loud breakdown so the buyer can SEE the savings before they
          checkout. Each step gets its own row in emerald with "−X₮", a
          "ХЯМДРАЛ" pill above the total, and the strikethrough gross
          adjacent to the final net. */}
      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] lg:bottom-14 left-0 right-0 glass-strong border-t border-border/30 px-3 pt-3 pb-3 z-10 shadow-lg shadow-black/5">
        <div className="max-w-2xl mx-auto">
          {breakdown.steps.length > 0 ? (
            <div className="mb-2 rounded-2xl bg-gradient-to-r from-emerald-50 to-card ring-1 ring-emerald-200 px-3 py-2.5 space-y-1 dark:from-emerald-950/30 dark:to-card dark:ring-emerald-800/60">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] font-bold text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="h-3 w-3" />
                  Хямдрал
                </div>
                <div className="text-[11px] text-muted-foreground">
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
                  className="flex items-baseline justify-between text-[11.5px] text-emerald-700 dark:text-emerald-400"
                >
                  <span className="truncate pr-2">{s.label}</span>
                  <span className="tabular-nums shrink-0 font-semibold">
                    −{formatMnt(s.amount)}
                  </span>
                </div>
              ))}
              <div className="flex items-baseline justify-between pt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/40">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
                    Нийт төлөх
                  </span>
                  <span className="text-[11px] tabular-nums line-through text-muted-foreground/70">
                    {formatMnt(total)}
                  </span>
                </div>
                <span className="text-[24px] font-bold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-300">
                  {formatMnt(breakdown.net)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline justify-between mb-2 px-1">
              <span className="text-[11px] uppercase tracking-[0.1em] font-bold text-muted-foreground">
                Нийт
              </span>
              <span className="text-[22px] font-bold tabular-nums tracking-tight">
                {formatMnt(total)}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || cart.length === 0}
            aria-busy={pending}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-[14px] flex items-center justify-center gap-2 shadow-md shadow-[color-mix(in_oklch,var(--primary)_25%,transparent)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Илгээж байна...
              </>
            ) : (
              <>
                Захиалга илгээх
                <ChevronRight className="h-4 w-4 opacity-80" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Per-row quantity stepper for cart lines. Same UX shape as the
 * catalog card stepper: -/+ buttons plus an inline-editable input
 * between them.
 *
 * Each row owns its own typing draft (the cart `qty` is the source of
 * truth — we sync the draft to it whenever the cart re-renders). On
 * blur/Enter we commit; Escape reverts.
 *
 * Typing `0` and committing removes the row (matches the behavior of
 * pressing - until it would go below 1, which is otherwise blocked
 * because the - button is `disabled` at qty=1). This is the
 * pragmatic way to clear a single line without making the trash
 * button the only path.
 */
function CartLineQtyStepper({
  productId,
  qty,
}: {
  productId: string;
  qty: number;
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
    if (trimmed === "") {
      setDraft(String(qty));
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) {
      setDraft(String(qty));
      return;
    }
    const floored = Math.floor(n);
    if (floored === qty) {
      setDraft(String(qty));
      return;
    }
    updateQty(productId, floored);
  }

  return (
    <div className="inline-flex items-center rounded-full bg-muted ring-1 ring-border">
      <button
        type="button"
        onClick={() => updateQty(productId, qty - 1)}
        disabled={qty <= 1}
        aria-label="Хасах"
        className="size-7 flex items-center justify-center hover:bg-[oklch(0.94_0.005_264)] rounded-l-full disabled:opacity-40 active:scale-90 transition-transform"
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2.4} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9]/g, "");
          setDraft(cleaned);
        }}
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
        aria-label="Тоо ширхэг"
        // Fixed width — the pill is `inline-flex` so it sizes to
        // content; without an explicit width the input inherits HTML's
        // default size=20 (~150px) and blows the pill out across the row.
        size={1}
        maxLength={4}
        className="w-10 px-1 text-[12.5px] font-bold tabular-nums text-center bg-transparent border-0 outline-none focus:bg-background/60 transition-colors"
      />
      <button
        type="button"
        onClick={() => updateQty(productId, qty + 1)}
        aria-label="Нэмэх"
        className="size-7 flex items-center justify-center hover:bg-[oklch(0.94_0.005_264)] rounded-r-full active:scale-90 transition-transform"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
      </button>
    </div>
  );
}
