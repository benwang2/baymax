import { describe, expect, it } from "bun:test";
import { buildEmbed, emojiKey, findRoleByEmoji } from "../roleMessage";
import type { GuildRole } from "../types";

describe("buildEmbed", () => {
  it("creates an embed with correct title and description", () => {
    const roles: GuildRole[] = [{ name: "overwatch", emoji: "🎮" }];
    const embed = buildEmbed(roles);
    const data = embed.data;

    expect(data.title).toBe("Role Assignment");
    expect(data.description).toBe("React with an emoji to get the corresponding role.");
    expect(data.color).toBe(0x0099ff);
  });

  it("adds a field for each role", () => {
    const roles: GuildRole[] = [
      { name: "overwatch", emoji: "🎮" },
      { name: "valorant", emoji: "🔫" },
      { name: "league", emoji: "⚔️" },
    ];
    const embed = buildEmbed(roles);
    const fields = embed.data.fields!;

    expect(fields).toHaveLength(3);
    expect(fields[0]!.name).toBe("🎮 overwatch");
    expect(fields[0]!.value).toBe("React with 🎮");
    expect(fields[1]!.name).toBe("🔫 valorant");
    expect(fields[1]!.value).toBe("React with 🔫");
    expect(fields[2]!.name).toBe("⚔️ league");
    expect(fields[2]!.value).toBe("React with ⚔️");
  });

  it("handles a single role", () => {
    const roles: GuildRole[] = [{ name: "minecraft", emoji: "⛏️" }];
    const embed = buildEmbed(roles);
    expect(embed.data.fields).toHaveLength(1);
    expect(embed.data.fields![0]!.name).toBe("⛏️ minecraft");
  });

  it("handles an empty roles array", () => {
    const embed = buildEmbed([]);
    expect(embed.data.fields?.length ?? 0).toBe(0);
  });
});

describe("emojiKey", () => {
  it("keys unicode emojis by their codepoint", () => {
    expect(emojiKey("🎮")).toBe("🎮");
  });

  it("extracts the snowflake ID from a markdown custom emoji", () => {
    expect(emojiKey("<:gun:123456789012345678>")).toBe("123456789012345678");
  });

  it("extracts the snowflake ID from an animated markdown custom emoji", () => {
    expect(emojiKey("<a:spin:123456789012345678>")).toBe("123456789012345678");
  });

  it("extracts the snowflake ID from a name:id identifier", () => {
    expect(emojiKey("gun:123456789012345678")).toBe("123456789012345678");
  });

  it("accepts a bare snowflake ID", () => {
    expect(emojiKey("123456789012345678")).toBe("123456789012345678");
  });

  it("keys a reaction emoji object by id for custom, name for unicode", () => {
    expect(emojiKey({ id: "123456789012345678", name: "gun" })).toBe("123456789012345678");
    expect(emojiKey({ id: null, name: "🔫" })).toBe("🔫");
  });

  it("returns null for an empty string", () => {
    expect(emojiKey("")).toBeNull();
    expect(emojiKey("   ")).toBeNull();
  });
});

describe("reaction-to-role mapping logic", () => {
  // This tests the real mapping logic used in handleReactionAdd/handleReactionRemove
  // without needing any Discord API mocking.

  const roles: GuildRole[] = [
    { name: "overwatch", emoji: "🎮" },
    { name: "valorant", emoji: "🔫" },
    { name: "league", emoji: "⚔️" },
    { name: "cs", emoji: "<:cs:123456789012345678>" },
  ];

  it("finds a unicode role entry by its codepoint", () => {
    const entry = findRoleByEmoji(roles, { id: null, name: "🎮" });
    expect(entry).toBeDefined();
    expect(entry!.name).toBe("overwatch");
  });

  it("finds a custom-emoji role by its snowflake ID", () => {
    // A reaction on a custom emoji exposes only name + id — the name alone
    // ("cs") must not be compared against the config's markdown form.
    const entry = findRoleByEmoji(roles, { id: "123456789012345678", name: "cs" });
    expect(entry).toBeDefined();
    expect(entry!.name).toBe("cs");
  });

  it("does not confuse custom emojis that share a name but differ by id", () => {
    const entry = findRoleByEmoji(roles, { id: "999999999999999999", name: "cs" });
    expect(entry).toBeUndefined();
  });

  it("returns undefined for an unconfigured emoji", () => {
    const entry = findRoleByEmoji(roles, { id: null, name: "❓" });
    expect(entry).toBeUndefined();
  });
});
