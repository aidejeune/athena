import { Client, Guild, GuildChannel, GuildMember, Message, TextChannel, User } from "discord.js";
import { IArgument, IArgumentData, IArguments, IArgumentTypes } from "../command";
import { InteractionLike } from "./interactionlike";
import { ParsingError } from "./interactionparse";

/**
 * Map message function attributes to interactionlike function attributes
 */
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

    _message: Message;
    private _lastMessage: Message;

    /**
     * Wrap a message and pretend to be an "interaction"
     * @param message Message to wrap
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
        this.guild = message.guild;
        this.guildId = message.guildId;

        this.user = message.author;
        this.member = message.member;
    }

    async reply(options?: any) {
        this.replied = true;
        this._lastMessage = await this._message.reply(options);
    }

    async deferReply(options?: any) {
        this.deferred = true;
        this._lastMessage = await this._message.reply({
            content: `${this.client.user.username} est en train de réfléchir...`,
            ...options
        });
    }

    async editReply(options?: any) {
        this.replied = true;
        await this._lastMessage?.edit(options);
    }

    async followUp(options?: any) {
        if (this._lastMessage) {
            if (this.deferred) {
                await this._lastMessage.edit(options);
            } else {
                this._lastMessage = await this._lastMessage.reply(options);
            }
        } else {
            this._lastMessage = await this._message.reply(options);
        }
    }

    async deleteReply() {
        await this._lastMessage?.delete();
        this._lastMessage = undefined;
    }
}


/**
 * Resolve arguments from a usual message using Slash Command argument definitions
 * @param data Argument data as provided by function
 * @returns Argument object
 */
export function resolveArguments<T extends IArgumentData>(data: T, message: Message): IArguments<T> {
    // Does this function even have arguments?
    if (!data) return {};

    // Store resolved data
    const resolved: IArguments<T> = {};

    // Object.getOwnPropertyNames assures property order.
    const items: [string, IArgument][] = Object.getOwnPropertyNames(data).map(k => [k, data[k]])
    let idx = 0;

    // Strip all arguments for parsing
    const strippedArguments = message.content.split(" ").slice(1);
    const collectedArguments = [];
    let finished = false;
    while (!finished) {
        const item = items[idx];
        const name = item[0];
        const arg = item[1];


        let currentArgument = strippedArguments.shift();

        // String can accept ANY value
        const validArgument = getBasicType(currentArgument) === arg.type || arg.type === "STRING" && currentArgument !== undefined;

        if (validArgument) {
            collectedArguments.push(currentArgument);
            if (arg.type === "STRING") {
                // Go until possible. Strings are unrestricted in size
                currentArgument = strippedArguments.shift();
                while (getBasicType(currentArgument) === arg.type) {
                    collectedArguments.push(currentArgument);
                    currentArgument = strippedArguments.shift();
                }

                // Last argument was not valid and not none
                if (currentArgument !== undefined) {
                    strippedArguments.unshift(currentArgument);
                }

                // Add to data
                resolved[name as keyof T] = collectedArguments.join(" ") as any;
            } else {
                try {
                    // Try to resolve value
                    const resolvedValue = resolveFromType(message.channel as GuildChannel, collectedArguments[0], arg.type) as any;

                    if (resolvedValue?.isParsing) {
                        throw resolvedValue;
                    }

                    resolved[name as keyof T] = resolvedValue;
                } catch (e) {
                    // Propogate
                    if (e.isParsing) throw e;
                    throw new ParsingError(`Error resolving value ${collectedArguments[0]} for value \`${name}\` of type ${arg.type}`)
                }
            }
        } else {
            // If value is invalid but this argument is optional, we leave
            if (arg.optional) finished = true;
            else {
                throw new ParsingError(`Invalid value ${currentArgument} for value \`${name}\` of type ${arg.type}`)
            }
        }

        idx++;
        collectedArguments.length = 0;
        if (idx === items.length) finished = true;
    }

    return resolved;
}

// Regexes to match
export const ROLE_REGEX = /<@&([0-9]+?)>/;
export const USER_REGEX = /<@\!?([0-9]+?)>/;
export const CHANNEL_REGEX = /<\#([0-9]+?)>/;
export const NUMBER_REGEX = /\-?[0-9]+?/;
export const BOOLEAN_REGEX = /^yes|no|oui|non|y|n|on|off$/;
export const STRING_REGEX = /.*/;

/**
 * Get basic argument type
 * @param argument Argument
 */
function getBasicType(argument: string): keyof IArgumentTypes {
    if (argument === undefined) return undefined;
    else if (argument.match(ROLE_REGEX)) return "ROLE";
    else if (argument.match(USER_REGEX)) return "USER";
    else if (argument.match(CHANNEL_REGEX)) return "CHANNEL";
    else if (argument.match(NUMBER_REGEX)) return "NUMBER";
    else if (argument.match(BOOLEAN_REGEX)) return "BOOLEAN";
    else if (argument.match(STRING_REGEX)) return "STRING";
}

/**
 * Resolve a value from a given type and raw value
 * @param channel Context to resolve Discord values
 * @param value Value to resolve
 * @param type Type to resolve for
 */
function resolveFromType(channel: GuildChannel, value: string, type: keyof IArgumentTypes) {
    switch (type) {
        case "BOOLEAN":
            return (value.toLowerCase().startsWith("y") || value.toLowerCase() === "oui" || value.toLowerCase() === "on")

        case "CHANNEL":
            return channel.client.channels.cache.get(value.match(CHANNEL_REGEX)[1]) ?? new ParsingError("Channel not found");

        case "ROLE":
            return channel.guild.roles.cache.get(value.match(ROLE_REGEX)[1]) ?? new ParsingError("Role not found");

        case "USER":
            return channel.client.users.cache.get(value.match(USER_REGEX)[1]) ?? new ParsingError("User not found");

        case "NUMBER":
            return parseInt(value, 10);

        case "STRING":
            return value
    }
}