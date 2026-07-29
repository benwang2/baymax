/** A single configurable role with its reaction emoji. */
export interface GuildRole {
  name: string;
  emoji: string;
}

/** Auto-role message configuration for a guild. */
export interface AutoRoleConfig {
  channel_id: string;
  message_id: string;
  roles: GuildRole[];
}

/** Per-guild configuration. */
export interface GuildConfig {
  guild_id: string;
  auto_role: AutoRoleConfig;
}

/** Top-level bot configuration matching config.yaml structure. */
export interface BotConfig {
  bot: {
    guilds: GuildConfig[];
  };
}
