import { Events, type Client, type Message } from "discord.js";
import { Logger } from "tslog";

const logger = new Logger({ name: "wakeRelay" });

/** Discord user ID of the bot we relay wakes for (hayagrov). */
export const DEFAULT_TARGET_USER_ID = "1005664183301459978";

export interface WakeRelayOptions {
  /** Webhook to POST wakes to. Relay is a no-op when unset. */
  url?: string;
  /** Optional value for the Authorization header (e.g. "Bearer <key>"). */
  authHeader?: string;
  /** Only relay from these channel IDs. Empty = every channel the bot can see. */
  channels: Set<string>;
  /** User whose mentions/replies trigger a wake. */
  targetUserId: string;
}

/** Read relay settings from the environment. */
export function wakeRelayOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): WakeRelayOptions {
  const channels = (env.GROK_WAKE_CHANNELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    url: env.GROK_WAKE_WEBHOOK_URL?.trim() || undefined,
    authHeader: env.GROK_WAKE_WEBHOOK_AUTH?.trim() || undefined,
    channels: new Set(channels),
    targetUserId: env.GROK_WAKE_TARGET_USER_ID?.trim() || DEFAULT_TARGET_USER_ID,
  };
}

/**
 * True when the message mentions the target user or replies to one of the
 * target's messages. The replied-to message is fetched only when Discord
 * didn't already tell us who was replied to.
 */
export async function isAimedAt(message: Message, targetUserId: string): Promise<boolean> {
  if (message.author?.id === targetUserId) return false;
  if (message.mentions?.users?.has(targetUserId)) return true;
  if (message.mentions?.repliedUser?.id === targetUserId) return true;
  if (!message.reference?.messageId) return false;
  try {
    const parent = await message.fetchReference();
    return parent.author?.id === targetUserId;
  } catch {
    return false;
  }
}

/** POST one wake. Never throws; failures are logged. */
export async function postWake(
  opts: WakeRelayOptions,
  message: Pick<Message, "channelId" | "id">,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!opts.url) return;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.authHeader) headers.Authorization = opts.authHeader;
  try {
    const res = await fetchImpl(opts.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        channel_id: message.channelId,
        message_id: message.id,
        source: "baymax",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) logger.warn(`wake POST for ${message.id} returned ${res.status}`);
  } catch (err) {
    logger.warn(`wake POST for ${message.id} failed:`, err);
  }
}

/** Handle one MessageCreate event. Exported for tests. */
export async function handleMessage(
  opts: WakeRelayOptions,
  message: Message,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!opts.url) return false;
  if (opts.channels.size > 0 && !opts.channels.has(message.channelId)) return false;
  if (!(await isAimedAt(message, opts.targetUserId))) return false;
  await postWake(opts, message, fetchImpl);
  return true;
}

/**
 * Register the wake relay on the client. Does nothing (and registers no
 * listener) when GROK_WAKE_WEBHOOK_URL is unset.
 */
export function registerWakeRelay(
  client: Client,
  opts: WakeRelayOptions = wakeRelayOptionsFromEnv(),
): void {
  if (!opts.url) {
    logger.info("GROK_WAKE_WEBHOOK_URL not set; wake relay disabled");
    return;
  }
  const scope = opts.channels.size > 0 ? [...opts.channels].join(", ") : "all channels";
  logger.info(`Wake relay enabled for ${opts.targetUserId} in ${scope}`);
  client.on(Events.MessageCreate, (message) => {
    // Fire-and-forget: never block or crash the event loop.
    void handleMessage(opts, message).catch((err) => logger.warn("wake relay error:", err));
  });
}
