"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, Sparkles, Timer, TrendingDown } from "lucide-react";
import { formatMnt } from "@/lib/format";
import type { DiscountRule } from "@/lib/discount";

/**
 * Discount card building blocks. The catalog used to render a hero with
 * a horizontal scroll rail above the product grid; that was removed in
 * favor of a header chip + drawer (see `discounts-chip.tsx`). The
 * actual SaleCard / BonusCard visuals are kept here so they can be
 * reused inside the drawer — no top-level wrapper exported, since
 * nothing renders them in a rail anymore.
 *
 * Two card kinds, visually distinct on purpose:
 *
 *   - SaleCard   — kind='product'. Clean white card with a bold emerald
 *                  −N% ribbon on top. Reads as "money off, buy now".
 *   - BonusCard  — kind='threshold_bonus'. Warm amber/gold card with a
 *                  gift icon and a stacked "spend X get Y free" layout.
 *                  Reads as "unlock a reward".
 *
 * Both accept an `onNavigate` callback so the drawer can close itself
 * before the router pushes the new route.
 */

export type DiscountCard = {
  rule: DiscountRule;
  productName: string | null;
  categoryName: string | null;
};

// ---------------------------------------------------------------------
// Sale card — kind='product'
// ---------------------------------------------------------------------

export function SaleCard({
  card,
  onNavigate,
}: {
  card: DiscountCard;
  onNavigate?: () => void;
}) {
  const r = card.rule;
  const target = card.productName ?? card.categoryName ?? "Бүх бараа";
  const href = r.product_id
    ? `/catalog/${r.product_id}`
    : r.category_id
      ? `/catalog?category=${r.category_id}`
      : "/catalog";
  const pct = Number(r.pct) || 0;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="block rounded-2xl ring-1 ring-emerald-200 bg-card hover:ring-emerald-400 hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden dark:ring-emerald-800/60 dark:hover:ring-emerald-700"
    >
      {/* Top ribbon — the percentage is the headline; everything else
          supports it. Gradient gives the ribbon a bit of dimension so
          it reads as a stamp rather than a flat fill. */}
      <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 text-white px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-baseline gap-0.5">
          <span className="text-[32px] font-black tabular-nums leading-none tracking-tight">
            −{pct}
          </span>
          <span className="text-[14px] font-bold opacity-85">%</span>
        </div>
        <TrendingDown className="h-5 w-5 opacity-80" strokeWidth={2.4} />
        {/* Diagonal highlight strip for ribbon vibe */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.12)_50%,transparent_60%)]" />
      </div>
      <div className="px-3 py-2.5">
        <div className="text-[10.5px] uppercase tracking-[0.08em] font-bold text-emerald-700 dark:text-emerald-300 line-clamp-1">
          {r.name}
        </div>
        <div className="text-[12.5px] font-semibold leading-snug line-clamp-2 mt-0.5 min-h-[2.4em]">
          {target}
        </div>
        {r.ends_at && (
          <div className="mt-1.5">
            <Countdown endsAt={r.ends_at} accent="emerald" />
          </div>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------
// Bonus card — kind='threshold_bonus'
// ---------------------------------------------------------------------

export function BonusCard({
  card,
  onNavigate,
}: {
  card: DiscountCard;
  onNavigate?: () => void;
}) {
  const r = card.rule;
  const bonusProductName = card.productName ?? "бараа";
  const threshold = Number(r.step_amount) || 0;
  const bonusQty = Number(r.bonus_n) || 1;

  return (
    <Link
      href="/catalog"
      onClick={onNavigate}
      className="relative block rounded-2xl overflow-hidden ring-1 ring-amber-300 hover:ring-amber-500 hover:shadow-md hover:-translate-y-0.5 transition-all bg-gradient-to-br from-amber-50 via-amber-100 to-orange-100 dark:from-amber-950/50 dark:via-amber-900/40 dark:to-orange-950/50 dark:ring-amber-700/60"
    >
      {/* Decorative gift watermark — illustrative only, no click target. */}
      <Gift
        className="absolute -top-3 -right-3 h-24 w-24 text-amber-400/40 dark:text-amber-600/25 rotate-12 pointer-events-none"
        strokeWidth={1.1}
      />

      <div className="relative p-3">
        <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-[0.08em] font-bold text-amber-700 dark:text-amber-300">
          <Sparkles className="h-3 w-3" strokeWidth={2.4} />
          Бэлэг урамшуулал
        </div>
        <div className="text-[11.5px] font-semibold text-amber-900 dark:text-amber-100 mt-0.5 line-clamp-1">
          {r.name}
        </div>

        {/* Threshold figure — what the buyer needs to hit. */}
        <div className="mt-2.5 flex items-baseline gap-1">
          <span className="text-[20px] font-black tabular-nums tracking-tight text-amber-900 dark:text-amber-100">
            {formatMnt(threshold)}
          </span>
          <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80 font-semibold">
            -аас дээш
          </span>
        </div>

        {/* Reward chip — what they get. Inner card with white-ish
            backdrop so it reads as a separate "gift unlocked" pill. */}
        <div className="mt-2 rounded-xl bg-white/70 dark:bg-black/25 ring-1 ring-amber-300/50 dark:ring-amber-700/40 px-2.5 py-1.5">
          <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-[0.08em] font-bold text-amber-700/85 dark:text-amber-300/85">
            <Gift className="h-3 w-3" strokeWidth={2.4} />
            Үнэгүй
          </div>
          <div className="text-[12.5px] font-bold text-amber-950 dark:text-amber-50 line-clamp-2 leading-tight mt-0.5">
            {bonusQty} ширхэг {bonusProductName}
          </div>
        </div>

        {r.ends_at && (
          <div className="mt-2">
            <Countdown endsAt={r.ends_at} accent="amber" />
          </div>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------
// Live countdown chip — tone-matched to its parent card.
//   Ticks per second when < 1h remaining, per minute otherwise.
// ---------------------------------------------------------------------

export function Countdown({
  endsAt,
  accent,
}: {
  endsAt: string;
  accent: "emerald" | "amber";
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const end = new Date(endsAt).getTime();
    const remaining = end - now;
    const interval = remaining < 60_000 * 60 ? 1000 : 60_000;
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [endsAt, now]);

  const remainingMs = new Date(endsAt).getTime() - now;
  if (remainingMs <= 0) return null;

  const sec = Math.floor(remainingMs / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;

  let label: string;
  if (days >= 1) label = `${days}ө ${hours}ц`;
  else if (hours >= 1) label = `${hours}ц ${String(mins).padStart(2, "0")}м`;
  else
    label = `${String(mins).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0",
    )}`;

  const toneClass =
    accent === "emerald"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/60"
      : "bg-white/70 text-amber-800 ring-amber-300/60 dark:bg-black/25 dark:text-amber-200 dark:ring-amber-700/40";

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1 ${toneClass}`}
    >
      <Timer className="h-3 w-3" strokeWidth={2.4} />
      {label}
    </div>
  );
}
