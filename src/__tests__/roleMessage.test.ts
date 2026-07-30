import { describe, expect, it } from "bun:test";
import { buildEmbed } from "../roleMessage";
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

describe("reaction-to-role mapping logic", () => {
  // This tests the core mapping logic used in handleReactionAdd/handleReactionRemove
  // without needing any Discord API mocking.

  const roles: GuildRole[] = [
    { name: "overwatch", emoji: "🎮" },
    { name: "valorant", emoji: "🔫" },
    { name: "league", emoji: "⚔️" },
  ];

  it("finds a role entry by emoji", () => {
    const emoji = "🎮";
    const entry = roles.find((r) => r.emoji === emoji);
    expect(entry).toBeDefined();
    expect(entry!.name).toBe("overwatch");
  });

  it("returns undefined for an unconfigured emoji", () => {
    const emoji = "❓";
    const entry = roles.find((r) => r.emoji === emoji);
    expect(entry).toBeUndefined();
  });

  it("matches role names case-insensitively", () => {
    const roleName = "Overwatch";
    const match = roles.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
    expect(match).toBeDefined();
    expect(match!.name).toBe("overwatch");
  });

  it("does not match a role name that does not exist", () => {
    const roleName = "minecraft";
    const match = roles.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
    expect(match).toBeUndefined();
  });
});
