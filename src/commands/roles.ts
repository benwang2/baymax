import {
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import { Discord, Slash } from "discordx";
import { getGuildConfig } from "../config";
import { RolesView } from "../views/RolesView";

@Discord()
export class RolesCommand {
  @Slash({ description: "Assign or remove your roles", name: "roles" })
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    const guildConfig = getGuildConfig(guildId);
    if (!guildConfig) {
      await interaction.reply({
        content: "No roles configured for this server.",
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    const { roles } = guildConfig.auto_role;

    if (roles.length === 0) {
      await interaction.reply({
        content: "No roles are available to assign.",
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    const member = await interaction.guild?.members.fetch(interaction.user.id);
    if (!member) {
      await interaction.reply({
        content: "Could not find your member data.",
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    const view = new RolesView(member, guildId);
    await view.render(interaction);
  }
}
