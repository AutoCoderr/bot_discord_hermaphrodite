import config from "./config";
import {Message, MessageCreateOptions, MessagePayload, ModalBuilder} from "discord.js";
import {existingCommands} from "./Classes/CommandsDescription";
import CustomError from "./logging/CustomError";
import Command from "./Classes/Command";

type TResponse = false | { result: Array<string | MessagePayload | MessageCreateOptions>|ModalBuilder, callback?: Function }

async function getAndDisplayCustomCommandsResponse(message: Message, response: TResponse) {
    if (!response)
        return;
    if (response.result instanceof Array) {
        for (const payload of response.result)
            await message.channel.send(payload).then(_ => {
                if (response.callback) {
                    response.callback().then(response => getAndDisplayCustomCommandsResponse(message, response));
                }
            });
        return;
    }

    throw new Error("You can't return a modal on custom command");
}
// check all commands
export async function listenCustomCommands(message: Message) {
    if (message.content[0] === config.command_prefix) {
        for (let commandName in existingCommands) {
            const commandClass = existingCommands[commandName];
            if (commandClass.customCommand) {
                const command = <Command>(new commandClass(message, 'custom'));
                await command.executeCommand()
                    .then(response => getAndDisplayCustomCommandsResponse(message, <TResponse>response))
                    .catch(e => {
                        message.channel.send("Une erreur interne est survenue");
                        throw new CustomError(e, {
                            from: "customCommand",
                            command: commandName,
                            commandRawArguments: command.parseCommand()
                        })
                    })
            }
        }
    }
}
