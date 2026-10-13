import { describe, expect, it, mock } from "bun:test";
import type { Message } from "discord.js";
import { DEFAULT_TARGET_USER_ID, handleMessage, wakeRelayOptionsFromEnv } from "../wakeRelay";

const TARGET = DEFAULT_TARGET_USER_ID;
const CHANNEL = "1111111111111111111";

function fakeMessage(over: {
  authorId?: string;
  channelId?: string;
  mentions?: string[];
  repliedUser?: string;
  referenceAuthor?: string;
}): Message {
  const hasRef = over.repliedUser !== undefined || over.referenceAuthor !== undefined;
  return {
    id: "222",
    channelId: over.channelId ?? CHANNEL,
    author: { id: over.authorId ?? "333" },
    mentions: {
      users: new Map((over.mentions ?? []).map((id) => [id, {}])),
      repliedUser: over.repliedUser ? { id: over.repliedUser } : null,
    },
    reference: hasRef ? { messageId: "111" } : null,
    fetchReference: async () => ({ author: { id: over.referenceAuthor ?? "444" } }),
  } as unknown as Message;
}

function opts(channels: string[] = [CHANNEL]) {
  return wakeRelayOptionsFromEnv({
    GROK_WAKE_WEBHOOK_URL: "https://example.invalid/hook",
    GROK_WAKE_WEBHOOK_AUTH: "Bearer test",
    GROK_WAKE_CHANNELS: channels.join(","),
  });
}

function okFetch() {
  return mock(async () => new Response(null, { status: 200 })) as unknown as typeof fetch & {
    mock: { calls: unknown[][] };
  };
}

describe("wake relay", () => {
  it("is a no-op when the URL is unset", async () => {
    const f = okFetch();
    const o = wakeRelayOptionsFromEnv({});
    expect(await handleMessage(o, fakeMessage({ mentions: [TARGET] }), f)).toBe(false);
    expect(f.mock.calls.length).toBe(0);
  });

  it("posts on a mention with the expected body and auth header", async () => {
    const f = okFetch();
    expect(await handleMessage(opts(), fakeMessage({ mentions: [TARGET] }), f)).toBe(true);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.invalid/hook");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test");
    expect(JSON.parse(init.body as string)).toEqual({
      channel_id: CHANNEL,
      message_id: "222",
      source: "baymax",
    });
  });

  it("posts on a reply to the target (pinged or fetched)", async () => {
    const f = okFetch();
    expect(await handleMessage(opts(), fakeMessage({ repliedUser: TARGET }), f)).toBe(true);
    expect(await handleMessage(opts(), fakeMessage({ referenceAuthor: TARGET }), f)).toBe(true);
    expect(f.mock.calls.length).toBe(2);
  });

  it("ignores other channels, unrelated messages, and the target's own messages", async () => {
    const f = okFetch();
    expect(
      await handleMessage(opts(), fakeMessage({ channelId: "999", mentions: [TARGET] }), f),
    ).toBe(false);
    expect(await handleMessage(opts(), fakeMessage({ mentions: ["555"] }), f)).toBe(false);
    expect(
      await handleMessage(opts(), fakeMessage({ authorId: TARGET, mentions: [TARGET] }), f),
    ).toBe(false);
    expect(f.mock.calls.length).toBe(0);
  });

  it("relays from every channel when the allowlist is empty", async () => {
    const f = okFetch();
    expect(
      await handleMessage(opts([]), fakeMessage({ channelId: "999", mentions: [TARGET] }), f),
    ).toBe(true);
  });

  it("swallows webhook failures", async () => {
    const f = mock(async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    expect(await handleMessage(opts(), fakeMessage({ mentions: [TARGET] }), f)).toBe(true);
  });
});
