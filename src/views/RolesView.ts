import { Logger } from "tslog";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type GuildMember,
  type MessageActionRowComponentBuilder,
  type MessageComponentInteraction,
} from "discord.js";
import { getGuildConfig } from "../config";
import { View } from "./View";

const logger = new Logger({ name: "RolesView" });

/**
 * A component-driven view for the `/roles` command that lets a member
 * select their desired roles via a string select menu, then confirm or
 * cancel with action buttons.
 *
 * The view is rendered as an ephemeral reply and stays open until the
 * user clicks **Confirm** or **Cancel**, or the 2-minute timeout expires.
 */
export class RolesView extends View {
  /** Currently selected role names (lowercased). */
  private selected = new Set<string>();

  /** The configured role specs for this guild. */
  private readonly roles: { name: string; emoji: string }[];

  constructor(
    private readonly member: GuildMember,
    guildId: string,
  ) {
    super();
    const guildConfig = getGuildConfig(guildId);
    this.roles = guildConfig?.auto_role.roles ?? [];

    // Seed selection with roles the member already has
    for (const roleConfig of this.roles) {
      const guildRole = member.guild.roles.cache.find(
        (r) => r.name.toLowerCase() === roleConfig.name.toLowerCase(),
      );
      if (guildRole && member.roles.cache.has(guildRole.id)) {
        this.selected.add(roleConfig.name.toLowerCase());
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Payload builder                                                    */
  /* ------------------------------------------------------------------ */

  override getPayload() {
    const embed = new EmbedBuilder()
      .setTitle("Role Assignment")
      .setDescription(
        "Use the dropdown below to select the roles you want. " +
          "Then press **Confirm** to apply the changes or **Cancel** to abort.",
      )
      .setColor(0x0099ff);

    if (this.roles.length > 0) {
      embed.addFields(
        this.roles.map((role) => {
          return {
            name: `${role.emoji} ${role.name.charAt(0).toUpperCase() + role.name.slice(1)}`,
            value: "",
            inline: true,
          };
        }),
      );
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("roles_select")
      .setPlaceholder("Select your roles…")
      .setMinValues(0)
      .setMaxValues(this.roles.length)
      .addOptions(
        this.roles.map((role) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(role.name.charAt(0).toUpperCase() + role.name.slice(1))
            .setValue(role.name)
            .setEmoji(role.emoji)
            .setDefault(this.selected.has(role.name.toLowerCase())),
        ),
      );

    const confirmButton = new ButtonBuilder()
      .setCustomId("roles_confirm")
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId("roles_cancel")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger);

    const selectRow =
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(selectMenu);
    const buttonRow =
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        confirmButton,
        cancelButton,
      );

    return {
      embeds: [embed],
      components: [selectRow, buttonRow],
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Interaction handling                                               */
  /* ------------------------------------------------------------------ */

  override async handleInteraction(
    interaction: MessageComponentInteraction,
  ): Promise<{ done: boolean }> {
    // ── Select menu changed ──────────────────────────────────────────
    if (interaction.isAnySelectMenu() && interaction.customId === "roles_select") {
      this.selected = new Set(interaction.values.map((v) => v.toLowerCase()));
      await interaction.update(this.getPayload());
      return { done: false };
    }

    // ── Confirm button ───────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === "roles_confirm") {
      await this.applyChanges(interaction);
      return { done: true };
    }

    // ── Cancel button ────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === "roles_cancel") {
      await interaction.update({
        content: "❌ Role selection cancelled.",
        embeds: [],
        components: [],
      });
      return { done: true };
    }

    return { done: false };
  }

  /* ------------------------------------------------------------------ */
  /*  Role application                                                   */
  /* ------------------------------------------------------------------ */

  private async applyChanges(interaction: MessageComponentInteraction): Promise<void> {
    const added: string[] = [];
    const removed: string[] = [];

    try {
      const member = await this.member.guild.members.fetch(this.member.id);
      const guildRoles = member.guild.roles.cache;

      for (const roleConfig of this.roles) {
        const guildRole = guildRoles.find(
          (r) => r.name.toLowerCase() === roleConfig.name.toLowerCase(),
        );
        if (!guildRole) continue;

        const isSelected = this.selected.has(roleConfig.name.toLowerCase());
        const hasRole = member.roles.cache.has(guildRole.id);

        if (isSelected && !hasRole) {
          await member.roles.add(guildRole);
          added.push(roleConfig.name);
        } else if (!isSelected && hasRole) {
          await member.roles.remove(guildRole);
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
        embeds: [],
        components: [],
      });
    } catch (err) {
      logger.error("[RolesView/applyChanges] Error:", err);
      await interaction.update({
        content: "An error occurred while updating your roles.",
        embeds: [],
        components: [],
      });
    }
  }
}
