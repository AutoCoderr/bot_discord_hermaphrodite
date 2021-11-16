import {ApplicationCommandOptionTypes} from "discord.js/typings/enums";

const slashCommandsTypeDefinitions = {
    string: {commandType: "slash", type: ApplicationCommandOptionTypes.STRING},
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

export default slashCommandsTypeDefinitions;