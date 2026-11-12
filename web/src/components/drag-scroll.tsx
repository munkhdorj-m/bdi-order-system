"use client";

import { useEffect } from "react";

/**
 * Drag to scroll, everywhere.
 *
 * Whatever doesn't fit across the screen — a table with many columns, a
 * row of filter chips, the category rail — sits in a sideways-scrolling
 * area. A finger drags those already; a mouse couldn't (only Shift+wheel
 * or a thin scrollbar). With this mounted once, pressing and dragging
 * with the mouse scrolls the nearest sideways-scrolling area, and the
 * cursor turns into a hand over one that really has more to show.
 *
 * It only ever acts on an area that overflows sideways. A press that
 * doesn't move is still a normal click; a real drag swallows the click
 * that would follow, so dragging a table by one of its links doesn't
 * open the link. Fields and anything marked `data-no-drag-scroll` are
 * left alone (dragging there selects text, as it should).
 */

/** Movement before a press becomes a drag — below this it is still a click. */
const THRESHOLD_PX = 6;

const SKIP = 'input, textarea, select, option, [contenteditable=""], [contenteditable="true"], [role="slider"], [data-no-drag-scroll]';

/** The nearest ancestor that scrolls sideways AND has something hidden to the side. */
function sideScroller(from: EventTarget | null): HTMLElement | null {
  for (let el = from instanceof Element ? from : null; el && el !== document.documentElement; el = el.parentElement) {
    if (!(el instanceof HTMLElement) || el === document.body) continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const overflow = getComputedStyle(el).overflowX;
    if (overflow === "auto" || overflow === "scroll") return el;
  }
  return null;
}

export function DragScroll() {
  useEffect(() => {
    let scroller: HTMLElement | null = null;
    let pointerId = -1;
    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let swallowClick = false;
    let hovered: HTMLElement | null = null;

    const stop = () => {
      if (dragging) {
        document.documentElement.classList.remove("drag-scrolling");
        // The click that follows this release belongs to the drag, not to a link under it.
        swallowClick = true;
        window.setTimeout(() => {
          swallowClick = false;
        }, 80);
      }
      scroller = null;
      dragging = false;
      pointerId = -1;
    };

    const onDown = (e: PointerEvent) => {
      // Fingers and pens scroll these natively.
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (e.target instanceof Element && e.target.closest(SKIP)) return;
      const el = sideScroller(e.target);
      if (!el) return;
      scroller = el;
      pointerId = e.pointerId;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      dragging = false;
    };

    const onMove = (e: PointerEvent) => {
      if (!scroller || e.pointerId !== pointerId) return;
      // The button was let go somewhere we didn't see (outside the window).
      if (e.buttons === 0) return stop();
      const dx = e.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < THRESHOLD_PX) return;
        dragging = true;
        document.documentElement.classList.add("drag-scrolling");
        window.getSelection()?.removeAllRanges();
      }
      scroller.scrollLeft = startLeft - dx;
      e.preventDefault();
    };

    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    };

    // A link or picture inside a scrolling area would otherwise be picked up
    // by the browser's own drag-and-drop and steal the gesture.
    const onDragStart = (e: DragEvent) => {
      if (scroller) e.preventDefault();
    };

    // The hand cursor: only over an area that has more to the side right now.
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || dragging) return;
      const el = sideScroller(e.target);
      if (el === hovered) return;
      hovered?.removeAttribute("data-drag-scroll");
      hovered = el;
      el?.setAttribute("data-drag-scroll", "");
    };

    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, { capture: true, passive: false });
    window.addEventListener("pointerup", stop, true);
    window.addEventListener("pointercancel", stop, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("dragstart", onDragStart, true);
    window.addEventListener("pointerover", onOver, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", stop, true);
      window.removeEventListener("pointercancel", stop, true);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("dragstart", onDragStart, true);
      window.removeEventListener("pointerover", onOver, true);
      hovered?.removeAttribute("data-drag-scroll");
      document.documentElement.classList.remove("drag-scrolling");
    };
  }, []);

  return null;
}
