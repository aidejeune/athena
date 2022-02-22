import { Collection } from "discord.js";
import fs from "fs";
import path from "path";
import { CustomClient } from "./client";
import { Command } from "./command";
import { getConfig } from "./config";
import { Event } from "./event";

export interface ICategoryOptions {
    name: string,
    label: string,
    description?: string,
    emoji?: string
}

interface IRawTask {
    name: string, fun: any, every: number
}

export default class Category {
    name: string;
    label: string;
    description?: string;
    emoji?: string;

    commands: Collection<string, Command<any>>;
    tasks: IRawTask[];
    events: Event[];
    constructor(options: ICategoryOptions) {
        this.name = options.name;
        this.label = options.label;
        this.description = options.description;
        this.emoji = options.emoji;

        this.commands = new Collection();
        this.events = [];
        this.tasks = [];
    }

    /**
     * Add a command to this category
     * @param command Command to add
     */
    addCommand(command: Command<any>) {
        console.log(`${getConfig().prefix}${command.name} loaded for category ${this.name}`);
        this.commands.set(command.name, command);

        return this;
    }

    /**
     * Load commands from a directory
     * @param directory Directory to load from
     */
    addCommandsFromDirectory(directory: string) {
        const commandFiles = fs.readdirSync(path.join(directory)).filter(file => file.endsWith(".js"));
        for (const file of commandFiles) {
            // If this command is disabled
            if (getConfig().disable.commands.includes(file.split(".")[0])) continue;

            try {
                const command: Command<any> = require(path.join(directory, file)).default;
                this.addCommand(command);
            } catch (e) {
                console.error(`Error loading command ${file}: ${e}`);
            }
        }
    }

    /**
     * Add an event to this category
     * @param event Command to add
     */
    addEvent(event: Event) {
        console.log(`Event ${event.name} loaded for category ${this.name}`);
        this.events.push(event);

        return this;
    }

    /**
     * Load events from a directory
     * @param directory Directory to load from
     */
    addEventsFromDirectory(directory: string) {
        const eventFiles = fs.readdirSync(path.join(directory)).filter(file => file.endsWith(".js"));
        for (const file of eventFiles) {
            // If this event is disabled
            if (getConfig().disable.events.includes(file.split(".")[0])) continue;

            try {
                const event: Event = require(path.join(directory, file)).default;
                this.addEvent(event);
            } catch (e) {
                console.error(`Error loading event ${file}: ${e}`);
            }
        }
    }

    addTask(name: string, fun: any, every: number) {
        this.tasks.push({ name, fun, every });

        return this;
    }

    /**
     * Run the onload function for every command
     * @param client Client
     */
    async load(client: CustomClient) {
        for (const command of this.commands.values()) {
            command.load(client);
        }

        for (const event of this.events) {
            event.load(client);
        }

        for (const task of this.tasks) {
            client.addTask(task.name, task.fun, task.every);
        }
    }

    getCommand(commandName: string): Command<any> | null {
        return this.commands.get(commandName) || this.commands.find(c => c.aliases && c.aliases.includes(commandName));
    }

    getEvents(eventName: string): Event[] {
        return this.events.filter(e => e.name === eventName);
    }

    getHelpText(full: boolean = false) {
        if (!full && this.commands.size === 0) return "";
        let text = `
${this.emoji ? this.emoji + " " : ""}**${this.label}** ${this.description ? "- " + this.description : ""}
> ${this.commands.map(commandInList => commandInList.name).join(', ') || "Aucune commande"}`;

        if (full) {
            const eventsFormatted = this.events.map(eventInList => `${eventInList.name} (\`${eventInList.lastRun?.toISOString() ?? "jamais"}\`)`).join(', ')
            text += `
> __Écoute ${eventsFormatted || "aucune event"}__`
        }

        return text;
    }
}