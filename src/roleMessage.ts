import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dump as stringifyYaml, load as parseYaml } from "js-yaml";
import { type ArgsOf, Discord, On } from "discordx";
import {
  type Client,
  EmbedBuilder,
  Events,
  type Message,
  type MessageReaction,
  type PartialMessage,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from "discord.js";
import { getGuildConfig } from "./config";
import type { BotConfig, GuildConfig } from "./types";

const CONFIG_PATH = resolve("config.yaml");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch a full Message from a Message<boolean> or PartialMessage. */
async function resolveMessageFromReaction(
  msg: Message<boolean> | PartialMessage,
): Promise<Message<true>> {
  return msg.partial ? ((await msg.fetch()) as Message<true>) : (msg as unknown as Message<true>);
}

/** Fetch a full Reaction from a possible partial. */
async function resolveReaction(
  react: MessageReaction | PartialMessageReaction,
): Promise<MessageReaction> {
  return react.partial ? await react.fetch() : (react as MessageReaction);
}

/** Persist changes to config.yaml on disk. */
function writeConfig(config: BotConfig): void {
  const yaml = stringifyYaml(config, { indent: 2 });
  writeFileSync(CONFIG_PATH, yaml, "utf-8");
}

/** Build the role-assignment embed for a guild. */
export function buildEmbed(roles: GuildConfig["auto_role"]["roles"]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("Role Assignment")
    .setDescription("React with an emoji to get the corresponding role.")
    .setColor(0x0099ff);

  for (const role of roles) {
    embed.addFields({
      name: `${role.emoji} ${role.name}`,
      value: `React with ${role.emoji}`,
    });
  }

  return embed;
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Ensure a role-reaction message exists for the given guild.
 *
 * - If `message_id` is already set and the message can be fetched, update it.
 * - Otherwise, send a new message and persist `message_id` + `channel_id`.
 */
export async function ensureRoleMessage(
  client: Client<true>,
  guildConfig: GuildConfig,
): Promise<void> {
  const guild = client.guilds.cache.get(guildConfig.guild_id);
  if (!guild) {
    console.warn(`[ensureRoleMessage] Guild ${guildConfig.guild_id} not found in cache`);
    return;
  }

  const { channel_id, message_id, roles } = guildConfig.auto_role;

  // Try to fetch existing message
  let message: Message<true> | null = null;

  if (message_id && channel_id) {
    try {
      const channel = await guild.channels.fetch(channel_id);
      if (channel?.isTextBased()) {
        const fetched = await channel.messages.fetch(message_id);
        message = fetched as Message<true>;
      }
    } catch {
      // Message not found or channel inaccessible — send a new one
      message = null;
    }
  }

  if (message) {
    // Update existing message
    await updateRoleMessageForMessage(message, guildConfig);
    return;
  }

  // Send a new message
  const targetChannel = channel_id ? await guild.channels.fetch(channel_id) : guild.systemChannel;

  if (!targetChannel?.isTextBased()) {
    console.warn(`[ensureRoleMessage] No suitable channel for guild ${guildConfig.guild_id}`);
    return;
  }

  const embed = buildEmbed(roles);
  message = (await targetChannel.send({ embeds: [embed] })) as Message<true>;

  // Add reactions for each configured role
  for (const role of roles) {
    await message.react(role.emoji);
  }

  // Persist the new message and channel IDs
  const config = parseYaml(readFileSync(CONFIG_PATH, "utf-8")) as BotConfig;
  const stored = config.bot.guilds.find((g) => g.guild_id === guildConfig.guild_id);
  if (stored) {
    stored.auto_role.channel_id = targetChannel.id;
    stored.auto_role.message_id = message.id;
    writeConfig(config);
  }
}

/**
 * Update an existing role-reaction message for a guild.
 * Rebuilds the embed and syncs reactions.
 */
export async function updateRoleMessage(
  client: Client<true>,
  guildConfig: GuildConfig,
): Promise<void> {
  const guild = client.guilds.cache.get(guildConfig.guild_id);
  if (!guild) return;

  const { channel_id, message_id } = guildConfig.auto_role;
  if (!message_id || !channel_id) {
    // No message exists yet — delegate to ensure
    return ensureRoleMessage(client, guildConfig);
  }

  try {
    const channel = await guild.channels.fetch(channel_id);
    if (!channel?.isTextBased()) return;
    const message = (await channel.messages.fetch(message_id)) as Message<true>;
    await updateRoleMessageForMessage(message, guildConfig);
  } catch {
    // Message gone — create a new one
    await ensureRoleMessage(client, guildConfig);
  }
}

/** Internal: update embed + sync reactions on an existing message. */
async function updateRoleMessageForMessage(
  message: Message<true>,
  guildConfig: GuildConfig,
): Promise<void> {
  const { roles } = guildConfig.auto_role;

  // Rebuild and edit embed
  const embed = buildEmbed(roles);
  await message.edit({ embeds: [embed] });

  // Sync reactions: add missing, remove stale
  const currentReactions = message.reactions.cache;
  const configuredEmojis = new Set(roles.map((r) => r.emoji));
  const existingEmojis = new Set(currentReactions.map((r) => r.emoji.name ?? r.emoji.identifier));

  // Add missing reactions
  for (const emoji of configuredEmojis) {
    if (!existingEmojis.has(emoji)) {
      await message.react(emoji);
    }
  }

  // Remove stale reactions
  for (const [_reactionId, reaction] of currentReactions) {
    const emojiName = reaction.emoji.name ?? reaction.emoji.identifier;
    if (!configuredEmojis.has(emojiName)) {
      await reaction.remove();
    }
  }
}

/**
 * Handle a `messageReactionAdd` event.
 * Assigns the corresponding role if the reaction is on a tracked message.
 */
export async function handleReactionAdd(
  rawReaction: MessageReaction | PartialMessageReaction,
  rawUser: User | PartialUser,
): Promise<void> {
  if (rawUser.bot) return;

  const reaction = await resolveReaction(rawReaction);
  const message = await resolveMessageFromReaction(reaction.message);
  const user = rawUser.partial ? await rawUser.fetch() : rawUser;

  const guildConfig = getGuildConfig(message.guildId);
  if (!guildConfig) return;

  // Check if this is our tracked message
  if (message.id !== guildConfig.auto_role.message_id) return;

  const emojiName = reaction.emoji.name ?? reaction.emoji.identifier;
  const roleEntry = guildConfig.auto_role.roles.find((r) => r.emoji === emojiName);
  if (!roleEntry) return; // Unconfigured emoji — ignore

  const guild = message.guild;
  const role = guild.roles.cache.find((r) => r.name.toLowerCase() === roleEntry.name.toLowerCase());
  if (!role) {
    console.warn(`[handleReactionAdd] Role "${roleEntry.name}" not found in guild ${guild.id}`);
    return;
  }

  try {
    const member = await guild.members.fetch(user.id);
    await member.roles.add(role);
  } catch (err) {
    console.error(`[handleReactionAdd] Failed to add role to ${user.id}:`, err);
  }
}

/**
 * Handle a `messageReactionRemove` event.
 * Removes the corresponding role if the reaction is on a tracked message.
 */
export async function handleReactionRemove(
  rawReaction: MessageReaction | PartialMessageReaction,
  rawUser: User | PartialUser,
): Promise<void> {
  if (rawUser.bot) return;

  const reaction = await resolveReaction(rawReaction);
  const message = await resolveMessageFromReaction(reaction.message);
  const user = rawUser.partial ? await rawUser.fetch() : rawUser;

  const guildConfig = getGuildConfig(message.guildId);
  if (!guildConfig) return;

  if (message.id !== guildConfig.auto_role.message_id) return;

  const emojiName = reaction.emoji.name ?? reaction.emoji.identifier;
  const roleEntry = guildConfig.auto_role.roles.find((r) => r.emoji === emojiName);
  if (!roleEntry) return;

  const guild = message.guild;
  const role = guild.roles.cache.find((r) => r.name.toLowerCase() === roleEntry.name.toLowerCase());
  if (!role) return;

  try {
    const member = await guild.members.fetch(user.id);
    await member.roles.remove(role);
  } catch (err) {
    console.error(`[handleReactionRemove] Failed to remove role from ${user.id}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Discordx decorator-based reaction handlers
// ---------------------------------------------------------------------------

/**
 * discordx event class that routes reaction events through `@On` decorators.
 * Discovered automatically by `importx()` during bot startup.
 */
@Discord()
export class RoleReactionHandler {
  @On({ event: Events.MessageReactionAdd })
  async onReactionAdd([reaction, user]: ArgsOf<Events.MessageReactionAdd>): Promise<void> {
    await handleReactionAdd(reaction, user);
  }

  @On({ event: Events.MessageReactionRemove })
  async onReactionRemove([reaction, user]: ArgsOf<Events.MessageReactionRemove>): Promise<void> {
    await handleReactionRemove(reaction, user);
  }
}
