import {InteractionLike} from './interactionlike';
import {
  Guild,
  GuildMember,
  Message,
  TextChannel,
  User,
  Client,
} from 'discord.js';

export class MessageWrappedInteraction implements InteractionLike {
  client: Client;
  createdAt: Date;
  createdTimestamp: number;
  deferred: boolean;
  replied: boolean;
  channel: TextChannel;
  channelId: string;
  guild: Guild;
  guildId: string;
  user: User;
  member: GuildMember;

  private _message: Message;
  private _lastMessage: Message | undefined;

  /**
   * Wrap a message and pretend to be an "interaction"
   * @param message The message to wrap
   */
  constructor(message: Message) {
    this._message = message;

    // Set attributes
    this.client = message.client;
    this.createdAt = message.createdAt;
    this.createdTimestamp = message.createdTimestamp;
    this.deferred = false;
    this.replied = false;
    this.channel = message.channel as TextChannel;
    this.channelId = message.channelId;
    this.guild = message.guild!;
    this.guildId = message.guildId!;

    this.user = message.author;
    this.member = message.member!;
  }

  async reply(options?: any) {
    this.replied = true;
    this._lastMessage = await this._message.reply(options);
  }

  async deferReply(options?: any) {
    this.deferred = true;
    this._lastMessage = await this._message.reply({
      content: `${this.client.user?.username} is thinking...`,
      ...options,
    });
  }

  async editReply(options?: any) {
    this.replied = true;
    if (this._lastMessage) {
      await this._lastMessage.edit(options);
    }
  }

  async followUp(options?: any) {
    if (this._lastMessage) {
      if (this.deferred) {
        await this._lastMessage.edit(options);
      } else {
        await this._lastMessage.reply(options);
      }
    } else {
      this._lastMessage = await this._message.channel.send({
        reply: {
          messageReference: this._message,
        },
        ...options,
      });
    }
  }

  async deleteReply() {
    if (this._lastMessage) {
      await this._lastMessage.delete();
      this._lastMessage = undefined;
    }
  }
}
