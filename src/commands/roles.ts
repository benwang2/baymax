import {
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  type MessageActionRowComponentBuilder,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";
import { Discord, SelectMenuComponent, Slash } from "discordx";
import { getGuildConfig } from "../config";

@Discord()
export class RolesCommand {
  @Slash({ description: "Assign or remove your roles", name: "roles" })
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
      return;
    }

    const guildConfig = getGuildConfig(guildId);
    if (!guildConfig) {
      await interaction.reply({
        content: "No roles configured for this server.",
        ephemeral: true,
      });
      return;
    }

    const { roles } = guildConfig.auto_role;

    if (roles.length === 0) {
      await interaction.reply({
        content: "No roles are available to assign.",
        ephemeral: true,
      });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("roles_select")
      .setPlaceholder("Choose a role to toggle...")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        roles.map((role) => ({
          label: role.name.charAt(0).toUpperCase() + role.name.slice(1),
          value: role.name,
          emoji: role.emoji,
        })),
      );

    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu);

    await interaction.reply({
      components: [row],
      ephemeral: true,
    });
  }

  @SelectMenuComponent({ id: "roles_select" })
  async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.update({
        content: "This command can only be used in a server.",
        components: [],
      });
      return;
    }

    const guildConfig = getGuildConfig(guildId);
    if (!guildConfig) {
      await interaction.update({
        content: "No roles configured for this server.",
        components: [],
      });
      return;
    }

    const roleName = interaction.values[0];
    if (!roleName) {
      await interaction.update({
        content: "No role selected.",
        components: [],
      });
      return;
    }

    const role = interaction.guild?.roles.cache.find(
      (r) => r.name.toLowerCase() === roleName.toLowerCase(),
    );
    if (!role) {
      await interaction.update({
        content: `Could not find the role "${roleName}" on this server.`,
        components: [],
      });
      return;
    }

    try {
      const member = await interaction.guild!.members.fetch(interaction.user.id);
      const hasRole = member.roles.cache.has(role.id);

      if (hasRole) {
        await member.roles.remove(role);
        await interaction.update({
          content: `❌ Removed role ${role.name}`,
          components: [],
        });
      } else {
        await member.roles.add(role);
        await interaction.update({
          content: `✅ Added role ${role.name}`,
          components: [],
        });
      }
    } catch (err) {
      console.error("[roles/handleSelectMenu] Error:", err);
      await interaction.update({
        content: "An error occurred while updating your roles.",
        components: [],
      });
    }
  }
}
