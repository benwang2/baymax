import { Logger } from "tslog";
import { getConfig, watchConfig } from "./src/config";
import { client, startBot, validateEnvironment } from "./src/bot";

const logger = new Logger({ name: "index" });

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

// 0. Fail fast: required env vars (DISCORD_TOKEN, DISCORD_CLIENT_ID) must be set
validateEnvironment();

// 1. Load initial config (fails fast with a clear message if config.yaml is missing)
const config = getConfig();
logger.info(`Loaded config: ${config.bot.guilds.length} guild(s)`);

// 2. Start file watcher for live config changes
watchConfig();

// 3. Start the bot (connects to Discord gateway, loads decorators, syncs commands)
await startBot();

// 4. Graceful shutdown
process.on("SIGINT", () => {
  client.destroy();
  process.exit(0);
});
process.on("SIGTERM", () => {
  client.destroy();
  process.exit(0);
});
