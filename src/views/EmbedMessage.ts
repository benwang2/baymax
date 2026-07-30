import { Colors, EmbedBuilder } from "discord.js";

export interface EmbedMessageOptions {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string; iconURL?: string };
  timestamp?: Date | number;
  thumbnail?: { url: string };
  image?: { url: string };
  author?: { name: string; iconURL?: string; url?: string };
  url?: string;
}

/**
 * Build a message payload containing a single embed.
 *
 * Intended for interaction-less replies — simple status messages,
 * confirmations, cancellations, and error responses that do not
 * need component interactions.
 *
 * @example
 * ```ts
 * await interaction.update(EmbedMessage.build({
 *   title: "Cancelled",
 *   description: "❌ Role selection cancelled.",
 *   color: 0xff4444,
 * }));
 * ```
 */
export const EmbedMessage = {
  build(options: EmbedMessageOptions) {
    const embed = new EmbedBuilder();

    if (options.title) embed.setTitle(options.title);
    if (options.description) embed.setDescription(options.description);
    if (options.color !== undefined) embed.setColor(options.color);
    if (options.fields && options.fields.length > 0) embed.addFields(options.fields);
    if (options.footer) embed.setFooter(options.footer);
    if (options.timestamp) embed.setTimestamp(options.timestamp);
    if (options.thumbnail) embed.setThumbnail(options.thumbnail.url);
    if (options.image) embed.setImage(options.image.url);
    if (options.author) embed.setAuthor(options.author);
    if (options.url) embed.setURL(options.url);

    return { embeds: [embed] };
  },

  /**
   * Shortcut for a success-style embed (green).
   */
  success(description: string, title?: string) {
    return EmbedMessage.build({
      title,
      description,
      color: Colors.Green,
    });
  },

  /**
   * Shortcut for an error-style embed (red).
   */
  error(description: string, title?: string) {
    return EmbedMessage.build({
      title,
      description,
      color: Colors.Red,
    });
  },

  /**
   * Shortcut for a warning/info-style embed (yellow).
   */
  warn(description: string, title?: string) {
    return EmbedMessage.build({
      title,
      description,
      color: Colors.Yellow,
    });
  },
};
