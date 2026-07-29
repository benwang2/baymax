import { describe, expect, it } from "bun:test";
import { loadConfig } from "../config";

/**
 * These tests use the actual config.yaml on disk.
 * For a real project you'd mock the filesystem; here we validate
 * that the parser correctly handles the known-good config format.
 */
describe("config parser", () => {
  it("loads and returns a valid BotConfig", () => {
    const config = loadConfig();
    expect(config).toBeDefined();
    expect(config.bot).toBeDefined();
    expect(Array.isArray(config.bot.guilds)).toBe(true);
  });

  it("each guild has the required auto_role structure", () => {
    const config = loadConfig();
    for (const guild of config.bot.guilds) {
      expect(typeof guild.guild_id).toBe("string");
      expect(guild.guild_id.length).toBeGreaterThan(0);

      expect(typeof guild.auto_role.channel_id).toBe("string");
      expect(typeof guild.auto_role.message_id).toBe("string");
      expect(Array.isArray(guild.auto_role.roles)).toBe(true);

      for (const role of guild.auto_role.roles) {
        expect(typeof role.name).toBe("string");
        expect(role.name.length).toBeGreaterThan(0);
        expect(typeof role.emoji).toBe("string");
        expect(role.emoji.length).toBeGreaterThan(0);
      }
    }
  });

  it("config.yaml contains the expected test guild and roles", () => {
    const config = loadConfig();
    expect(config.bot.guilds.length).toBeGreaterThanOrEqual(1);

    const first = config.bot.guilds[0]!;
    expect(first.guild_id).toBe("123456789012345678");
    expect(first.auto_role.roles.length).toBe(3);

    const roleNames = first.auto_role.roles.map((r) => r.name);
    expect(roleNames).toContain("overwatch");
    expect(roleNames).toContain("valorant");
    expect(roleNames).toContain("league");
  });
});

describe("getGuildConfig", () => {
  it("finds a guild by ID", async () => {
    const { getGuildConfig } = await import("../config");
    const gc = getGuildConfig("123456789012345678");
    expect(gc).toBeDefined();
    expect(gc!.guild_id).toBe("123456789012345678");
  });

  it("returns undefined for an unknown guild ID", async () => {
    const { getGuildConfig } = await import("../config");
    const gc = getGuildConfig("nonexistent");
    expect(gc).toBeUndefined();
  });
});
