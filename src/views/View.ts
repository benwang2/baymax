import {
  type ActionRowBuilder,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type InteractionResponse,
  type MessageActionRowComponentBuilder,
  type MessageComponentInteraction,
  MessageFlags,
} from "discord.js";

/**
 * Abstract base class for a component-driven view rendered as an ephemeral
 * reply to a chat input command.
 *
 * Subclasses implement:
 *  - `getPayload()` – build the embed + action rows that make up the view.
 *  - `handleInteraction()` – process each component interaction (select menu
 *    changes, button clicks, …) and signal when the view is done.
 *
 * The view is rendered by calling `render(interaction)`. It collects
 * component interactions via the `InteractionResponse` in a loop until
 * `handleInteraction` returns `{ done: true }` or the timeout expires.
 */
export abstract class View {
  /** Maximum time (ms) to wait for a component interaction. */
  protected readonly timeout = 120_000;

  /**
   * Build the message payload (embeds + components) that represents the
   * current state of the view.
   */
  abstract getPayload(): {
    embeds: EmbedBuilder[];
    components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
  };

  /**
   * Process a single component interaction from the view's message.
   *
   * @returns `{ done: false }` to keep collecting interactions (the view
   *          stays open), or `{ done: true }` to finalise the view.
   */
  protected abstract handleInteraction(
    interaction: MessageComponentInteraction,
  ): Promise<{ done: boolean }>;

  /**
   * Render the view as an ephemeral reply to `interaction` and start
   * collecting component interactions.
   *
   * The view remains active until the user completes the flow or the
   * timeout fires, at which point all components are disabled.
   */
  async render(interaction: ChatInputCommandInteraction): Promise<void> {
    const reply = await interaction.reply({
      ...this.getPayload(),
      flags: [MessageFlags.Ephemeral]
    });

    try {
      while (true) {
        const response = await reply.awaitMessageComponent({
          time: this.timeout,
        });
        const { done } = await this.handleInteraction(response);
        if (done) break;
      }
    } catch {
      // Timeout or unexpected error — disable components
      await interaction.editReply({ components: [] }).catch(() => {});
    }
  }
}
