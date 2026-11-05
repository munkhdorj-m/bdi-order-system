/**
 * The BDI wordmark as one SVG path — the letters "BDI" in Montserrat
 * ExtraBold (the site's display face, SIL Open Font License), converted
 * to outlines so the logo needs no font file and looks the same in the
 * app icon, the favicon and on every screen.
 *
 * Coordinates are font units: caps run from y=0 (top) to y=700 (baseline);
 * the ink spans x=70…1843. Use BDI_VIEWBOX to frame it tightly.
 */
export const BDI_PATH =
  "M70 700V0H428Q566 0 634 50.5Q702 101 702 183Q702 237 673.5 277.5Q645 318 593.5 341.5Q542 365 471 365L491 317Q565 317 620 339.5Q675 362 705.5 404.5Q736 447 736 508Q736 599 662.5 649.5Q589 700 448 700ZM266 557H432Q483 557 509.5 539.5Q536 522 536 486Q536 450 509.5 432.5Q483 415 432 415H252V278H402Q452 278 477 261Q502 244 502 210Q502 176 477 159.5Q452 143 402 143H266Z M829 700V0H1160Q1276 0 1364 43Q1452 86 1501.5 164Q1551 242 1551 350Q1551 457 1501.5 535.5Q1452 614 1364 657Q1276 700 1160 700ZM1027 542H1152Q1212 542 1256.5 519.5Q1301 497 1326 453.5Q1351 410 1351 350Q1351 289 1326 246Q1301 203 1256.5 180.5Q1212 158 1152 158H1027Z M1645 700V0H1843V700Z";

export const BDI_VIEWBOX = "70 0 1773 700";
/** Width ÷ height of the wordmark. */
export const BDI_ASPECT = 1773 / 700;

/** Brand colours as hex (the oklch tokens in globals.css, converted). */
export const BRAND = {
  /** --brand-bar: the blue top bar, the app icon, the splash screen. */
  blue: "#1c49ba",
  /** --gold */
  gold: "#f4b43a",
  /** --gold-foreground */
  goldInk: "#3b1f02",
  /** Dark-mode canvas. */
  navy: "#0f1630",
} as const;
