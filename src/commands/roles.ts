import {
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { getGuildConfig } from "../config";

export const data = new SlashCommandBuilder()
  .setName("roles")
  .setDescription("Assign or remove your roles");

/**
 * Handle the /roles slash command.
 * Shows a StringSelectMenu with all configurable roles.
 */
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const guildConfig = getGuildConfig(interaction.guildId);
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

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    selectMenu,
  );

  await interaction.reply({
    components: [row],
    ephemeral: true,
  });
}

/**
 * Handle a StringSelectMenu interaction for role toggling.
 */
export async function handleSelectMenu(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  if (interaction.customId !== "roles_select") return;

  const guildConfig = getGuildConfig(interaction.guildId);
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
