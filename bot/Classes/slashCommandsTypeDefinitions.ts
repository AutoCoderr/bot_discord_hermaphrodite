import {ApplicationCommandOptionType} from "discord.js";

export const slashCommandsTypeDefinitions = {
    string: {
        mono: {commandType: "slash", type: ApplicationCommandOptionType.String},
        multi: {commandType: "custom", type: "strings"}
    },
    number: {commandType: "slash", type: ApplicationCommandOptionType.Number},
    integer: {commandType: "slash", type: ApplicationCommandOptionType.Integer},
    positiveInteger: {commandType: "slash", type: ApplicationCommandOptionType.Integer},
    overZeroInteger: {commandType: "slash", type: ApplicationCommandOptionType.Integer},
    boolean: {commandType: "slash", type: ApplicationCommandOptionType.Boolean},
    message: {
        multi: {commandType: "custom", type: "messages"}
    },
    channel: {
        mono: {commandType: "slash", type: ApplicationCommandOptionType.Channel},
        multi: {commandType: "custom", type: "channels"}
    },
    user: {
        mono: { commandType: "slash", type: ApplicationCommandOptionType.User },
        multi: { commandType: "custom", type: "users" }
    },
    role: {
        mono: {commandType: "slash", type: ApplicationCommandOptionType.Role},
        multi: {commandType: "custom", type: "roles"}
    },
    command: {
        multi: { commandType: "custom", type: "commands" }
    }
}

export const getterNameBySlashType = {
    [ApplicationCommandOptionType.String]: 'getString',
    [ApplicationCommandOptionType.Integer]: 'getInteger',
    [ApplicationCommandOptionType.Boolean]: 'getBoolean',
    [ApplicationCommandOptionType.User]: 'getUser',
    [ApplicationCommandOptionType.Channel]: 'getChannel',
    [ApplicationCommandOptionType.Role]: 'getRole',
    [ApplicationCommandOptionType.Mentionable]: 'getMentionable',
    [ApplicationCommandOptionType.Number]: 'getNumber'
}
