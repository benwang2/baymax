import { getConfig, watchConfig } from "./src/config";
import { client, startBot } from "./src/bot";
import { registerCommands } from "./src/deployCommands";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

// 1. Load initial config
const config = getConfig();
console.log(`Loaded config: ${config.bot.guilds.length} guild(s)`);

// 2. Start file watcher for live config changes
watchConfig();

// 3. Register slash commands with Discord
await registerCommands();

// 4. Start the bot (connects to Discord gateway)
await startBot();

// 5. Graceful shutdown
process.on("SIGINT", () => {
  client.destroy();
  process.exit(0);
});
process.on("SIGTERM", () => {
  client.destroy();
  process.exit(0);
});