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
        className={`relative shrink-0 h-6 w-11 rounded-full ring-1 transition-colors ${
          active
            ? "bg-emerald-500 ring-emerald-500/30"
            : "bg-muted ring-border"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
            active ? "translate-x-5" : "translate-x-0.5"
          }`}
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
