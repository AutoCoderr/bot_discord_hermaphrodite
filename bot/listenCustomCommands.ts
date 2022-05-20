import config from "./config";
import {Message, MessageOptions, MessagePayload} from "discord.js";
import client from "./client";
import {existingCommands} from "./Classes/CommandsDescription";
import WelcomeMessage, {IWelcomeMessage} from "./Models/WelcomeMessage";

function getAndDisplayCustomCommandsResponse(message: Message, response: false | { result: Array<string | MessagePayload | MessageOptions>, callback?: Function }) {
    if (response !== false) {
        for (const payload of response.result)
            message.channel.send(payload).then(_ => {
                if (response.callback) {
                    response.callback().then(response => getAndDisplayCustomCommandsResponse(message, response));
                }
            });
    }
}
// check all commands
export function listenCustomCommands(message: Message) {
    if (message.content[0] === config.command_prefix) {
        for (let commandName in existingCommands) {
            const commandClass = existingCommands[commandName];
            if (commandClass.customCommand) {
                const command = new commandClass(message.channel, message.member, message.guild, message.content, 'custom');
                command.executeCommand(client).then(response => getAndDisplayCustomCommandsResponse(message, response));
            }
        }
    }
}