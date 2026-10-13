# baymax

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.4.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Optional: Grok wake relay

When `GROK_WAKE_WEBHOOK_URL` is set, Baymax POSTs
`{"channel_id", "message_id", "source": "baymax"}` to that URL for every message
that mentions hayagrov or replies to one of hayagrov's messages. It is
fire-and-forget (10 s timeout, failures only logged) and does nothing when the
URL is unset. Baymax keeps its own `DISCORD_TOKEN`; it needs the Guilds,
GuildMessages and MessageContent intents it already requests.

| Variable | Required | Meaning |
| --- | --- | --- |
| `GROK_WAKE_WEBHOOK_URL` | no | Webhook to POST wakes to. Unset = relay off. |
| `GROK_WAKE_WEBHOOK_AUTH` | no | Full `Authorization` header value, e.g. `Bearer <key>`. |
| `GROK_WAKE_CHANNELS` | no | Comma-separated channel ID allowlist (empty = all channels). |
| `GROK_WAKE_TARGET_USER_ID` | no | User ID that triggers wakes (default `1005664183301459978`, hayagrov). |

Never commit the webhook URL or key; put them in `.env`.
