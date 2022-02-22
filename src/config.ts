interface PermissionGroups {
    [k: string]: string[]
}

interface LogChannel {
    channel: string;
    emoji: string;
}

interface Config {
    defaultGuild: string;
    prefix?: string;
    logs: {
        default?: LogChannel;
        [k: string]: LogChannel;
    }
    disable?: {
        commands?: string[];
        categories?: string[];
        events?: string[];
    }
    strict?: boolean;
    permissionGroups?: PermissionGroups;
    bypassPermission?: string[];
}

let defaultConfig: Config = {
    defaultGuild: null,
    prefix: "!",
    logs: {},
    disable: {
        commands: [],
        categories: [],
        events: [],
    },
    strict: true,
    permissionGroups: {},
    bypassPermission: []
}

export const getConfig = () => defaultConfig;
export const setConfig = (config: Config, merge = true) => {
    defaultConfig = merge ? {
        ...defaultConfig,
        ...config,
        logs: {
            ...defaultConfig.logs,
            ...(config.logs ?? {})
        },
        permissionGroups: {
            ...defaultConfig.permissionGroups,
            ...(config.permissionGroups ?? {}),
        },
        bypassPermission: [
            ...defaultConfig.bypassPermission,
            ...(config.bypassPermission ?? [])
        ]
    } : config;
};