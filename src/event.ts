import { CustomClient } from "./client";

export interface IEventOptions {
    name: string;
    once?: boolean;
}

type EventCallable = (client: CustomClient, ...args: any[]) => any;
export class Event {
    raw: EventCallable;

    // Public options
    name: string;
    once?: boolean;
    lastRun?: Date;
    private _onload?: (client: CustomClient) => any;
    constructor (raw: EventCallable, options: IEventOptions) {
        this.raw = raw;
        this.name = options.name;
        this.once = options.once;
        this.lastRun = null;
    }

    /**
     * Sets last run to now and executes raw function
     * @param client Client
     * @param args Arguments
     */
    async run (client: CustomClient, ...args: any[]) {
        this.lastRun = new Date();
        return await this.exec(client, ...args);
    }

    /**
     * Run the Event. This does NOT run any checks. Run .run() to run all checks.
     * @param client Client
     * @param args Arguments, all string
     */
    async exec (client: CustomClient, ...args: any[]) {
        try {
            await this.raw(client, ...args);
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * Set the onload function
     * @param fn Function to run on load
     */
    onload(fn: (client: CustomClient) => any): Event {
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

        // If on ready.
        if (this.name === "ready") {
            this.run(client);
        }

        if (this.once) {
            client.once(this.name, (...args) => this.run(client, ...args));
        } else {
            client.on(this.name, (...args) => this.run(client, ...args));
        }

        console.log(`${this.name} configured`)
    }

    /**
     * Repackage options
     * @returns Options
     */
    options(): IEventOptions {
        return {
            name: this.name,
            once: this.once
        }
    }
}
