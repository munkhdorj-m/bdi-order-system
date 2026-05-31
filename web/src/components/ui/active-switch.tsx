"use client";

import { useState } from "react";
import { Power } from "lucide-react";

/**
 * Reusable "active" toggle used across admin forms — products,
 * supermarkets, users, discounts, etc. Renders as an iOS-style switch
 * inside a tonal card with a live status sentence underneath, so the
 * admin sees the toggle effect described in words.
 *
 * Submits through a mirrored hidden `<input type="checkbox" name="active">`,
 * so server actions can keep reading `formData.get("active") === "on"`
 * with no signature changes.
 *
 * Props:
 *   - `defaultChecked` — initial state (defaults to true).
 *   - `disabled`       — show as un-tappable; used by user-form when
 *                        editing yourself so you can't deactivate your
 *                        own account.
 *   - `name`           — the field name to submit under (default: "active").
 *   - `activeLabel` / `inactiveLabel` — primary label per state.
 *   - `activeHint`    / `inactiveHint`  — secondary one-line hint per state.
 */
export function ActiveSwitch({
  defaultChecked = true,
  disabled = false,
  name = "active",
  activeLabel = "Идэвхтэй",
  inactiveLabel = "Идэвхгүй",
  activeHint = "Худалдан авагчид одоо харагдаж байна.",
  inactiveHint = "Хадгалсан ч худалдан авагчид харагдахгүй.",
  disabledHint,
}: {
  defaultChecked?: boolean;
  disabled?: boolean;
  name?: string;
  activeLabel?: string;
  inactiveLabel?: string;
  activeHint?: string;
  inactiveHint?: string;
  /** Override hint shown when `disabled=true`, e.g. for self-edit
   *  guards on the user form. */
  disabledHint?: string;
}) {
  const [active, setActive] = useState<boolean>(defaultChecked);

  return (
    <div
      className={`flex items-center justify-between rounded-2xl bg-muted/50 ring-1 ring-border px-4 py-3 ${disabled ? "opacity-70" : ""}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <Power
          className={`h-4 w-4 mt-0.5 shrink-0 transition-colors ${active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
          strokeWidth={2.2}
        />
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold">
            {active ? activeLabel : inactiveLabel}
          </div>
          <div className="text-[11.5px] text-muted-foreground leading-snug">
            {disabled && disabledHint
              ? disabledHint
              : active
                ? activeHint
                : inactiveHint}
          </div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        disabled={disabled}
        onClick={() => !disabled && setActive((v) => !v)}
        // Geometry notes (so this never overflows again):
        //   - Track: 44×24px, rounded-full. `overflow-hidden` clips the
        //     thumb so nothing can escape even if positioning math drifts.
        //   - Border (not ring) keeps the visual edge INSIDE the element's
        //     bounds — ring-1 in Tailwind v4 draws outside, which made the
        //     thumb appear to poke past the corner.
        //   - Thumb: explicit 20×20px circle, vertically centered via
        //     top-1/2 + -translate-y-1/2 so any browser font-size scaling
        //     doesn't shift it. Horizontal position via `left` with a
        //     `calc(100% - …)` for active so the gap from the right edge
        //     stays constant regardless of track width.
        className={`relative shrink-0 h-6 w-11 rounded-full border transition-colors overflow-hidden ${
          active
            ? "bg-emerald-500 border-emerald-600/40"
            : "bg-muted border-border"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          aria-hidden
          className="absolute top-1/2 -translate-y-1/2 size-[20px] rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out"
          style={{
            left: active ? "calc(100% - 22px)" : "2px",
          }}
        />
      </button>
      {/* Hidden checkbox the form actually submits. checked={active} keeps
          it in lock-step with the switch state. */}
      <input
        type="checkbox"
        name={name}
        checked={active}
        readOnly
        className="sr-only"
      />
    </div>
  );
}
