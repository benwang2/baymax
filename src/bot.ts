import { dirname, importx } from "@discordx/importer";
import { Events, IntentsBitField, Partials } from "discord.js";
import { Client } from "discordx";
import { getConfig, onConfigChange } from "./config";
import { ensureRoleMessage, updateRoleMessage } from "./roleMessage";

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
  console.log(`Logged in as ${client.user!.tag}`);

  // Sync slash commands with Discord
  await client.initApplicationCommands();

  // Ensure role-reaction messages for all configured guilds
  const config = getConfig();
  for (const guildConfig of config.bot.guilds) {
    try {
      await ensureRoleMessage(client as unknown as import("discord.js").Client<true>, guildConfig);
    } catch (err) {
      console.error(
        `[bot/ready] Failed to ensure role message for guild ${guildConfig.guild_id}:`,
        err,
      );
    }
  }

  // Live-reload on config changes
  onConfigChange((newConfig) => {
    for (const guildConfig of newConfig.bot.guilds) {
      updateRoleMessage(client as unknown as import("discord.js").Client<true>, guildConfig).catch((err) => {
        console.error(
          `[bot/configChange] Failed to update role message for guild ${guildConfig.guild_id}:`,
          err,
        );
      });
    }
  });
});

// Route interactions (@Slash, @SelectMenuComponent, etc.)
client.on(Events.InteractionCreate, (interaction) => {
  client.executeInteraction(interaction);
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Load decorated modules via importx, log in to Discord, and start the bot.
 * The DISCORD_TOKEN environment variable must be set.
 */
export async function startBot(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error("DISCORD_TOKEN environment variable is not set");
  }

  // Dynamically import all decorated classes (commands, events, etc.)
  await importx(`${dirname(import.meta.url)}/{commands,__tests__}/**/*.{js,ts}`);

  await client.login(token);
}
