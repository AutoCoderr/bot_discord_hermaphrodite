import {ApplicationCommandOptionTypes} from "discord.js/typings/enums";

export const slashCommandsTypeDefinitions = {
    string: {
        mono: {commandType: "slash", type: ApplicationCommandOptionTypes.STRING},
        multi: {commandType: "custom", type: "strings"}
    },
    number: {commandType: "slash", type: ApplicationCommandOptionTypes.NUMBER},
    boolean: {commandType: "slash", type: ApplicationCommandOptionTypes.BOOLEAN},
    message: {
        multi: {commandType: "custom", type: "messages"}
    },
    channel: {
        mono: {commandType: "slash", type: ApplicationCommandOptionTypes.CHANNEL},
        multi: {commandType: "custom", type: "channels"}
    },
    user: {
        mono: { commandType: "slash", type: ApplicationCommandOptionTypes.USER },
        multi: { commandType: "custom", type: "users" }
    },
    role: {
        mono: {commandType: "slash", type: ApplicationCommandOptionTypes.ROLE},
        multi: {commandType: "custom", type: "roles"}
    },
    command: {
        multi: { commandType: "custom", type: "commands" }
    }
}

export const getterNameBySlashType = {
    [ApplicationCommandOptionTypes.STRING]: 'getString',
    [ApplicationCommandOptionTypes.INTEGER]: 'getInteger',
    [ApplicationCommandOptionTypes.BOOLEAN]: 'getBoolean',
    [ApplicationCommandOptionTypes.USER]: 'getUser',
    [ApplicationCommandOptionTypes.CHANNEL]: 'getChannel',
    [ApplicationCommandOptionTypes.ROLE]: 'getRole',
    [ApplicationCommandOptionTypes.MENTIONABLE]: 'getMentionable',
    [ApplicationCommandOptionTypes.NUMBER]: 'getNumber'
}
