import { beforeEach, describe, expect, it, jest, mock } from "bun:test";
import type { GuildConfig } from "../../types";
import { MessageFlags } from "discord.js";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockGuildConfig: GuildConfig = {
  guild_id: "123456789012345678",
  auto_role: {
    channel_id: "987654321098765432",
    message_id: "111111111111111111",
    roles: [
      { name: "overwatch", emoji: "🎮" },
      { name: "valorant", emoji: "🔫" },
      { name: "league", emoji: "⚔️" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Mock the config module
// ---------------------------------------------------------------------------

mock.module("../../config", () => ({
  getGuildConfig: (guildId: string) => {
    if (guildId === "123456789012345678") return mockGuildConfig;
    return undefined;
  },
}));

// ---------------------------------------------------------------------------
// Mock the RolesView module so we can verify it's called without exercising
// the full discord.js-collector path in unit tests.
// ---------------------------------------------------------------------------

const mockRender = jest.fn();
mock.module("../../views/RolesView", () => ({
  RolesView: jest.fn().mockImplementation(() => ({
    render: mockRender,
  })),
}));

// ---------------------------------------------------------------------------
// Helper: build a minimal mock interaction
// ---------------------------------------------------------------------------

function mockChatInputInteraction(overrides: Record<string, unknown> = {}) {
  const member = {
    id: "user_123",
    roles: {
      cache: new Map(),
    },
    guild: {
      roles: {
        cache: new Map(),
      },
    },
  };

  return {
    guildId: "123456789012345678",
    user: { id: "user_123" },
    reply: jest.fn(),
    guild: {
      members: {
        fetch: async () => member,
      },
    },
    ...overrides,
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/roles command — execute", () => {
  beforeEach(() => {
    mockRender.mockReset();
  });

  it("renders a RolesView when the guild has config", async () => {
    const { RolesCommand } = await import("../../commands/roles");
    const cmd = new RolesCommand();
    const interaction = mockChatInputInteraction();
    await cmd.execute(interaction);

    expect(mockRender).toHaveBeenCalledTimes(1);
    expect(mockRender).toHaveBeenCalledWith(interaction);
  });

  it("replies with a not-configured message when guild has no config", async () => {
    const { RolesCommand } = await import("../../commands/roles");
    const cmd = new RolesCommand();
    const interaction = mockChatInputInteraction({ guildId: "unknown" });
    await cmd.execute(interaction);

    expect(mockRender).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "No roles configured for this server.",
      flags: [MessageFlags.Ephemeral],
    });
  });

  it("replies with server-only message when guildId is missing", async () => {
    const { RolesCommand } = await import("../../commands/roles");
    const cmd = new RolesCommand();
    const interaction = mockChatInputInteraction({ guildId: null });
    await cmd.execute(interaction);

    expect(mockRender).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "This command can only be used in a server.",
      flags: [MessageFlags.Ephemeral],
    });
  });
});
