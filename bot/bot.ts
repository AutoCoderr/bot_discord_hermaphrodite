import config from "./config";

import { existingCommands } from "./Classes/CommandsDescription";
import WelcomeMessage, {IWelcomeMessage} from "./Models/WelcomeMessage";
import client from "./client";

import init from "./init";
import {Message, MessageOptions, MessagePayload} from "discord.js";

function getAndDisplayCustomCommandsResponse(message: Message, response: false| { result: Array<string | MessagePayload | MessageOptions>, callback?: Function }) {
    if (response !== false) {
        for (const payload of response.result)
            message.channel.send(payload).then(sendedMessage => {
                if (response.callback) {
                    response.callback(sendedMessage).then(response => getAndDisplayCustomCommandsResponse(message, response));
                }
            });
    }
}

// check all commands
client.on('messageCreate', async message => {
    if (message.content[0] === config.command_prefix) {
        for (let commandName in existingCommands) {
            const commandClass = existingCommands[commandName];
            if (commandClass.customCommand) {
                const command = new commandClass(message.channel, message.member, message.guild, message.content);
                command.executeCommand(client).then(response => getAndDisplayCustomCommandsResponse(message, response));
            }
        }
    }

    if (!message.author.bot) {

        if (message.type == "GUILD_MEMBER_JOIN") { // @ts-ignore
            const welcomeMessage: IWelcomeMessage = await WelcomeMessage.findOne({serverId: message.guild.id, enabled: true});
            if (welcomeMessage != null) {
                try {
                    await message.author.send(welcomeMessage.message);
                } catch (e) {// @ts-ignore
                    if (e.message == "Cannot send messages to this user") {
                        message.channel.send("<@"+message.author.id+"> \n\n"+welcomeMessage.message);
                    }
                }
            }
        }
    }
});

client.login(config.token);

init(client);


// @ts-ignore
String.prototype.replaceAll = function (A,B) {
    let str = this.valueOf();
    while (str.replace(A,B) != str) {
        str = str.replace(A,B);
    }
    return str;
}
