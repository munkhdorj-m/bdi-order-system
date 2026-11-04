import "server-only";

/**
 * Telegram bot delivery — the reliable half of the admin alerting stack.
 *
 * Why this exists alongside Web Push: Web Push is free and native, but
 * it has two real-world holes. On iPhone it only works once the admin
 * has added the site to their Home Screen, and on every platform the
 * browser may evict the service worker if the PWA hasn't been opened
 * in weeks. Telegram has neither problem — it's a normal app the OS
 * keeps alive, so an alert lands on the lock screen regardless.
 *
 * Also free and unlimited, and there's no per-admin setup beyond
 * joining one group chat.
 *
 * Setup (once, ~2 minutes) — full walkthrough in
 * docs/notifications-setup.md:
 *   1. Message @BotFather on Telegram → /newbot → copy the token into
 *      TELEGRAM_BOT_TOKEN.
 *   2. Create a group, add the bot, and send `/start@YourBotName` there
 *      (bots never see ordinary group messages — privacy mode).
 *   3. Open https://api.telegram.org/bot<TOKEN>/getUpdates and copy the
 *      `chat.id` of the entry with "type":"group" (a NEGATIVE number)
 *      into TELEGRAM_CHAT_ID. A positive id is a private chat.
 *
 * TELEGRAM_CHAT_ID accepts a comma-separated list, so you can send to
 * a group AND a couple of individual admins without code changes.
 *
 * Errors are swallowed and logged — a Telegram outage must never break
 * an order.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_IDS = process.env.TELEGRAM_CHAT_ID;

/** True when a bot token + at least one chat id are configured. */
export function telegramConfigured(): boolean {
  return Boolean(TOKEN && CHAT_IDS);
}

function chatIds(): string[] {
  return (CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Telegram's HTML parse mode only allows a small tag whitelist, and it
 * rejects the whole message if a stray `<` or `&` in a store name looks
 * like a malformed tag. Escape everything we interpolate.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Public base URL for the "open" button, or null if we only know a
 * local one.
 *
 * Telegram refuses to link to localhost or a bare IP address. A text
 * link to one silently degrades to plain text (the dead "Нээх →" this
 * replaced), and an inline button with one makes Telegram reject the
 * whole message ("Wrong HTTP URL"). So alerts sent from local dev go
 * out without a button.
 *
 * NEXT_PUBLIC_SITE_URL wins when it's public. Otherwise fall back to
 * the production domain Vercel exposes to every deployment, so the
 * button works on the live site even if NEXT_PUBLIC_SITE_URL was never
 * set there (nothing else in the app needs it: the verify.mn flow reads
 * its origin from request headers).
 */
function publicBaseUrl(): string | null {
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    vercelDomain ? `https://${vercelDomain}` : undefined,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    let host: string;
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
      host = u.hostname;
    } catch {
      continue;
    }
    const isLocal =
      host === "localhost" ||
      host.endsWith(".localhost") ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || // bare IPv4
      host.startsWith("["); // bare IPv6
    if (!isLocal) return raw.replace(/\/+$/, "");
  }
  return null;
}

export type TelegramMessage = {
  title: string;
  body?: string | null;
  /** App-relative path — becomes a tappable button under the message. */
  href?: string | null;
  /** Label for that button, e.g. "Захиалга харах". */
  buttonText?: string;
  /** Leading emoji so admins can triage the chat at a glance. */
  emoji?: string;
};

function postMessage(payload: Record<string, unknown>): Promise<Response> {
  return fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    // Never let a hung Telegram request stall a server action.
    signal: AbortSignal.timeout(8000),
  });
}

/** Send one formatted message to every configured chat. */
export async function sendTelegram(msg: TelegramMessage): Promise<void> {
  if (!telegramConfigured()) return;

  const ids = chatIds();
  if (ids.length === 0) return;

  const lines = [`${msg.emoji ?? "🔔"} <b>${escapeHtml(msg.title)}</b>`];
  if (msg.body) lines.push(escapeHtml(msg.body));
  const text = lines.join("\n");

  const base = publicBaseUrl();
  const buttonUrl = msg.href && base ? `${base}${msg.href}` : null;

  await Promise.all(
    ids.map(async (chat_id) => {
      const plain = {
        chat_id,
        text,
        parse_mode: "HTML",
        // Link previews on our own domain add nothing but noise.
        link_preview_options: { is_disabled: true },
      };

      try {
        let res = await postMessage(
          buttonUrl
            ? {
                ...plain,
                reply_markup: {
                  inline_keyboard: [
                    [{ text: msg.buttonText ?? "Нээх", url: buttonUrl }],
                  ],
                },
              }
            : plain,
        );

        // Telegram validates button URLs strictly and rejects the WHOLE
        // message over one it dislikes. Never lose an alert over a
        // button: log why, then resend without it.
        if (buttonUrl && res.status === 400) {
          const detail = await res.text().catch(() => "");
          if (!/button|url/i.test(detail)) {
            console.error(
              `telegram sendMessage failed (400) for chat ${chat_id}:`,
              detail.slice(0, 300),
            );
            return;
          }
          console.error(
            `telegram rejected button URL ${buttonUrl}; resending without it:`,
            detail.slice(0, 300),
          );
          res = await postMessage(plain);
        }

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          console.error(
            `telegram sendMessage failed (${res.status}) for chat ${chat_id}:`,
            detail.slice(0, 300),
          );
        }
      } catch (e) {
        console.error("telegram send threw:", (e as Error)?.message);
      }
    }),
  );
}
