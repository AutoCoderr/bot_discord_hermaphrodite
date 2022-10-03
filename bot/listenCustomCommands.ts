import config from "./config";
import {Message, MessageCreateOptions, MessagePayload} from "discord.js";
import client from "./client";
import {existingCommands} from "./Classes/CommandsDescription";
import CustomError from "./logging/CustomError";
import Command from "./Classes/Command";

type TResponse = false | { result: Array<string | MessagePayload | MessageCreateOptions>, callback?: Function }

async function getAndDisplayCustomCommandsResponse(message: Message, response: TResponse) {
    if (response !== false) {
        for (const payload of response.result)
            await message.channel.send(payload).then(_ => {
                if (response.callback) {
                    response.callback().then(response => getAndDisplayCustomCommandsResponse(message, response));
                }
            });
    }
}
// check all commands
export async function listenCustomCommands(message: Message) {
    if (message.content[0] === config.command_prefix) {
        for (let commandName in existingCommands) {
            const commandClass = existingCommands[commandName];
            if (commandClass.customCommand) {
                const command = <Command>(new commandClass(message.channel, message.member, message.guild, message.content, 'custom'));
                await command.executeCommand(client)
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
