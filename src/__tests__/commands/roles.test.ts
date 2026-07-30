import { describe, expect, it, jest, mock } from "bun:test";
import type { GuildConfig } from "../../types";

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
// Helper: build a minimal mock interaction
// ---------------------------------------------------------------------------

function mockChatInputInteraction(overrides: Record<string, unknown> = {}) {
  return {
    guildId: "123456789012345678",
    reply: jest.fn(),
    ...overrides,
  } as any;
}

/** Create a mock Collection-like cache that supports .find() */
function mockRoleCache(entries: [string, { id: string; name: string }][]) {
  const map = new Map(entries);
  return Object.assign(map, {
    find: function (fn: (r: { id: string; name: string }) => boolean) {
      for (const [, role] of map) {
        if (fn(role)) return role;
      }
      return undefined;
    },
  });
}

function mockStringSelectInteraction(overrides: Record<string, unknown> = {}) {
  return {
    guildId: "123456789012345678",
    customId: "roles_select",
    values: ["overwatch"],
    user: { id: "user_123" },
    update: jest.fn(),
    guild: {
      roles: {
        cache: mockRoleCache([
          ["role_overwatch_id", { id: "role_overwatch_id", name: "overwatch" }],
          ["role_valorant_id", { id: "role_valorant_id", name: "valorant" }],
        ]),
      },
      members: {
        fetch: async () => ({
          roles: {
            cache: new Map(),
            has: () => false,
            add: jest.fn(),
            remove: jest.fn(),
          },
        }),
      },
    },
    ...overrides,
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("/roles command — execute", () => {
  it("replies with a StringSelectMenu when guild has config", async () => {
    const { RolesCommand } = await import("../../commands/roles");
    const cmd = new RolesCommand();
    const interaction = mockChatInputInteraction();
    await cmd.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledTimes(1);
    const callArgs = interaction.reply.mock.calls[0][0];
    expect(callArgs.ephemeral).toBe(true);
    expect(callArgs.components).toBeDefined();
    expect(callArgs.components.length).toBeGreaterThan(0);
  });

  it("replies with a not-configured message when guild has no config", async () => {
    const { RolesCommand } = await import("../../commands/roles");
    const cmd = new RolesCommand();
    const interaction = mockChatInputInteraction({ guildId: "unknown" });
    await cmd.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: "No roles configured for this server.",
      ephemeral: true,
    });
  });

  it("includes all configured roles as select menu options", async () => {
    const { RolesCommand } = await import("../../commands/roles");
    const cmd = new RolesCommand();
    const interaction = mockChatInputInteraction();
    await cmd.execute(interaction);

    const callArgs = interaction.reply.mock.calls[0][0];
    const row = callArgs.components[0];
    const selectMenu = row.components[0];

    expect(selectMenu.options).toHaveLength(3);
    expect(selectMenu.options[0]!.data).toMatchObject({
      label: "Overwatch",
      value: "overwatch",
    });
    expect(selectMenu.options[1]!.data).toMatchObject({
      label: "Valorant",
      value: "valorant",
    });
    expect(selectMenu.options[2]!.data).toMatchObject({
      label: "League",
      value: "league",
    });
  });
});

describe("/roles command — handleSelectMenu", () => {
  it("adds a role the user does not have", async () => {
    const { RolesCommand } = await import("../../commands/roles");
    const cmd = new RolesCommand();
    const interaction = mockStringSelectInteraction();
    await cmd.handleSelectMenu(interaction);

    expect(interaction.update).toHaveBeenCalledWith({
      content: "✅ Added role overwatch",
      components: [],
    });
  });

  it("removes a role the user already has", async () => {
    const { RolesCommand } = await import("../../commands/roles");
    const cmd = new RolesCommand();

    const memberWithRole = {
      roles: {
        cache: new Map([["role_overwatch_id", { id: "role_overwatch_id" }]]),
        has: (id: string) => id === "role_overwatch_id",
        add: jest.fn(),
        remove: jest.fn(),
      },
    };

    const interaction = mockStringSelectInteraction({
      guild: {
        roles: {
          cache: mockRoleCache([
            ["role_overwatch_id", { id: "role_overwatch_id", name: "overwatch" }],
          ]),
        },
        members: {
          fetch: async () => memberWithRole,
        },
      },
    });

    await cmd.handleSelectMenu(interaction);

    expect(interaction.update).toHaveBeenCalledWith({
      content: "❌ Removed role overwatch",
      components: [],
    });
  });

  it("shows an error when the role is not found on the server", async () => {
    const { RolesCommand } = await import("../../commands/roles");
    const cmd = new RolesCommand();

    const interaction = mockStringSelectInteraction({
      guild: {
        roles: {
          cache: mockRoleCache([]),
        },
        members: {
          fetch: async () => ({}),
        },
      },
    });

    await cmd.handleSelectMenu(interaction);

    expect(interaction.update).toHaveBeenCalledWith({
      content: 'Could not find the role "overwatch" on this server.',
      components: [],
    });
  });

  it("shows a not-configured message when guild has no config", async () => {
    const { RolesCommand } = await import("../../commands/roles");
    const cmd = new RolesCommand();

    const interaction = mockStringSelectInteraction({ guildId: "unknown" });
    await cmd.handleSelectMenu(interaction);

    expect(interaction.update).toHaveBeenCalledWith({
      content: "No roles configured for this server.",
      components: [],
    });
  });

  it("shows an error when no role is selected", async () => {
    const { RolesCommand } = await import("../../commands/roles");
    const cmd = new RolesCommand();

    const interaction = mockStringSelectInteraction({ values: [] });
    await cmd.handleSelectMenu(interaction);

    expect(interaction.update).toHaveBeenCalledWith({
      content: "No role selected.",
      components: [],
    });
  });
});
