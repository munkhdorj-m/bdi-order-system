/**
 * BDI contact + social links — single source of truth.
 *
 * Everything is driven by NEXT_PUBLIC_* env vars so the values can change
 * per-deploy without touching code (and so they're available in both
 * server and client components — Next inlines NEXT_PUBLIC_* at build).
 *
 * Only links that are actually configured show up: leave a var blank in
 * the environment and that row simply doesn't render. The phone reuses
 * the existing NEXT_PUBLIC_BDI_SUPPORT_PHONE so there's one number across
 * the app (order-detail "call us", contact page, login footer).
 */

export type ContactLinkType =
  | "phone"
  | "facebook"
  | "instagram"
  | "website"
  | "address";

export type ContactLink = {
  type: ContactLinkType;
  /** Short human label, e.g. "Утас", "Фэйсбүүк". */
  label: string;
  /** The value shown to the user (the number, the @handle, the domain). */
  display: string;
  /** href for the anchor — tel:, https://, or a maps query. */
  href: string;
  /** Whether tapping leaves the app (so we can add target=_blank). */
  external: boolean;
};

function clean(v: string | undefined): string {
  return (v ?? "").trim();
}

/** Strip spaces/dashes/parens from a phone for the tel: href. */
function telHref(phone: string): string {
  const compact = phone.replace(/[^\d+]/g, "");
  return `tel:${compact}`;
}

/** Accept either a full URL or a bare handle/domain and normalize. */
function urlHref(raw: string, base: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "").replace(/^\//, "");
  return `${base}${handle}`;
}

/**
 * Build the list of configured contact links in display order.
 * Returns [] when nothing is set, so callers can hide the whole block.
 */
export function getContactLinks(): ContactLink[] {
  const phone = clean(process.env.NEXT_PUBLIC_BDI_SUPPORT_PHONE);
  const facebook = clean(process.env.NEXT_PUBLIC_BDI_FACEBOOK);
  const instagram = clean(process.env.NEXT_PUBLIC_BDI_INSTAGRAM);
  const website = clean(process.env.NEXT_PUBLIC_BDI_WEBSITE);
  const address = clean(process.env.NEXT_PUBLIC_BDI_ADDRESS);

  const links: ContactLink[] = [];

  if (phone) {
    links.push({
      type: "phone",
      label: "Утас",
      display: phone,
      href: telHref(phone),
      external: false,
    });
  }
  if (facebook) {
    links.push({
      type: "facebook",
      label: "Фэйсбүүк",
      display: facebook.replace(/^https?:\/\/(www\.)?/i, ""),
      href: urlHref(facebook, "https://facebook.com/"),
      external: true,
    });
  }
  if (instagram) {
    links.push({
      type: "instagram",
      label: "Инстаграм",
      display: instagram.startsWith("@")
        ? instagram
        : instagram.replace(/^https?:\/\/(www\.)?/i, ""),
      href: urlHref(instagram, "https://instagram.com/"),
      external: true,
    });
  }
  if (website) {
    links.push({
      type: "website",
      label: "Вэбсайт",
      display: website.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""),
      href: urlHref(website, "https://"),
      external: true,
    });
  }
  if (address) {
    links.push({
      type: "address",
      label: "Хаяг",
      display: address,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
      external: true,
    });
  }

  return links;
}

export function hasContactLinks(): boolean {
  return getContactLinks().length > 0;
}
