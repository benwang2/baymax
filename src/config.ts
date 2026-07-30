import { readFileSync, watch } from "node:fs";
import { resolve } from "node:path";
import { load as parseYaml } from "js-yaml";
import { Logger } from "tslog";
import type { BotConfig, GuildConfig } from "./types";

const logger = new Logger({ name: "config" });

const CONFIG_PATH = resolve("config.yaml");

let _config: BotConfig | null = null;
const _listeners = new Set<(config: BotConfig) => void>();

/** Parse and validate raw YAML content into a BotConfig object. */
function parseConfig(raw: string): BotConfig {
  const parsed = parseYaml(raw);

  if (!parsed || typeof parsed !== "object" || !("bot" in parsed)) {
    throw new Error('config.yaml: missing top-level "bot" key');
  }

  const { bot } = parsed as { bot: unknown };

  if (!bot || typeof bot !== "object" || !("guilds" in bot)) {
    throw new Error('config.yaml: missing "bot.guilds" key');
  }

  const guilds = (bot as { guilds: unknown[] }).guilds;

  if (!Array.isArray(guilds)) {
    throw new Error('config.yaml: "bot.guilds" must be an array');
  }

  for (const guild of guilds) {
    if (!guild || typeof guild !== "object") {
      throw new Error("config.yaml: each guild must be an object");
    }

    const g = guild as Record<string, unknown>;

    if (typeof g.guild_id !== "string" || !g.guild_id) {
      throw new Error("config.yaml: each guild must have a non-empty string guild_id");
    }

    if (!g.auto_role || typeof g.auto_role !== "object") {
      throw new Error(`config.yaml: guild ${g.guild_id} is missing "auto_role"`);
    }

    const ar = g.auto_role as Record<string, unknown>;

    if (typeof ar.channel_id !== "string") {
      throw new Error(`config.yaml: guild ${g.guild_id} auto_role.channel_id must be a string`);
    }

    if (typeof ar.message_id !== "string") {
      throw new Error(`config.yaml: guild ${g.guild_id} auto_role.message_id must be a string`);
    }

    if (!Array.isArray(ar.roles)) {
      throw new Error(`config.yaml: guild ${g.guild_id} auto_role.roles must be an array`);
    }

    for (const role of ar.roles) {
      if (!role || typeof role !== "object") {
        throw new Error(
          `config.yaml: guild ${g.guild_id} auto_role.roles: each role must be an object`,
        );
      }

      const r = role as Record<string, unknown>;

      if (typeof r.name !== "string" || !r.name) {
        throw new Error(
          `config.yaml: guild ${g.guild_id} auto_role.roles: each role must have a non-empty "name"`,
        );
      }

      if (typeof r.emoji !== "string" || !r.emoji) {
        throw new Error(
          `config.yaml: guild ${g.guild_id} auto_role.roles: each role must have a non-empty "emoji"`,
        );
      }
    }
  }

  return parsed as BotConfig;
}

/** Read and parse config.yaml from disk. */
export function loadConfig(): BotConfig {
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  _config = parseConfig(raw);
  return _config;
}

/** Get the current (cached) config. Loads from disk if not yet loaded. */
export function getConfig(): BotConfig {
  if (!_config) {
    return loadConfig();
  }
  return _config;
}

/** Register a callback invoked whenever config.yaml changes on disk. */
export function onConfigChange(cb: (config: BotConfig) => void): void {
  _listeners.add(cb);
}

/** Remove a previously registered change listener. */
export function offConfigChange(cb: (config: BotConfig) => void): void {
  _listeners.delete(cb);
}

/**
 * Parse the DISCORD_TEST_GUILDS environment variable into an array of guild IDs.
 * Returns an empty array when the variable is unset or empty (i.e. production mode).
 */
export function getTestGuilds(): string[] {
  const raw = process.env.DISCORD_TEST_GUILDS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/** Find the GuildConfig for a given Discord guild ID. Returns undefined if not found. */
export function getGuildConfig(guildId: string): GuildConfig | undefined {
  const config = getConfig();
  return config.bot.guilds.find((g) => g.guild_id === guildId);
}

/**
 * Start watching config.yaml for changes.
 * On every change the file is re-read, re-validated, and all registered
 * listeners are notified with the new config.
 */
export function watchConfig(): void {
  loadConfig();

  watch(CONFIG_PATH, (event) => {
    if (event !== "change") return;

    try {
      const newConfig = loadConfig();
      for (const cb of _listeners) {
        try {
          cb(newConfig);
        } catch (err) {
          logger.error("Config change listener error:", err);
        }
      }
    } catch (err) {
      logger.error("Failed to reload config.yaml:", err);
    }
  });
}
