import "server-only";
import { siteUrl } from "./auth";

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
 * Setup (once, ~2 minutes):
 *   1. Message @BotFather on Telegram → /newbot → copy the token into
 *      TELEGRAM_BOT_TOKEN.
 *   2. Make a group, add the bot to it, and post any message.
 *   3. Open https://api.telegram.org/bot<TOKEN>/getUpdates and copy
 *      the negative `chat.id` into TELEGRAM_CHAT_ID.
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
 * rejects the whole message if a stray `<` or `&` in a product name
 * looks like a malformed tag. Escape everything we interpolate.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export type TelegramMessage = {
  title: string;
  body?: string | null;
  /** App-relative path — turned into a tappable absolute link. */
  href?: string | null;
  /** Leading emoji so admins can triage the chat at a glance. */
  emoji?: string;
};

/** Send one formatted message to every configured chat. */
export async function sendTelegram(msg: TelegramMessage): Promise<void> {
  if (!telegramConfigured()) return;

  const ids = chatIds();
  if (ids.length === 0) return;

  const lines: string[] = [
    `${msg.emoji ?? "🔔"} <b>${escapeHtml(msg.title)}</b>`,
  ];
  if (msg.body) lines.push(escapeHtml(msg.body));
  if (msg.href) {
    const url = `${siteUrl()}${msg.href}`;
    lines.push(`\n<a href="${escapeHtml(url)}">Нээх →</a>`);
  }
  const text = lines.join("\n");

  await Promise.all(
    ids.map(async (chat_id) => {
      try {
        const res = await fetch(
          `https://api.telegram.org/bot${TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id,
              text,
              parse_mode: "HTML",
              // Link previews on our own domain add nothing but noise.
              link_preview_options: { is_disabled: true },
            }),
            // Never let a hung Telegram request stall a server action.
            signal: AbortSignal.timeout(8000),
          },
        );
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
