export function formatMnt(n: number): string {
  return new Intl.NumberFormat("mn-MN").format(n) + "₮";
}
