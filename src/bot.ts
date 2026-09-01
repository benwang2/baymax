import { Logger } from "tslog";
import { dirname, importx } from "@discordx/importer";
import { Events, IntentsBitField, Partials } from "discord.js";
import { Client } from "discordx";
import { getConfig, getTestGuilds, onConfigChange } from "./config";
import { ensureRoleMessage, updateRoleMessage } from "./roleMessage";

const logger = new Logger({ name: "bot" });

/** The singleton Discord client instance (discordx extended client). */
export const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  silent: false,
});

// ---------------------------------------------------------------------------
// Event wiring (discordx routing)
// ---------------------------------------------------------------------------

client.once(Events.ClientReady, async () => {
  logger.info(`Logged in as ${client.user!.tag}`);

  // If test guilds are configured, restrict command registration to those
  // guilds for fast propagation (vs. up to an hour for global commands).
  const testGuilds = getTestGuilds();
  if (testGuilds.length > 0) {
    client.botGuilds = testGuilds;
    logger.info(`Registering commands for test guilds: ${testGuilds.join(", ")}`);
  }

  // Sync slash commands with Discord
  await client.initApplicationCommands();

  // Ensure role-reaction messages for all configured guilds
  const config = getConfig();
  for (const guildConfig of config.bot.guilds) {
    try {
      await ensureRoleMessage(client as unknown as import("discord.js").Client<true>, guildConfig);
    } catch (err) {
      logger.error(
        `[bot/ready] Failed to ensure role message for guild ${guildConfig.guild_id}:`,
        err,
      );
    }
  }

  // Live-reload on config changes
  onConfigChange((newConfig) => {
    for (const guildConfig of newConfig.bot.guilds) {
      updateRoleMessage(client as unknown as import("discord.js").Client<true>, guildConfig).catch(
        (err) => {
          logger.error(
            `[bot/configChange] Failed to update role message for guild ${guildConfig.guild_id}:`,
            err,
          );
        },
      );
    }
  });
});

// Route interactions: let discordx handle commands (@Slash, @ContextMenu),
// while component interactions (select menus, buttons) are handled by
// View subclasses via their own collectors (awaitMessageComponent).
client.on(Events.InteractionCreate, (interaction) => {
  if (interaction.isCommand() || interaction.isContextMenuCommand()) {
    client.executeInteraction(interaction);
  }
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Validate required environment variables, failing fast with a clear,
 * actionable error on the first missing or blank value.
 */
export function validateEnvironment(): void {
  const token = process.env.DISCORD_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "DISCORD_TOKEN is not set. Add your bot token to .env or the environment " +
        "(https://discord.com/developers/applications).",
    );
  }

  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error(
      "DISCORD_CLIENT_ID is not set. Add your bot's Application (Client) ID to " +
        ".env or the environment (https://discord.com/developers/applications).",
    );
  }
}

/**
 * Load decorated modules via importx, log in to Discord, and start the bot.
 * Requires DISCORD_TOKEN and DISCORD_CLIENT_ID to be set (see validateEnvironment).
 */
export async function startBot(): Promise<void> {
  validateEnvironment();

  const token = process.env.DISCORD_TOKEN!;

  // Dynamically import all decorated classes (commands, events, etc.)
  await importx(`${dirname(import.meta.url)}/commands/**/*.{js,ts}`);

  await client.login(token);
}
