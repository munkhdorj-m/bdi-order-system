import { ChevronRight, Globe, MapPin, Phone } from "lucide-react";
import { getContactLinks, type ContactLinkType } from "@/lib/contact";

// lucide-react removed brand glyphs (trademark), so Facebook + Instagram
// are inlined here. Same 24×24 viewBox + currentColor as lucide so they
// drop into the same sizing/tone classes seamlessly.
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.95.93-1.95 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07Z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

type IconCmp = (props: { className?: string }) => React.ReactNode;

const ICON: Record<ContactLinkType, IconCmp> = {
  phone: (p) => <Phone {...p} strokeWidth={2} />,
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  website: (p) => <Globe {...p} strokeWidth={2} />,
  address: (p) => <MapPin {...p} strokeWidth={2} />,
};

// Per-type tinted icon tile so the row scans at a glance — phone reads as
// "call", socials as their brand family, etc.
const TONE: Record<ContactLinkType, string> = {
  phone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  facebook: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  instagram: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
  website: "bg-primary/10 text-primary",
  address: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
};

/**
 * Tappable contact/social rows, driven by getContactLinks() (env-config).
 * Renders nothing when no links are configured, so callers can drop it in
 * unconditionally. Two visual variants:
 *
 *   - "card" (default): stacked rows in a card — for the contact page,
 *     pending/inactive gate screens.
 *   - "plain": borderless rows — for the login footer over the gradient.
 */
export function ContactLinks({
  variant = "card",
}: {
  variant?: "card" | "plain";
}) {
  const links = getContactLinks();
  if (links.length === 0) return null;

  if (variant === "plain") {
    return (
      <div className="flex flex-col gap-1.5">
        {links.map((l) => {
          const Icon = ICON[l.type];
          return (
            <a
              key={l.type}
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noopener noreferrer" : undefined}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-white/90 hover:bg-white/10 active:scale-[0.99] transition-all"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-[13px] font-medium truncate">
                {l.display}
              </span>
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border overflow-hidden divide-y divide-border">
      {links.map((l) => {
        const Icon = ICON[l.type];
        return (
          <a
            key={l.type}
            href={l.href}
            target={l.external ? "_blank" : undefined}
            rel={l.external ? "noopener noreferrer" : undefined}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 active:bg-muted transition-colors group"
          >
            <span
              className={`size-10 shrink-0 rounded-xl flex items-center justify-center ${TONE[l.type]}`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[11px] uppercase tracking-[0.08em] font-bold text-muted-foreground">
                {l.label}
              </span>
              <span className="block text-[14px] font-semibold truncate">
                {l.display}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
          </a>
        );
      })}
    </div>
  );
}
