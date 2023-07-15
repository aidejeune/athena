import {
  CommandInteraction,
  InteractionReplyOptions,
  MessagePayload,
  TextBasedChannel,
  WebhookMessageEditOptions,
} from 'discord.js';
/**
 * Abstract class mapping the important behaviour of interactions
 */
export abstract class InteractionLike {
  // Attributes
  client!: typeof CommandInteraction.prototype.client;
  createdAt!: typeof CommandInteraction.prototype.createdAt;
  createdTimestamp!: typeof CommandInteraction.prototype.createdTimestamp;
  deferred!: typeof CommandInteraction.prototype.deferred;
  replied!: typeof CommandInteraction.prototype.replied;
  channel!: typeof CommandInteraction.prototype.channel | TextBasedChannel;
  channelId!: typeof CommandInteraction.prototype.channelId;
  guild!: typeof CommandInteraction.prototype.guild;
  guildId!: typeof CommandInteraction.prototype.guildId;
  user!: typeof CommandInteraction.prototype.user;
  member!: typeof CommandInteraction.prototype.member;

  // Methods
  reply!: (options?: string | InteractionReplyOptions) => Promise<any>;
  deferReply!: (options?: InteractionReplyOptions) => Promise<any>;
  editReply!: (
    options?: string | MessagePayload | WebhookMessageEditOptions
  ) => Promise<any>;
  followUp!: (
    options?: string | MessagePayload | InteractionReplyOptions
  ) => Promise<any>;
  deleteReply!: () => Promise<any>;
}
