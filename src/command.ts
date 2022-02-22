import { SlashCommandBuilder } from "@discordjs/builders";
import { APIInteractionDataResolvedChannel } from "discord-api-types";
import { ApplicationCommandPermissionData, CommandInteraction, GuildChannel, Message, Role, User } from "discord.js";
import { CustomClient } from "./client";
import { getConfig } from "./config";
import { isKeyof } from "./utils";
import { InteractionLike } from "./utils/interactionlike";


export interface IArgument {
    type: keyof IArgumentTypes;
    description: string;
    optional?: boolean;
    choices?: ({label?: string, value: string} | string)[]
}

export interface IArgumentData {
    [name: string]: IArgument
}

export type IArgumentTypes = {
    BOOLEAN: boolean,
    CHANNEL: GuildChannel | APIInteractionDataResolvedChannel,
    NUMBER: number,
    ROLE: Role,
    STRING: string,
    USER: User
}

const getOptionsFunctionForType = (builder: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">, type: keyof IArgumentTypes) => {
    switch (type) {
        case "BOOLEAN": return builder.addBooleanOption;
        case "CHANNEL": return builder.addChannelOption;
        case "NUMBER": return builder.addNumberOption;
        case "ROLE": return builder.addRoleOption;
        case "STRING": return builder.addStringOption;
        case "USER": return builder.addUserOption;
        default: return builder.addStringOption;
    }
}

type GetterType<K extends keyof IArgumentTypes> = (name: string, required?: boolean) => IArgumentTypes[K]
const getGetterForType = <K extends keyof IArgumentTypes>(interaction: CommandInteraction, type: K): GetterType<K> => {
    switch (type) {
        case "BOOLEAN": return interaction.options.getBoolean as GetterType<K>;
        case "CHANNEL": return interaction.options.getChannel as GetterType<K>;
        case "NUMBER": return interaction.options.getNumber as GetterType<K>;
        case "ROLE": return interaction.options.getRole as GetterType<K>;
        case "STRING": return interaction.options.getString as GetterType<K>;
        case "USER": return interaction.options.getUser as GetterType<K>;
        default: return interaction.options.getString as GetterType<K>;
    }
}

export interface ICommandOptions<T extends IArgumentData> {
    name: string;
    aliases?: string[];
    description?: string;
    usage?: string;
    examples?: string[];
    permissionGroup?: string;
    args?: T
};

export type IArguments<T extends IArgumentData> = {
    [K in keyof T]?: IArgumentTypes[T[K]["type"]];
};

// Base type of command functions.
type CommandCallable<T extends IArgumentData> = (client: CustomClient, interaction: InteractionLike, args: IArguments<T>) => any;
export class Command<T extends IArgumentData> {
    raw: CommandCallable<T>;

    // Public options
    name: string;
    aliases?: string[];
    description?: string;
    usage?: string;
    examples?: string[];
    permissionGroup?: string;
    args: IArgumentData;
    private _onload?: (client: CustomClient) => any;
    constructor (raw: CommandCallable<T>, options: ICommandOptions<T>) {
        this.raw = raw;
        this.name = options.name;
        this.aliases = options.aliases;
        this.description = options.description;
        this.usage = options.usage;
        this.examples = options.examples;
        this.permissionGroup = options.permissionGroup;
        this.args = options.args;
    }

    /**
     * Check whether a message and its author are valid to run this command
     * @param message Message to check
     * @returns Whether the command can be run
     */
    check(message: Message): boolean {
        if (this.permissionGroup  && isKeyof(getConfig().permissionGroups, this.permissionGroup)) {
            // Ensure the user is authorised.
            const permissionGroup = getConfig().permissionGroups[this.permissionGroup];
            const sharedRoles = permissionGroup.filter((roleID: string) => {
                return message.member.roles.cache.has(roleID);
            })

            if (sharedRoles.length === 0 && !getConfig().bypassPermission.includes(message.author.id)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Run all checks, and if valid, run function
     * @param client Client
     * @param message Message
     * @param args Arguments
     */
    async run (client: CustomClient, interaction: CommandInteraction) {
        // Discord handles perms !

        await this.raw(client, interaction, this.getArgs(interaction))
    }

    /**
     * Set the onload function
     * @param fn Function to run on load
     */
    onload(fn: (client: CustomClient) => any): Command<T> {
        this._onload = fn;

        return this;
    }

    /**
     * Run the onload function
     * @param client Client
     */
    async load(client: CustomClient) {
        if (this._onload) {
            await this._onload(client);
        }
    }

    getPermissionBody(): ApplicationCommandPermissionData[] {
        if (!this.permissionGroup) return [];
        else {
            if (isKeyof(getConfig().permissionGroups, this.permissionGroup)) {
                return getConfig().permissionGroups[this.permissionGroup].map((v: string) => {
                    return {
                        id: v,
                        type: "ROLE",
                        permission: true
                    }
                })
            } else {
                if (getConfig().strict) {
                    throw new Error(`The permission group ${this.permissionGroup} was not found and the bot is in strict mode`);
                }

                return [];
            }
        }
    }

    getArgs(interaction: CommandInteraction): IArguments<T> {
        const data: IArguments<T> = {};

        for (const argumentName in this.args) {
            if (Object.prototype.hasOwnProperty.call(this.args, argumentName)) {
                const argument = this.args[argumentName];
                const getter = getGetterForType(interaction, argument.type);
                data[argumentName as keyof T] = getter.call(interaction.options, argumentName, !argument.optional) as any;
            }
        }

        return data;
    }

    build(): Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> {
        let builder: Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup"> = new SlashCommandBuilder();
        builder.setName(this.name);
        builder.setDescription(this.description);

        if (this.args) for (const argument in this.args) {
            if (Object.prototype.hasOwnProperty.call(this.args, argument)) {
                const element = this.args[argument];
                const option = getOptionsFunctionForType(builder, element.type);
                builder = option.call(builder, ((arg: any) => {
                    arg.setName(argument)
                        .setDescription(element.description)
                        .setRequired(element.optional !== undefined ? !element.optional : true);

                    if (element.choices) {
                        arg.addChoices(element.choices.map(v => typeof v === "string" ? [v, v] : [v.label ?? v.value, v.value]))
                    }

                    return arg;
                }));

            }
        }

        if (this.permissionGroup) {
            builder.setDefaultPermission(false);
        }

        return builder;
    }

    /**
     * Repackage options
     * @returns Options
     */
    options() {
        return {
            name: this.name,
            aliases: this.aliases,
            description: this.description,
            usage: this.usage,
            examples: this.examples,
            permissionGroup: this.permissionGroup,
            args: this.args
        }
    }
}
