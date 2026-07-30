import { Logger } from "tslog";
import {
  ActionRowBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type MessageActionRowComponentBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";
import { Discord, SelectMenuComponent, Slash } from "discordx";
import { getGuildConfig } from "../config";

const logger = new Logger({ name: "roles" });

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

    // Determine which roles the member already has
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    const memberRoleNames = new Set(
      member?.roles.cache.map((r) => r.name.toLowerCase()) ?? [],
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("roles_select")
      .setPlaceholder("Select your roles...")
      .setMinValues(0)
      .setMaxValues(roles.length)
      .addOptions(
        roles.map((role) => {
          const hasRole = memberRoleNames.has(role.name.toLowerCase());
          return new StringSelectMenuOptionBuilder()
            .setLabel(role.name.charAt(0).toUpperCase() + role.name.slice(1))
            .setValue(role.name)
            .setEmoji(role.emoji)
            .setDefault(hasRole);
        }),
      );

    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu);

    await interaction.reply({
      components: [row],
      flags: [
        MessageFlags.Ephemeral, // Ensure the reply is only visible to the user
      ]
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

    const { roles } = guildConfig.auto_role;

    const selectedNames = new Set(interaction.values.map((v) => v.toLowerCase()));
    const added: string[] = [];
    const removed: string[] = [];

    try {
      const member = await interaction.guild!.members.fetch(interaction.user.id);

      for (const roleConfig of roles) {
        const role = interaction.guild?.roles.cache.find(
          (r) => r.name.toLowerCase() === roleConfig.name.toLowerCase(),
        );
        if (!role) continue;

        const isSelected = selectedNames.has(roleConfig.name.toLowerCase());
        const hasRole = member.roles.cache.has(role.id);

        if (isSelected && !hasRole) {
          await member.roles.add(role);
          added.push(roleConfig.name);
        } else if (!isSelected && hasRole) {
          await member.roles.remove(role);
          removed.push(roleConfig.name);
        }
      }

      const parts: string[] = [];
      if (added.length > 0) {
        parts.push(`✅ Added: ${added.map((n) => `**${n}**`).join(", ")}`);
      }
      if (removed.length > 0) {
        parts.push(`❌ Removed: ${removed.map((n) => `**${n}**`).join(", ")}`);
      }
      if (parts.length === 0) {
        parts.push("No changes made.");
      }

      await interaction.update({
        content: parts.join("\n"),
        components: [],
      });
    } catch (err) {
      logger.error("[roles/handleSelectMenu] Error:", err);
      await interaction.update({
        content: "An error occurred while updating your roles.",
        components: [],
      });
    }
  }
}
