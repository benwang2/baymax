import { REST, Routes } from "discord.js";
import { data as rolesCommandData } from "./commands/roles";
import { getConfig } from "./config";

/**
 * Register slash commands globally via Discord's REST API.
 * Call this once during startup, before logging in the client.
 *
 * Uses DISCORD_TOKEN and DISCORD_CLIENT_ID from the environment.
 */
export async function registerCommands(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token) {
    throw new Error("DISCORD_TOKEN environment variable is not set");
  }
  if (!clientId) {
    throw new Error("DISCORD_CLIENT_ID environment variable is not set");
  }

  const rest = new REST({ version: "10" }).setToken(token);
  const commands = [rolesCommandData.toJSON()];

  // Register per-guild so commands are available instantly during development
  const config = getConfig();
  for (const guild of config.bot.guilds) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guild.guild_id),
        { body: commands },
      );
      console.log(
        `[deployCommands] Registered ${commands.length} command(s) for guild ${guild.guild_id}`,
      );
    } catch (err) {
      console.error(
        `[deployCommands] Failed to register commands for guild ${guild.guild_id}:`,
        err,
      );
    }
  }
}
