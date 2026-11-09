/**
 * Quick page scroll for "jump to category" taps. The browser's own smooth
 * scroll slows down with distance (well over a second across a long
 * catalog); this always takes ~¼ s, and is instant when the device asks
 * for reduced motion.
 */
export function fastScrollTo(top: number, durationMs = 260): void {
  const start = window.scrollY;
  const target = Math.max(0, top);
  const distance = target - start;
  if (Math.abs(distance) < 2) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo({ top: target, behavior: "instant" });
    return;
  }
  const t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / durationMs);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
    // "instant": each frame jumps exactly where the easing says; a
    // `scroll-behavior: smooth` anywhere would otherwise re-animate it.
    window.scrollTo({ top: start + distance * eased, behavior: "instant" });
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Scroll so `el` starts just below `offsetTop` px of sticky chrome. */
export function fastScrollToElement(el: HTMLElement, offsetTop: number): void {
  fastScrollTo(el.getBoundingClientRect().top + window.scrollY - offsetTop);
}
