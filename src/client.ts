import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import discord, { Client, MessageEmbed, Role, TextChannel } from "discord.js";
import fs from "fs";
import path from "path";
import Category from "./category";
import { Command } from "./command";
import { getConfig } from "./config";
import { Event } from "./event";
import { isKeyof } from "./utils";

export interface ITask {
    id: NodeJS.Timeout,
    fun: any,
    lastRun: Date,
    nextRun: Date,
    every: number
}
export class CustomClient extends Client {
    commands: discord.Collection<string, Command<any>>;
    categories: discord.Collection<string, Category>;
    tasks: discord.Collection<string, ITask>;

    constructor (options?: discord.ClientOptions) {
        super(options);

        this.commands = new discord.Collection();
        this.categories = new discord.Collection();
        this.tasks = new discord.Collection();
    }


    /**
     * Load categories from commands/categories
     */
    loadCategories() {
        // Load commands
        const categoryFiles = fs.readdirSync(path.join(__dirname, "categories")).filter(file => file.endsWith(".js"));
        for (const file of categoryFiles) {
            // If this command is disabled
            if (getConfig().disable.categories.includes(file.split(".")[0])) continue;

            try {
                const category: Category = require(`./categories/${file}`).default;
                this.categories.set(category.name, category);

                console.log(`Category ${category.label} loaded from ${file}`);
                category.load(this);
            } catch (e) {
                console.error(`Error loading category ${file}: ${e}`);
            }
        }
    }

    /**
     * Load commands in the `commands` directory.
     */
    loadCommands() {
        // Load commands
        const commandFiles = fs.readdirSync(path.join(__dirname, "commands")).filter(file => file.endsWith(".js"));
        for (const file of commandFiles) {
            // If this command is disabled
            if (getConfig().disable.commands.includes(file.split(".")[0])) continue;

            try {
                const command: Command<any> = require(`./commands/${file}`).default;
                this.commands.set(command.name, command);

                console.log(`${getConfig().prefix}${command.name} loaded from ${file}`);
                command.load(this);
            } catch (e) {
                console.error(`Error loading command ${file}: ${e}`);
            }
        }
    }

    getCommand(commandName: string): Command<any> | null {
        // Load command from any category or local
        const localCommand = this.commands.get(commandName) || this.commands.find(c => c.aliases && c.aliases.includes(commandName));
        if (localCommand) return localCommand;

        // Find from a category
        for (const category of this.categories.values()) {
            const categoryCommand = category.getCommand(commandName);
            if (categoryCommand) return categoryCommand;
        }

        return null;
    }

    allCommands(): Command<any>[] {
        let commands: Command<any>[] = [];
        commands = commands.concat(Array.from(this.commands.values()));

        for (const category of this.categories.values()) {
            commands = commands.concat(Array.from(category.commands.values()))
        }

        return commands;
    }

    /**
     * Load events in the `events` directory.
     */
    loadEvents() {
        const eventFiles = fs.readdirSync(path.join(__dirname, "events")).filter(file => file.endsWith(".js"));
        for (const file of eventFiles) {
            if (getConfig().disable.events.includes(file.split(".")[0])) continue;

            try {
                const event: Event = require(`./events/${file}`).default;
                console.log(`Event ${event.name} loaded from ${file}`);

                event.load(this);
            } catch (e) {
                console.error(`Error loading event ${file}: ${e}`);
            }
        }
    }

    /**
     * Register the commands to Discord for the default guild
     */
    async registerCommands() {
        if (!getConfig().defaultGuild) {
            // Force to set.
            console.error("No default guild was set for the bot. This is compulsory and without it the bot will not register any commands.");
            return;
        }

        const guild = this.guilds.cache.get(getConfig().defaultGuild);
        const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);

        try {
            this.log(undefined, "Registering slash commands");

            // Push commands
            const createPromises = [];
            for (const command of this.allCommands()) {
                createPromises.push(rest.post(
                    Routes.applicationGuildCommands(this.user.id, guild.id) as unknown as `/${string}`,
                    { body: command.build().toJSON() }
                ).catch(e => console.error(e)))
            }

            const createResults = await Promise.allSettled(createPromises);

            const permissionPromises = [];
            // Update permissions
            const commands = await guild.commands.fetch();
            for (const commandData of commands.values()) {
                // Commands
                const command = this.getCommand(commandData.name);
                if (command) {
                    // Request permission body from command
                    permissionPromises.push(commandData.permissions.set({
                        permissions: command.getPermissionBody()
                    }).catch(e => console.error(e)));
                }
            }

            await Promise.allSettled(createPromises);
            const successes = createResults.filter(v => v.status === "fulfilled").length;
            const failures = createResults.filter(v => v.status === "rejected").length;
            this.log(undefined, `Finished registering commands. ${successes} success, ${failures} failures`);
        } catch (error) {
            console.error(error);
            this.log(undefined, "Error registering commands");
        }
    }

    getApplicationGuildCommandsBody() {
        const data = [];
        for (const command of this.allCommands()) {
            data.push(command.build().toJSON());
        }

        return data;
    }

    addTask(name: string, fun: any, every: number) {
        const wrappedTask = (wTask: ITask) => {
            wTask.lastRun = new Date();
            wTask.nextRun = new Date(Date.now() + wTask.every);
            try {
                wTask.fun();
            } catch (e) {
                this.log("default", `Error running task ${name}: ${e}`);
                console.error(e);
            }
        }

        const task: ITask = {
            id: null,
            fun,
            lastRun: null,
            nextRun: null,
            every
        };

        const id = setInterval(() => wrappedTask(task), every);
        task.id = id;
        wrappedTask(task);

        this.tasks.set(name, task);
    }

    /**
     * Send a log on Discord
     * @param key Log key
     * @param content Text content
     * @param embed Embed to send with it
     */
    async log(key: string, content: string, embed?: MessageEmbed) {
        const logInfo = isKeyof(getConfig().logs, key) ? getConfig().logs[key] : getConfig().logs.default;
        if (!logInfo) {
            if (getConfig().strict) {
                throw new Error("No default log was defined and strict mode is enabled");
            }
            return;
        }

        const channel = await this.channels.fetch(logInfo.channel) as TextChannel;

        const date = new Date();
        await channel?.send({
            content: `${logInfo.emoji ?? ""} \`[${date.toLocaleTimeString()}]\` ${content ?? ""}`,
            embeds: embed ? [embed] : undefined
        });
    }

}