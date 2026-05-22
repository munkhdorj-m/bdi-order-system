"use client";

import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react";

type Props = {
  length?: number;
  /** Name of the hidden input that posts the combined code to the server. */
  name: string;
  /** When all cells are filled, optionally auto-submit the parent form. */
  autoSubmit?: boolean;
};

/**
 * 6-cell OTP input. The first cell wears `autoComplete="one-time-code"`
 * so iOS/Android still show the paste-from-SMS suggestion; on paste we
 * spread the digits across the cells.
 *
 * Why a hidden combined input instead of named-per-cell:
 *   - Server actions only need a single `code` field; this keeps the
 *     action signature unchanged from when this was a single-input form
 *   - The cells themselves are unnamed so they don't pollute FormData
 */
export function OtpCells({ length = 6, name, autoSubmit = true }: Props) {
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length }, () => ""),
  );
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  function setAt(i: number, ch: string) {
    setDigits((prev) => {
      const next = prev.slice();
      next[i] = ch;
      return next;
    });
  }

  function focusAt(i: number) {
    const el = inputsRef.current[i];
    if (el) {
      el.focus();
      el.select();
    }
  }

  function trySubmit(combined: string, form: HTMLFormElement | null) {
    if (!autoSubmit || !form) return;
    if (combined.length !== length || combined.includes("")) return;
    // requestSubmit so the form's `action={...}` runs through the normal
    // server-action path. Defer to next tick so the hidden input's value
    // has propagated through React's render.
    setTimeout(() => form.requestSubmit(), 0);
  }

  function handleChange(i: number, raw: string, form: HTMLFormElement | null) {
    // Mobile keyboards sometimes deliver multi-char strings (e.g. paste from
    // SMS, or pre-typed text). Spread them across cells starting at `i`.
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      setAt(i, "");
      return;
    }
    if (cleaned.length === 1) {
      setAt(i, cleaned);
      if (i < length - 1) focusAt(i + 1);
      // Check completeness after this single-cell update.
      const next = digits.slice();
      next[i] = cleaned;
      trySubmit(next.join(""), form);
      return;
    }
    // Multi-char: distribute starting at i, then move focus to the next
    // empty cell (or the last one if all filled).
    const next = digits.slice();
    for (let k = 0; k < cleaned.length && i + k < length; k++) {
      next[i + k] = cleaned[k];
    }
    setDigits(next);
    const lastFilled = Math.min(i + cleaned.length - 1, length - 1);
    focusAt(Math.min(lastFilled + 1, length - 1));
    trySubmit(next.join(""), form);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    // Backspace on an empty cell jumps back and clears the previous one —
    // a familiar OTP-input convention.
    if (e.key === "Backspace" && digits[i] === "" && i > 0) {
      e.preventDefault();
      setAt(i - 1, "");
      focusAt(i - 1);
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight" && i < length - 1) {
      e.preventDefault();
      focusAt(i + 1);
    }
  }

  function handlePaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    const cleaned = text.replace(/\D/g, "");
    if (!cleaned) return;
    e.preventDefault();
    handleChange(i, cleaned, (e.target as HTMLInputElement).form);
  }

  const combined = digits.join("");

  return (
    <div>
      {/* Hidden combined value — what the form actually submits */}
      <input type="hidden" name={name} value={combined} />

      <div className="flex gap-2 sm:gap-2.5" role="group" aria-label="Баталгаажуулах код">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            // Only the first cell carries the OTP autocomplete hint; this is
            // intentional — iOS/Android will surface the paste suggestion on
            // the first cell, and our paste handler spreads it across the
            // rest. Marking every cell as one-time-code can confuse OS hints.
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={i === 0}
            maxLength={1}
            pattern="[0-9]"
            value={digits[i]}
            onChange={(e) =>
              handleChange(i, e.target.value, e.target.form)
            }
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={(e) => handlePaste(i, e)}
            onFocus={(e) => e.target.select()}
            aria-label={`Кодын ${i + 1}-р тоо`}
            className={`flex-1 aspect-[5/6] rounded-2xl bg-card text-center text-[28px] font-bold tabular-nums transition-all outline-none ${
              digits[i]
                ? "ring-2 ring-primary text-foreground"
                : "ring-1 ring-border text-muted-foreground/60"
            } focus:ring-2 focus:ring-primary focus:text-foreground`}
          />
        ))}
      </div>
    </div>
  );
}
