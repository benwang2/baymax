import {
  type ChatInputCommandInteraction,
  Client,
  GatewayIntentBits,
  type StringSelectMenuInteraction,
  Partials,
} from "discord.js";
import { getConfig, onConfigChange, watchConfig } from "./config";
import {
  ensureRoleMessage,
  handleReactionAdd,
  handleReactionRemove,
  updateRoleMessage,
} from "./roleMessage";
import {
  data as rolesCommandData,
  execute as executeRoles,
  handleSelectMenu as handleRolesSelectMenu,
} from "./commands/roles";

/** The singleton Discord client instance. */
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

client.once("ready", async () => {
  console.log(`Logged in as ${client.user!.tag}`);

  // Ensure role-reaction messages for all configured guilds
  const config = getConfig();
  for (const guildConfig of config.bot.guilds) {
    try {
      await ensureRoleMessage(client, guildConfig);
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
      updateRoleMessage(client, guildConfig).catch((err) => {
        console.error(
          `[bot/configChange] Failed to update role message for guild ${guildConfig.guild_id}:`,
          err,
        );
      });
    }
  });
});

client.on("messageReactionAdd", async (reaction, user) => {
  await handleReactionAdd(reaction, user);
});

client.on("messageReactionRemove", async (reaction, user) => {
  await handleReactionRemove(reaction, user);
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "roles") {
    await executeRoles(interaction as ChatInputCommandInteraction);
  } else if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "roles_select"
  ) {
    await handleRolesSelectMenu(interaction as StringSelectMenuInteraction);
  }
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Log in to Discord and start the bot.
 * The DISCORD_TOKEN environment variable must be set.
 */
export async function startBot(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error("DISCORD_TOKEN environment variable is not set");
  }
  await client.login(token);
}
